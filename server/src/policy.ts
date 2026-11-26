/**
 * The policy engine: decides who has to look at a request.
 *   green   inside a standing mandate -> signed automatically
 *   amber   payment outside a mandate, new payee or failed seller claim -> needs the user's PIN
 *   red     can't be undone (data sharing, contracts, irreversible) -> PIN + number-match
 * "blocked" is decided earlier, by the gateway (bad signature, unknown agent, replay, flood).
 */
import type { Mandate, RequestBody, Tier } from "./types.js";

export interface PolicyContext {
  mandates: Mandate[];
  knownPayees: Set<string>;
  now: number;
}

export interface PolicyResult {
  tier: Exclude<Tier, "blocked">;
  reasons: string[];
  mandate?: Mandate;
}

export function evaluate(body: RequestBody, ctx: PolicyContext): PolicyResult {
  if (body.action === "data_share") return { tier: "red", reasons: [`Shares personal data (${(body.data ?? []).join(", ") || "unspecified"}) with ${body.recipient ?? "an unknown recipient"} — can't be taken back`] };
  if (body.action === "contract") return { tier: "red", reasons: [`Signs a contract with ${body.recipient ?? "an unknown party"}`] };
  if (!body.reversible) return { tier: "red", reasons: ["The agent marked this action as irreversible"] };

  const reasons: string[] = [];
  const amount = body.amount ?? 0;
  const failedClaims = (body.sellerClaims ?? []).filter((c) => !c.verified);
  for (const c of failedClaims) reasons.push(`Seller claim failed verification: “${c.claim}”`);

  const candidates = ctx.mandates.filter((m) => m.category === body.category);
  if (candidates.length === 0) reasons.push(`No mandate covers “${body.category ?? "uncategorised"}”`);

  let match: Mandate | undefined;
  for (const m of candidates) {
    if (m.expiresAt <= ctx.now) { reasons.push(`Mandate “${m.id}” has expired`); continue; }
    if (amount > m.maxPerAction) { reasons.push(`₹${amount.toLocaleString("en-IN")} is above the ₹${m.maxPerAction.toLocaleString("en-IN")} per-action limit`); continue; }
    if (m.spentThisMonth + amount > m.maxPerMonth) { reasons.push("Monthly limit for this mandate would be exceeded"); continue; }
    if (m.payees && body.payee && !m.payees.includes(body.payee)) { reasons.push(`${body.payee} isn't on this mandate's payee list`); continue; }
    match = m;
    break;
  }
  if (body.payee && !ctx.knownPayees.has(body.payee)) reasons.push(`New payee: ${body.payee}`);

  if (match && failedClaims.length === 0 && ctx.knownPayees.has(body.payee ?? "")) {
    return { tier: "green", reasons: [`Inside mandate “${match.id}”`], mandate: match };
  }
  return { tier: "amber", reasons };
}
