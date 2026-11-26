/**
 * Mock executors for the other two kinds of action Cosign covers.
 * Like the bank, each one verifies the Cosign token offline and refuses anything that doesn't match exactly.
 *
 *  MockDataHolder   — e.g. a hospital or a DPDP consent manager releasing personal data
 *  MockContractDesk — e.g. an e-sign provider applying a signature to a contract
 */
import { verifyToken } from "./bank.js";
import type { PublicKeys } from "./cosign.js";

type Result = { ok: true; ref: string; decidedBy: string; released?: string[] } | { ok: false; reason: string };

export class MockDataHolder {
  private readonly used = new Set<string>();
  private n = 0;
  constructor(readonly name: string, private readonly keys: () => PublicKeys, private readonly now: () => number = Date.now) {}

  /** Release `fields` about `subject` to `recipient`, on behalf of an agent. */
  release(p: { subject: string; recipient: string; fields: string[]; agentId: string; token?: string }): Result {
    if (!p.token) return { ok: false, reason: `${this.name} releases personal data to agents only with a Cosign token` };
    const v = verifyToken(p.token, this.keys(), this.now());
    if (!v.ok) return v;
    const c = v.claims;
    if (this.used.has(c.jti)) return { ok: false, reason: "Token already used (replay)" };
    if (c.act !== "data_share") return { ok: false, reason: "Token doesn't authorise sharing data" };
    if (c.sub !== p.subject) return { ok: false, reason: "Token is for a different person" };
    if (c.agent !== p.agentId) return { ok: false, reason: "Token was issued to a different agent" };
    if (c.recipient !== p.recipient) return { ok: false, reason: `Token approves sharing with ${c.recipient}, not ${p.recipient}` };
    const allowed = new Set(c.data ?? []);
    const extra = p.fields.filter((f) => !allowed.has(f));
    if (extra.length) return { ok: false, reason: `Not approved: ${extra.join(", ")}` };
    this.used.add(c.jti);
    this.n += 1;
    return { ok: true, ref: `CONSENT-${String(this.n).padStart(4, "0")}`, decidedBy: c.decidedBy, released: p.fields };
  }
}

export class MockContractDesk {
  private readonly used = new Set<string>();
  private n = 0;
  constructor(private readonly keys: () => PublicKeys, private readonly now: () => number = Date.now) {}

  sign(p: { party: string; counterparty: string; agentId: string; token?: string }): Result {
    if (!p.token) return { ok: false, reason: "Contracts proposed by agents need a Cosign token" };
    const v = verifyToken(p.token, this.keys(), this.now());
    if (!v.ok) return v;
    const c = v.claims;
    if (this.used.has(c.jti)) return { ok: false, reason: "Token already used (replay)" };
    if (c.act !== "contract") return { ok: false, reason: "Token doesn't authorise signing a contract" };
    if (c.sub !== p.party || c.agent !== p.agentId) return { ok: false, reason: "Token is for a different person or agent" };
    if (c.recipient !== p.counterparty) return { ok: false, reason: `Token approves a contract with ${c.recipient}, not ${p.counterparty}` };
    this.used.add(c.jti);
    this.n += 1;
    return { ok: true, ref: `ESIGN-${String(this.n).padStart(4, "0")}`, decidedBy: c.decidedBy };
  }
}
