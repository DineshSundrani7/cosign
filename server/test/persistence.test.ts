import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, it } from "node:test";
import { AgentClient } from "../src/agent.js";
import { createApp } from "../src/server.js";

const dir = mkdtempSync(join(tmpdir(), "cosign-"));
after(() => rmSync(dir, { recursive: true, force: true }));
const db = join(dir, "test.db");

async function start(adminToken?: string) {
  const app = createApp({ dbPath: db, adminToken });
  await new Promise<void>((r) => app.listen(0, () => r()));
  const base = `http://localhost:${(app.address() as AddressInfo).port}`;
  const post = (p: string, b: unknown, h: Record<string, string> = {}) => fetch(base + p, { method: "POST", headers: { "content-type": "application/json", ...h }, body: JSON.stringify(b) }).then(async (r) => ({ status: r.status, body: (await r.json()) as any }));
  const get = (p: string) => fetch(base + p).then((r) => r.json() as Promise<any>);
  const stop = () => new Promise<void>((r) => app.close(() => r()));
  return { post, get, stop };
}

it("keeps requests, approvals, used tokens and receipts across a restart (SQLite)", async () => {
  const a = await start("secret");
  assert.equal((await a.post("/agents", { name: "Mitra", user: "kavya@cosign" })).status, 401); // admin token required
  const { agentId, privateKey } = (await a.post("/agents", { name: "Mitra", user: "kavya@cosign" }, { authorization: "Bearer secret" })).body;
  const mitra = new AgentClient(agentId, privateKey, "kavya@cosign");
  const d = (await a.post("/requests", mitra.request({ action: "payment", amount: 18400, payee: "Suraksha General", category: "insurance", purpose: "Renew insurance", reversible: true }))).body;
  const waiting = a.get(`/requests/${d.requestId}/wait?timeout=5`); // an agent waiting for the decision
  await a.post(`/requests/${d.requestId}/approve`, { pin: "1234" });
  assert.equal((await waiting).status, "approved");
  const token = (await a.get(`/requests/${d.requestId}`)).token;
  assert.equal((await a.post("/bank/pay", { from: "kavya@cosign", to: "Suraksha General", amount: 18400, agentId, token })).body.ok, true);
  const before = await a.get("/receipts");
  await a.stop();

  const b = await start("secret"); // same database, fresh process state
  assert.equal((await b.get(`/requests/${d.requestId}`)).status, "approved");
  const after = await b.get("/receipts");
  assert.equal(after.entries.length, before.entries.length);
  assert.deepEqual(after.chain, { ok: true });
  assert.equal((await b.post("/bank/pay", { from: "kavya@cosign", to: "Suraksha General", amount: 18400, agentId, token })).body.reason, "Token already used (replay)");
  const d2 = (await b.post("/requests", mitra.request({ action: "payment", amount: 2000, payee: "FreshBasket", category: "groceries", purpose: "Groceries", reversible: true }))).body;
  assert.equal(d2.tier, "green"); // the agent registered before the restart still works
  await b.stop();
});
