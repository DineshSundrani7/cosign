/**
 * npm run mcp — connects a real AI assistant (e.g. Claude Desktop) to Cosign over MCP.
 * The assistant must call request_cosign before paying, then check_cosign, then pay.
 * Start the API first (npm start); set COSIGN_URL if it isn't on http://localhost:8787.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { AgentClient } from "./agent.js";

const BASE = process.env.COSIGN_URL ?? "http://localhost:8787";
const USER = process.env.COSIGN_USER ?? "kavya@cosign";

const api = async (path: string, body?: unknown) => {
  const r = await fetch(BASE + path, body === undefined ? undefined : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return r.json() as Promise<any>;
};
const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });

let agent: AgentClient | undefined;
const pending = new Map<string, { payee: string; amount: number }>();
async function me() {
  if (!agent) {
    const r = await fetch(BASE + "/agents", { method: "POST", headers: { "content-type": "application/json", ...(process.env.COSIGN_ADMIN_TOKEN ? { authorization: `Bearer ${process.env.COSIGN_ADMIN_TOKEN}` } : {}) }, body: JSON.stringify({ name: "Claude assistant", user: USER }) });
    const { agentId, privateKey } = (await r.json()) as { agentId: string; privateKey: string };
    agent = new AgentClient(agentId, privateKey, USER);
  }
  return agent;
}

const server = new McpServer({ name: "cosign", version: "0.1.0" });

server.registerTool(
  "request_cosign",
  {
    title: "Ask the user to cosign a payment",
    description: "Call this BEFORE making any payment for the user. Small payments inside the user's limits are approved instantly; others wait for the user to approve with their PIN.",
    inputSchema: { amount: z.number().positive(), payee: z.string(), category: z.string().describe("e.g. groceries, insurance, travel"), purpose: z.string() },
  },
  async ({ amount, payee, category, purpose }) => {
    const a = await me();
    const d = await api("/requests", a.request({ action: "payment", amount, payee, category, purpose, reversible: true }));
    if (d.status === "approved") { pending.set(d.requestId, { payee, amount }); return text(`Approved instantly (${d.tier}: ${d.reasons.join("; ")}). Request ${d.requestId}. Call pay with this requestId.`); }
    if (d.status === "pending") { pending.set(d.requestId, { payee, amount }); return text(`Waiting for the user's cosign (${d.tier}: ${d.reasons.join("; ")}). Ask the user to open ${BASE}/approve/${d.requestId} and enter their PIN, then call check_cosign with requestId ${d.requestId}.`); }
    return text(`Blocked by Cosign: ${d.reasons.join("; ")}`);
  },
);

server.registerTool(
  "check_cosign",
  { title: "Wait for the user's cosign", description: "Waits up to 20 seconds for the user to decide, then returns the status of the cosign request.", inputSchema: { requestId: z.string() } },
  async ({ requestId }) => {
    const r = await api(`/requests/${requestId}/wait?timeout=20`);
    return text(r.error ? r.error : `Status: ${r.status} (${r.tier}).${r.status === "approved" ? " You may now call pay." : ""}`);
  },
);

server.registerTool(
  "pay",
  { title: "Pay through the bank", description: "Executes the payment at the (mock) bank. The bank refuses without a valid cosign token.", inputSchema: { requestId: z.string() } },
  async ({ requestId }) => {
    const a = await me();
    const info = pending.get(requestId);
    if (!info) return text("Unknown requestId — call request_cosign first.");
    const r = await api(`/requests/${requestId}`);
    const result = await api("/bank/pay", { from: USER, to: info.payee, amount: info.amount, agentId: a.agentId, token: r.token });
    return text(result.ok ? `Paid ₹${info.amount} to ${info.payee}. Bank reference ${result.txnId}.` : `Bank refused: ${result.reason}`);
  },
);

await server.connect(new StdioServerTransport());
