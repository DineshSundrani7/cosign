/**
 * MockBank — the enforcement point.
 *
 * Cosign can't physically stop an agent. What stops it is that the bank (or rail, or merchant)
 * refuses to execute an agent-initiated action without a valid Cosign token. The bank verifies
 * the token on its own, using only Cosign's published public keys — no call back to Cosign needed.
 */
import { fromB64u, verifyText } from "./crypto.js";
import type { PublicKeys } from "./cosign.js";
import type { TokenClaims } from "./types.js";

export interface PaymentInstruction { from: string; to: string; amount: number; agentId: string; token?: string }
export type PaymentResult = { ok: true; txnId: string; decidedBy: string } | { ok: false; reason: string };

export function verifyToken(token: string, keys: PublicKeys, now = Date.now()): { ok: true; claims: TokenClaims } | { ok: false; reason: string } {
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "Malformed token" };
  const [h, p, sig] = parts as [string, string, string];
  if (!verifyText(keys.issuer, `${h}.${p}`, sig)) return { ok: false, reason: "Token signature is invalid (tampered or not issued by Cosign)" };
  let claims: TokenClaims;
  try { claims = JSON.parse(fromB64u(p)); } catch { return { ok: false, reason: "Unreadable token" }; }
  if (claims.exp <= now) return { ok: false, reason: "Token expired" };
  if (claims.tier !== "green") {
    const device = keys.devices[claims.sub];
    if (!device || !claims.userSig || !verifyText(device, claims.reqHash, claims.userSig)) return { ok: false, reason: "Missing or invalid user signature for an amber/red action" };
  }
  return { ok: true, claims };
}

export class MockBank {
  private readonly used = new Set<string>();
  private txn = 0;
  constructor(private readonly keys: () => PublicKeys, private readonly now: () => number = Date.now) {}

  pay(p: PaymentInstruction): PaymentResult {
    if (!p.token) return { ok: false, reason: "Agent-initiated payments need a Cosign token" };
    const v = verifyToken(p.token, this.keys(), this.now());
    if (!v.ok) return v;
    const c = v.claims;
    if (this.used.has(c.jti)) return { ok: false, reason: "Token already used (replay)" };
    if (c.act !== "payment") return { ok: false, reason: "Token doesn't authorise a payment" };
    if (c.sub !== p.from) return { ok: false, reason: "Token is for a different account holder" };
    if (c.agent !== p.agentId) return { ok: false, reason: "Token was issued to a different agent" };
    if (c.payee !== p.to) return { ok: false, reason: `Token approves paying ${c.payee}, not ${p.to}` };
    if (c.amt !== p.amount) return { ok: false, reason: `Token approves ₹${c.amt}, not ₹${p.amount}` };
    this.used.add(c.jti);
    this.txn += 1;
    return { ok: true, txnId: `TXN-${String(this.txn).padStart(5, "0")}`, decidedBy: c.decidedBy };
  }
}
