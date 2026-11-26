/** Input validation for the HTTP API. Bad or oversized input gets a clear 400 instead of reaching the engine. */
import { z } from "zod";

const text = (max: number) => z.string().trim().min(1).max(max);
const address = z.string().regex(/^[a-z0-9._-]{2,40}@cosign$/, "Use an address like name@cosign");
const rupees = z.number().positive().max(10_000_000);

export const SignedRequestSchema = z.object({
  body: z.object({
    agentId: text(60),
    user: address,
    action: z.enum(["payment", "data_share", "contract"]),
    purpose: text(200),
    reversible: z.boolean(),
    amount: rupees.optional(),
    payee: text(80).optional(),
    category: text(40).optional(),
    data: z.array(text(80)).max(20).optional(),
    recipient: text(80).optional(),
    sellerClaims: z.array(z.object({ claim: text(120), kind: z.literal("stock").optional(), value: z.number().nonnegative().optional(), verified: z.boolean().optional() })).max(10).optional(),
    nonce: text(64),
    issuedAt: z.number().int().positive(),
  }).superRefine((b, ctx) => {
    if (b.action === "payment" && (b.amount === undefined || !b.payee)) ctx.addIssue({ code: "custom", message: "Payments need amount and payee" });
    if (b.action !== "payment" && !b.recipient) ctx.addIssue({ code: "custom", message: "Data sharing and contracts need a recipient" });
  }),
  signature: text(200),
});

export const ApproveSchema = z.object({ pin: z.string().regex(/^\d{4}$/, "PIN must be 4 digits"), numberMatch: z.string().regex(/^\d{2}$/).optional() });
export const AgentSchema = z.object({ name: text(60), user: address });
export const MandateSchema = z.object({ id: text(40), category: text(40), maxPerAction: rupees, maxPerMonth: rupees, expiresAt: z.number().int().positive(), payees: z.array(text(80)).max(50).optional() });
export const MandateStateSchema = z.object({ state: z.enum(["active", "paused", "revoked"]) });
export const PaySchema = z.object({ from: address, to: text(80), amount: rupees, agentId: text(60), token: z.string().max(4000).optional() });
export const ReleaseSchema = z.object({ subject: address, recipient: text(80), fields: z.array(text(80)).min(1).max(20), agentId: text(60), token: z.string().max(4000).optional() });
export const SignContractSchema = z.object({ party: address, counterparty: text(80), agentId: text(60), token: z.string().max(4000).optional() });
export const DisputeSchema = z.object({ reason: text(300) });

/** Parse or throw a readable error. */
export function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const r = schema.safeParse(input);
  if (!r.success) throw new Error(`Invalid input: ${r.error.issues.map((i) => `${i.path.join(".") || "body"} — ${i.message}`).join("; ")}`);
  return r.data;
}
