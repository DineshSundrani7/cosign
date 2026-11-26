/**
 * Browser port of the Cosign v0 engine (server/src) for the "Try the real engine" panel.
 * Real cryptography, running locally in the visitor's browser:
 *  - Ed25519 signatures (@noble/ed25519) for the agent, the Cosign issuer and the user's device
 *  - SHA-256 request hashes, PBKDF2 + AES-GCM to lock the device key with a PIN (Web Crypto)
 * Nothing is sent anywhere. The bank and money are simulated.
 */
import * as ed from "@noble/ed25519";

const enc = new TextEncoder();
const dec = new TextDecoder();
const subtle = () => globalThis.crypto?.subtle;
export const engineSupported = () => !!subtle() && typeof globalThis.crypto.getRandomValues === "function";

const b64u = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
export const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
const rand = (n: number) => crypto.getRandomValues(new Uint8Array(n));

export function canonical(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  return `{${Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== undefined).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, x]) => `${JSON.stringify(k)}:${canonical(x)}`).join(",")}}`;
}
async function sha256(text: string) { return hex(new Uint8Array(await subtle()!.digest("SHA-256", enc.encode(text)))); }

type Keys = { secret: Uint8Array; pub: Uint8Array };
async function keypair(): Promise<Keys> { const secret = ed.utils.randomSecretKey(); return { secret, pub: await ed.getPublicKeyAsync(secret) }; }
const sign = async (secret: Uint8Array, text: string) => b64u(await ed.signAsync(enc.encode(text), secret));
const verify = async (pub: Uint8Array, text: string, sig: string) => { try { return await ed.verifyAsync(fromB64u(sig), enc.encode(text), pub); } catch { return false; } };

/* PIN lock: PBKDF2 → AES-GCM, so the stored device key is useless without the PIN */
async function lock(secret: Uint8Array, pin: string) {
  const salt = rand(16), iv = rand(12);
  const base = await subtle()!.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveKey"]);
  const key = await subtle()!.deriveKey({ name: "PBKDF2", salt, iterations: 120_000, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  return { salt, iv, data: new Uint8Array(await subtle()!.encrypt({ name: "AES-GCM", iv }, key, secret)) };
}
async function unlock(l: { salt: Uint8Array; iv: Uint8Array; data: Uint8Array }, pin: string) {
  const base = await subtle()!.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveKey"]);
  const key = await subtle()!.deriveKey({ name: "PBKDF2", salt: l.salt, iterations: 120_000, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  try { return new Uint8Array(await subtle()!.decrypt({ name: "AES-GCM", iv: l.iv }, key, l.data)); } catch { throw new Error("Wrong PIN — the device key stays locked"); }
}

export type Body = { agentId: string; user: string; action: "payment"; amount: number; payee: string; category: string; purpose: string; nonce: string; issuedAt: number };
export type Signed = { body: Body; signature: string };
export type Decision = { id: string; status: "approved" | "pending" | "blocked"; tier: "green" | "amber" | "blocked"; reasons: string[]; token?: string; hash?: string };

export class Engine {
  private issuer!: Keys;
  private device!: { pub: Uint8Array; locked: Awaited<ReturnType<typeof lock>> };
  agent!: Keys;
  readonly agentId = "agt_mitra";
  readonly user = "kavya@cosign";
  private nonces = new Set<string>();
  private pending = new Map<string, { body: Body; hash: string }>();
  private used = new Set<string>();
  private spent = 0;
  issuerPubHex = "";
  agentPubHex = "";

  static async create() {
    const e = new Engine();
    e.issuer = await keypair();
    e.agent = await keypair();
    const dev = await keypair();
    e.device = { pub: dev.pub, locked: await lock(dev.secret, "1234") };
    e.issuerPubHex = hex(e.issuer.pub);
    e.agentPubHex = hex(e.agent.pub);
    return e;
  }

  /** The agent's side: build and sign a request. `keyOverride` lets the demo forge a request with the wrong key. */
  async agentRequest(fields: { amount: number; payee: string; category: string; purpose: string }, keyOverride?: Uint8Array): Promise<Signed> {
    const body: Body = { agentId: this.agentId, user: this.user, action: "payment", ...fields, nonce: b64u(rand(9)), issuedAt: Date.now() };
    return { body, signature: await sign(keyOverride ?? this.agent.secret, canonical(body)) };
  }

  /** Gateway + policy. Mandate: groceries up to ₹3,000 an order, ₹12,000 a month; FreshBasket is a known payee. */
  async submit(req: Signed): Promise<Decision> {
    const id = `req_${b64u(rand(6))}`;
    if (req.body.agentId !== this.agentId) return { id, status: "blocked", tier: "blocked", reasons: ["Unregistered agent"] };
    if (!(await verify(this.agent.pub, canonical(req.body), req.signature))) return { id, status: "blocked", tier: "blocked", reasons: ["Signature doesn't match Mitra's registered key"] };
    if (Math.abs(Date.now() - req.body.issuedAt) > 120_000) return { id, status: "blocked", tier: "blocked", reasons: ["Stale request"] };
    if (this.nonces.has(req.body.nonce)) return { id, status: "blocked", tier: "blocked", reasons: ["Replayed request (nonce already used)"] };
    this.nonces.add(req.body.nonce);
    const hash = await sha256(canonical(req.body));
    const b = req.body;
    const inside = b.category === "groceries" && b.amount <= 3000 && this.spent + b.amount <= 12000 && b.payee === "FreshBasket";
    if (inside) {
      this.spent += b.amount;
      return { id, status: "approved", tier: "green", reasons: ["Inside mandate “groceries”"], hash, token: await this.issue(b, hash, "mandate:groceries") };
    }
    const reasons: string[] = [];
    if (b.category !== "groceries") reasons.push(`No mandate covers “${b.category}”`);
    else if (b.amount > 3000) reasons.push(`₹${b.amount.toLocaleString("en-IN")} is above the ₹3,000 limit`);
    if (b.payee !== "FreshBasket") reasons.push(`New payee: ${b.payee}`);
    this.pending.set(id, { body: b, hash });
    return { id, status: "pending", tier: "amber", reasons, hash };
  }

  /** The user's phone: the PIN unlocks the device key, which signs this exact request hash. */
  async approve(id: string, pin: string): Promise<Decision> {
    const p = this.pending.get(id);
    if (!p) throw new Error("Nothing waiting with that id");
    const secret = await unlock(this.device.locked, pin);
    const userSig = await sign(secret, p.hash);
    this.pending.delete(id);
    return { id, status: "approved", tier: "amber", reasons: ["Cosigned with PIN"], hash: p.hash, token: await this.issue(p.body, p.hash, "user:pin", userSig) };
  }

  private async issue(b: Body, reqHash: string, decidedBy: string, userSig?: string) {
    const iat = Date.now();
    const claims = { jti: `tok_${b64u(rand(6))}`, iss: "cosign", sub: b.user, agent: b.agentId, act: b.action, amt: b.amount, payee: b.payee, reqHash, decidedBy, userSig, tier: userSig ? "amber" : "green", iat, exp: iat + 5 * 60_000 };
    const head = `${b64u(enc.encode(canonical({ alg: "EdDSA", typ: "cosign+jwt" })))}.${b64u(enc.encode(canonical(claims)))}`;
    return `${head}.${await sign(this.issuer.secret, head)}`;
  }

  /** The mock bank: verifies the token offline with Cosign's public keys, then pays — or refuses. */
  async bankPay(p: { to: string; amount: number; token?: string }): Promise<{ ok: boolean; text: string }> {
    if (!p.token) return { ok: false, text: "Agent payments need a Cosign token" };
    const [h, c, s] = p.token.split(".");
    if (!h || !c || !s || !(await verify(this.issuer.pub, `${h}.${c}`, s))) return { ok: false, text: "Token signature is invalid — tampered or not issued by Cosign" };
    const claims = JSON.parse(dec.decode(fromB64u(c)));
    if (claims.exp <= Date.now()) return { ok: false, text: "Token expired" };
    if (this.used.has(claims.jti)) return { ok: false, text: "Token already used (replay)" };
    if (claims.payee !== p.to || claims.amt !== p.amount || claims.agent !== this.agentId || claims.sub !== this.user) return { ok: false, text: "Token doesn't match this exact payment" };
    if (claims.tier === "amber" && !(await verify(this.device.pub, claims.reqHash, claims.userSig ?? ""))) return { ok: false, text: "Missing or invalid device signature" };
    this.used.add(claims.jti);
    return { ok: true, text: `Paid ₹${p.amount.toLocaleString("en-IN")} to ${p.to} · decided by ${claims.decidedBy}` };
  }

  /** For the tamper demo: rewrite the amount inside a token without re-signing it. */
  static tamper(token: string, amount: number) {
    const [h, c, s] = token.split(".");
    const claims = JSON.parse(dec.decode(fromB64u(c!)));
    claims.amt = amount;
    return `${h}.${b64u(enc.encode(JSON.stringify(claims)))}.${s}`;
  }

  static randomKey() { return ed.utils.randomSecretKey(); }
}
