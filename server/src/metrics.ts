/**
 * Product metrics computed straight from the receipt log — the same numbers the case study promises.
 *   asksPerWeek           requests that needed a person, last 7 days      (target ≤ 10)
 *   medianDecisionSeconds time from "waiting" to a decision              (5–30 s is healthy; < 3 s suggests blind tapping)
 *   regretRate            approved payments later undone or disputed      (should fall over time)
 *   attacksBlocked        requests stopped at the gateway
 *   protectedActionRate   amber/red approvals that carry a person's cosign (North Star; 100% by construction in v0 —
 *                         in production it is measured at the executor, against agent actions that skipped Cosign)
 */
import type { Receipt } from "./receipts.js";

export interface Metrics {
  user?: string;
  decisions: number;
  autoApproved: number;
  asksPerWeek: number;
  medianDecisionSeconds: number | null;
  regretRate: number | null;
  attacksBlocked: number;
  protectedActionRate: number | null;
}

export function computeMetrics(receipts: Receipt[], now: number, user?: string): Metrics {
  const mine = user ? receipts.filter((r) => r.user === user) : receipts;
  const weekAgo = now - 7 * 864e5;
  const pendingAt = new Map<string, number>();
  const decisionTimes: number[] = [];
  let auto = 0, byPerson = 0, cosigned = 0, undone = 0, disputed = 0, blocked = 0, asks = 0, approvedPayments = 0;
  const regretted = new Set<string>();

  for (const r of mine) {
    if (r.event === "pending" && r.requestId) { pendingAt.set(r.requestId, r.at); if (r.at >= weekAgo) asks++; }
    if (r.event === "approved") {
      if (r.decidedBy?.startsWith("mandate:")) auto++;
      else { byPerson++; if (r.decidedBy?.startsWith("user:") || r.decidedBy?.startsWith("circle:")) cosigned++; }
      if (r.summary.startsWith("Pay ")) approvedPayments++;
    }
    if ((r.event === "approved" || r.event === "declined") && r.requestId && pendingAt.has(r.requestId)) decisionTimes.push((r.at - pendingAt.get(r.requestId)!) / 1000);
    if (r.event === "undone" && r.requestId) { undone++; regretted.add(r.requestId); }
    if (r.event === "disputed" && r.requestId) { disputed++; regretted.add(r.requestId); }
    if (r.event === "blocked") blocked++;
  }
  decisionTimes.sort((a, b) => a - b);
  const median = decisionTimes.length ? decisionTimes[Math.floor((decisionTimes.length - 1) / 2)]! : null;
  return {
    user,
    decisions: auto + byPerson,
    autoApproved: auto,
    asksPerWeek: asks,
    medianDecisionSeconds: median === null ? null : Math.round(median * 10) / 10,
    regretRate: approvedPayments ? Math.round((regretted.size / approvedPayments) * 1000) / 10 : null, // percent
    attacksBlocked: blocked,
    protectedActionRate: byPerson ? Math.round((cosigned / byPerson) * 1000) / 10 : null, // percent
  };
}
