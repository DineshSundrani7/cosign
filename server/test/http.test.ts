import assert from "node:assert/strict";
import { after, before, it } from "node:test";
import type { AddressInfo } from "node:net";
import { AgentClient } from "../src/agent.js";
import { createApp } from "../src/server.js";

const app = createApp();
let base = "";
before(() => new Promise<void>((r) => app.listen(0, () => { base = `http://localhost:${(app.address() as AddressInfo).port}`; r(); })));
after(() => app.close());
const post = (p: string, b: unknown) => fetch(base + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }).then((r) => r.json() as Promise<any>);

it("runs the full flow over HTTP: request → pending → approve with PIN → bank pays → receipts intact", async () => {
  const { agentId, privateKey } = await post("/agents", { name: "Mitra", user: "kavya@cosign" });
  const mitra = new AgentClient(agentId, privateKey, "kavya@cosign");
  const d = await post("/requests", mitra.request({ action: "payment", amount: 18400, payee: "Suraksha General", category: "insurance", purpose: "Renew insurance", reversible: true }));
  assert.equal(d.status, "pending");
  const page = await fetch(`${base}/approve/${d.requestId}`).then((r) => r.text());
  assert.match(page, /Cosign PIN/);
  const bad = await post(`/requests/${d.requestId}/approve`, { pin: "0000" });
  assert.match(bad.error, /Wrong PIN/);
  const ok = await post(`/requests/${d.requestId}/approve`, { pin: "1234" });
  assert.equal(ok.status, "approved");
  const paid = await post("/bank/pay", { from: "kavya@cosign", to: "Suraksha General", amount: 18400, agentId, token: ok.token });
  assert.equal(paid.ok, true);
  const receipts = await fetch(`${base}/receipts`).then((r) => r.json() as Promise<any>);
  assert.deepEqual(receipts.chain, { ok: true });
});
