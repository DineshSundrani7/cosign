/**
 * CosignService — the decision layer.
 *
 *  agent ──signed request──▶ gateway (identity, freshness, replay, rate limit)
 *                              └▶ policy engine (green / amber / red)
 *                                   ├ green  → token signed under the user's mandate
 *                                   └ amber/red → pending until the user approves with their PIN
 *                                                 (red also needs the number shown on the agent's screen)
 *  Every approval returns a single-use, short-lived token the bank verifies on its own.
 *  Every decision is written to a tamper-evident receipt log.
 */
import { randomInt } from "node:crypto";
import { b64u, canonical, lockWithPin, newKeyPair, randomId, sha256, signText, unlockWithPin, verifyText, type KeyPair, type LockedKey } from "./crypto.js";
import { evaluate } from "./policy.js";
import { ReceiptLog } from "./receipts.js";
import type { Decision, Mandate, RequestBody, SignedRequest, Tier, TokenClaims } from "./types.js";

const FRESHNESS_MS = 2 * 60 * 1000; // a request must be signed within the last 2 minutes
const TOKEN_TTL_MS = 5 * 60 * 1000; // approval tokens expire after 5 minutes
const RATE_LIMIT = 5; // requests per agent per hour
const PAUSE_MS = 24 * 60 * 60 * 1000;
const UNDO_MS = 48 * 60 * 60 * 1000; // approved payments can be undone for 48 hours

interface AgentRecord { id: string; name: string; user: string; publicKey: string; pausedUntil: number; recent: number[] }
interface UserRecord { address: string; devicePublicKey: string; deviceKey: LockedKey; mandates: Mandate[]; knownPayees: Set<string>; circleApprover?: string }
interface RequestRecord { id: string; body: RequestBody; hash: string; tier: Tier; reasons: string[]; status: Decision["status"]; token?: string; numberMatch?: string; undoUntil?: number }

export interface PublicKeys { issuer: string; devices: Record<string, string>; revoked: string[] }

/** Everything needed to rebuild the service after a restart (stored in SQLite by server.ts). */
export interface Snapshot {
  version: 1;
  issuer: KeyPair;
  users: (Omit<UserRecord, "knownPayees"> & { knownPayees: string[] })[];
  agents: AgentRecord[];
  requests: RequestRecord[];
  seenNonces: string[];
  revoked: string[];
  merchantStock: [string, number][];
}

export class CosignService {
  private issuer: KeyPair = newKeyPair();
  private readonly agents = new Map<string, AgentRecord>();
  private readonly users = new Map<string, UserRecord>();
  private readonly requests = new Map<string, RequestRecord>();
  private readonly seenNonces = new Set<string>();
  private readonly revoked = new Set<string>(); // token ids cancelled by an undo before the bank used them
  /** Seller stock feeds, keyed by payee. In production these come from merchants and marketplaces. */
  private readonly merchantStock = new Map<string, number>();
  readonly receipts = new ReceiptLog();

  constructor(private readonly now: () => number = Date.now) {}

  /* ---------------- persistence ---------------- */

  snapshot(): Snapshot {
    return {
      version: 1,
      issuer: this.issuer,
      users: [...this.users.values()].map((u) => ({ ...u, knownPayees: [...u.knownPayees] })),
      agents: [...this.agents.values()],
      requests: [...this.requests.values()],
      seenNonces: [...this.seenNonces],
      revoked: [...this.revoked],
      merchantStock: [...this.merchantStock],
    };
  }

  static restore(snap: Snapshot, receipts: import("./receipts.js").Receipt[], now: () => number = Date.now): CosignService {
    const s = new CosignService(now);
    s.issuer = snap.issuer;
    for (const u of snap.users) s.users.set(u.address, { ...u, knownPayees: new Set(u.knownPayees) });
    for (const a of snap.agents) s.agents.set(a.id, a);
    for (const r of snap.requests) s.requests.set(r.id, r);
    snap.seenNonces.forEach((n) => s.seenNonces.add(n));
    snap.revoked.forEach((j) => s.revoked.add(j));
    snap.merchantStock.forEach(([k, v]) => s.merchantStock.set(k, v));
    s.receipts.restore(receipts);
    return s;
  }

  /* ---------------- setup ---------------- */

  /** Creates the user's device key and locks it with their PIN (stands in for the phone's secure chip). */
  registerUser(address: string, pin: string, opts: { mandates?: Omit<Mandate, "spentThisMonth">[]; knownPayees?: string[]; circleApprover?: string } = {}) {
    if (opts.circleApprover && !this.users.has(opts.circleApprover)) throw new Error(`Register the approver ${opts.circleApprover} first`);
    const device = newKeyPair();
    this.users.set(address, {
      address,
      devicePublicKey: device.publicKey,
      deviceKey: lockWithPin(device.privateKey, pin),
      mandates: (opts.mandates ?? []).map((m) => ({ state: "active", ...m, spentThisMonth: 0 })),
      knownPayees: new Set(opts.knownPayees ?? []),
      circleApprover: opts.circleApprover,
    });
  }

  /* ---------------- managing limits ---------------- */

  addMandate(address: string, m: Omit<Mandate, "spentThisMonth" | "state">) {
    const user = this.mustUser(address);
    user.mandates.push({ ...m, state: "active", spentThisMonth: 0 });
    this.receipts.append({ event: "mandate", user: address, summary: `New mandate “${m.id}”: ${m.category}, ≤ ₹${m.maxPerAction} each, ≤ ₹${m.maxPerMonth}/month`, decidedBy: "user" }, this.now());
  }

  setMandateState(address: string, id: string, state: "active" | "paused" | "revoked") {
    const m = this.mustUser(address).mandates.find((x) => x.id === id);
    if (!m) throw new Error(`Unknown mandate ${id}`);
    if (m.state === "revoked") throw new Error("A revoked mandate can't be changed");
    m.state = state;
    this.receipts.append({ event: "mandate", user: address, summary: `Mandate “${id}” ${state}`, decidedBy: "user" }, this.now());
  }

  mandates(address: string) { return this.mustUser(address).mandates.map((m) => ({ ...m })); }

  /** Seller data Cosign checks claims against (demo: stock counts). */
  setMerchantStock(payee: string, stock: number) { this.merchantStock.set(payee, stock); }

  /** Registers an agent for a user. The agent keeps its private key; Cosign stores only the public key. */
  registerAgent(name: string, user: string): { agentId: string; privateKey: string } {
    if (!this.users.has(user)) throw new Error(`Unknown user ${user}`);
    const keys = newKeyPair();
    const agentId = randomId("agt");
    this.agents.set(agentId, { id: agentId, name, user, publicKey: keys.publicKey, pausedUntil: 0, recent: [] });
    return { agentId, privateKey: keys.privateKey };
  }

  /** What banks and rails need to verify tokens offline — like a JWKS endpoint. */
  publicKeys(): PublicKeys {
    const devices: Record<string, string> = {};
    for (const u of this.users.values()) devices[u.address] = u.devicePublicKey;
    return { issuer: this.issuer.publicKey, devices, revoked: [...this.revoked] };
  }

  /* ---------------- the gateway + policy ---------------- */

  submit(req: SignedRequest): Decision {
    const { body } = req;
    const id = randomId("req");
    const block = (reason: string): Decision => {
      this.requests.set(id, { id, body, hash: sha256(canonical(body)), tier: "blocked", reasons: [reason], status: "blocked" });
      this.receipts.append({ event: "blocked", requestId: id, agent: body?.agentId, user: body?.user, summary: reason, decidedBy: "cosign:gateway" }, this.now());
      return { requestId: id, status: "blocked", tier: "blocked", reasons: [reason] };
    };

    const agent = this.agents.get(body?.agentId);
    if (!agent) return block("Unregistered agent");
    if (!verifyText(agent.publicKey, canonical(body), req.signature)) return block("Signature doesn't match the registered agent key");
    if (agent.pausedUntil > this.now()) return block(`Agent “${agent.name}” is paused for flooding`);
    if (body.user !== agent.user) return block("Agent isn't linked to this user");
    if (Math.abs(this.now() - body.issuedAt) > FRESHNESS_MS) return block("Request is stale (older than 2 minutes)");
    if (this.seenNonces.has(body.nonce)) return block("Replayed request (nonce already used)");
    this.seenNonces.add(body.nonce);

    agent.recent = agent.recent.filter((t) => this.now() - t < 60 * 60 * 1000);
    agent.recent.push(this.now());
    if (agent.recent.length > RATE_LIMIT) {
      agent.pausedUntil = this.now() + PAUSE_MS;
      return block(`Rate limit: more than ${RATE_LIMIT} requests in an hour — agent paused for 24 hours`);
    }

    const user = this.users.get(body.user)!;
    const checked: RequestBody = { ...body, sellerClaims: body.sellerClaims?.map((c) => this.checkClaim(body.payee, c)) };
    const result = evaluate(checked, { mandates: user.mandates, knownPayees: user.knownPayees, now: this.now() });
    const record: RequestRecord = { id, body, hash: sha256(canonical(body)), tier: result.tier, reasons: result.reasons, status: "pending" };
    this.requests.set(id, record);

    if (result.tier === "green" && result.mandate) {
      result.mandate.spentThisMonth += body.amount ?? 0;
      record.status = "approved";
      if (body.action === "payment") record.undoUntil = this.now() + UNDO_MS;
      record.token = this.issueToken(record, `mandate:${result.mandate.id}`);
      this.receipts.append({ event: "approved", requestId: id, agent: agent.name, user: body.user, summary: describe(body), decidedBy: `mandate:${result.mandate.id}` }, this.now());
      return { requestId: id, status: "approved", tier: "green", reasons: result.reasons, token: record.token };
    }

    if (result.tier === "red") record.numberMatch = String(randomInt(10, 100));
    const who = user.circleApprover ? `${user.circleApprover} (Family Circle)` : "the user";
    this.receipts.append({ event: "pending", requestId: id, agent: agent.name, user: body.user, summary: `${describe(body)} — waiting for ${who} (${result.tier})` }, this.now());
    return { requestId: id, status: "pending", tier: result.tier, reasons: result.reasons, numberMatch: record.numberMatch };
  }

  /* ---------------- the user's decision ---------------- */

  /** The user approves on their phone: the PIN unlocks the device key, which signs this exact request.
   *  With a Family Circle, the approver's PIN and device key are used instead (e.g. an adult child for a parent). */
  approve(requestId: string, pin: string, opts: { numberMatch?: string } = {}): Decision {
    const record = this.mustPending(requestId);
    if (record.tier === "red" && opts.numberMatch !== record.numberMatch) throw new Error("Number doesn't match the one on the agent's screen");
    const user = this.users.get(record.body.user)!;
    const approver = user.circleApprover ? this.mustUser(user.circleApprover) : user;
    const deviceKey = unlockWithPin(approver.deviceKey, pin); // throws "Wrong PIN"
    const userSig = signText(deviceKey, record.hash);
    record.status = "approved";
    const decidedBy = user.circleApprover ? `circle:${approver.address}` : record.tier === "red" ? "user:pin+number-match" : "user:pin";
    record.token = this.issueToken(record, decidedBy, userSig, user.circleApprover);
    if (record.body.action === "payment") record.undoUntil = this.now() + UNDO_MS;
    if (record.body.payee) user.knownPayees.add(record.body.payee);
    const forWhom = user.circleApprover ? ` for ${user.address}` : "";
    this.receipts.append({ event: "approved", requestId, agent: record.body.agentId, user: user.address, summary: `${describe(record.body)}${forWhom}`, decidedBy }, this.now());
    return { requestId, status: "approved", tier: record.tier, reasons: record.reasons, token: record.token };
  }

  /** One-tap undo within 48 hours of an approved payment. The bank then refunds. */
  undo(requestId: string): Decision {
    const r = this.requests.get(requestId);
    if (!r) throw new Error("Unknown request");
    if (r.status !== "approved" || !r.undoUntil) throw new Error("Only approved payments can be undone");
    if (this.now() > r.undoUntil) throw new Error("The 48-hour undo window has passed — raise a dispute instead");
    r.status = "undone";
    if (r.token) { try { this.revoked.add(JSON.parse(Buffer.from(r.token.split(".")[1]!, "base64url").toString()).jti); } catch { /* ignore */ } }
    this.receipts.append({ event: "undone", requestId, agent: r.body.agentId, user: r.body.user, summary: `Undone: ${describe(r.body)}`, decidedBy: "user" }, this.now());
    return { requestId, status: "undone", tier: r.tier, reasons: r.reasons };
  }

  /** Raise a dispute; the receipt chain is the evidence. */
  dispute(requestId: string, reason: string) {
    const r = this.requests.get(requestId);
    if (!r) throw new Error("Unknown request");
    const receipt = this.receipts.append({ event: "disputed", requestId, agent: r.body.agentId, user: r.body.user, summary: `Dispute: ${reason}`, decidedBy: "user" }, this.now());
    const evidence = this.receipts.entries.filter((e) => e.requestId === requestId);
    return { disputeId: `DSP-${receipt.index}`, evidence, chain: this.receipts.verify() };
  }

  decline(requestId: string): Decision {
    const record = this.mustPending(requestId);
    record.status = "declined";
    this.receipts.append({ event: "declined", requestId, agent: record.body.agentId, user: record.body.user, summary: describe(record.body), decidedBy: "user:one-tap" }, this.now());
    return { requestId, status: "declined", tier: record.tier, reasons: record.reasons };
  }

  get(requestId: string) {
    const r = this.requests.get(requestId);
    if (!r) return undefined;
    return { requestId: r.id, status: r.status, tier: r.tier, reasons: r.reasons, token: r.token, numberMatch: r.numberMatch, body: r.body };
  }

  /* ---------------- tokens ---------------- */

  private issueToken(record: RequestRecord, decidedBy: string, userSig?: string, approver?: string): string {
    const iat = this.now();
    const claims: TokenClaims = {
      jti: randomId("tok"),
      iss: "cosign",
      sub: record.body.user,
      agent: record.body.agentId,
      act: record.body.action,
      amt: record.body.amount,
      payee: record.body.payee,
      recipient: record.body.recipient,
      reqHash: record.hash,
      tier: record.tier as TokenClaims["tier"],
      decidedBy,
      approver,
      userSig,
      iat,
      exp: iat + TOKEN_TTL_MS,
    };
    const head = `${b64u(canonical({ alg: "EdDSA", typ: "cosign+jwt", kid: "cosign-v0" }))}.${b64u(canonical(claims))}`;
    return `${head}.${signText(this.issuer.privateKey, head)}`;
  }

  private checkClaim(payee: string | undefined, c: NonNullable<RequestBody["sellerClaims"]>[number]) {
    if (c.kind === "stock" && payee && this.merchantStock.has(payee) && typeof c.value === "number") {
      return { ...c, verified: this.merchantStock.get(payee)! <= c.value }; // "only 2 left" is true only if stock ≤ 2
    }
    return { ...c, verified: c.verified ?? false }; // unverifiable claims are treated as unverified
  }

  private mustUser(address: string): UserRecord {
    const u = this.users.get(address);
    if (!u) throw new Error(`Unknown user ${address}`);
    return u;
  }

  private mustPending(requestId: string): RequestRecord {
    const r = this.requests.get(requestId);
    if (!r) throw new Error("Unknown request");
    if (r.status !== "pending") throw new Error(`Request is already ${r.status}`);
    return r;
  }

  /** Test helper: lets tests pretend the device key leaked, to show the PIN still guards it. */
  _deviceLockFor(address: string) { return this.users.get(address)?.deviceKey; }
}

export function describe(b: RequestBody): string {
  if (b.action === "payment") return `Pay ₹${(b.amount ?? 0).toLocaleString("en-IN")} to ${b.payee} (${b.category ?? "uncategorised"})`;
  if (b.action === "data_share") return `Share ${(b.data ?? []).join(", ")} with ${b.recipient}`;
  return `Sign contract with ${b.recipient}`;
}
