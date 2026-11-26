import assert from "node:assert/strict";
import { after, before, it } from "node:test";
import type { AddressInfo } from "node:net";
import { AgentClient } from "../src/agent.js";
import { createApp } from "../src/server.js";

const app = createApp();
let base = "";
before(() => new Promise<void>((r) => app.listen(0, () => { base = `http://localhost:${(app.address() as AddressInfo).port}`; r(); })));
after(() => app.close());
const post = (p: string, b: unknown) => fetch(base + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }).then(async (r) => ({ code: r.status, ...((await r.json()) as any) }));

async function agent(name: string) {
  const { agentId, privateKey } = await post("/agents", { name, user: "kavya@cosign" });
  return { agentId, client: new AgentClient(agentId, privateKey, "kavya@cosign") };
}

it("hospital releases health data only with a matching red-tier token, and only once", async () => {
  const { agentId, client } = await agent("Mitra");
  const d = await post("/requests", client.request({ action: "data_share", data: ["blood reports 2026"], recipient: "FitLife Insurance", purpose: "Premium discount", reversible: false }));
  assert.equal(d.tier, "red");
  const release = (extra: Record<string, unknown> = {}) => post("/data/release", { subject: "kavya@cosign", recipient: "FitLife Insurance", fields: ["blood reports 2026"], agentId, ...extra });

  assert.match((await release()).reason, /only with a Cosign token/);
  assert.match((await post(`/requests/${d.requestId}/approve`, { pin: "1234", numberMatch: d.numberMatch === "11" ? "12" : "11" })).error, /Number doesn't match/);
  const ok = await post(`/requests/${d.requestId}/approve`, { pin: "1234", numberMatch: d.numberMatch });
  assert.equal(ok.status, "approved");

  assert.match((await release({ token: ok.token, recipient: "QuickLoans" })).reason, /not QuickLoans/);
  assert.match((await release({ token: ok.token, fields: ["blood reports 2026", "full medical history"] })).reason, /Not approved: full medical history/);
  const good = await release({ token: ok.token });
  assert.equal(good.ok, true);
  assert.deepEqual(good.released, ["blood reports 2026"]);
  assert.match((await release({ token: ok.token })).reason, /replay/);
});

it("e-sign desk signs a contract only with a contract token for that counterparty", async () => {
  const { agentId, client } = await agent("Sakhi");
  const d = await post("/requests", client.request({ action: "contract", recipient: "HomeFix Services", purpose: "12-month maintenance plan", reversible: false }));
  assert.equal(d.tier, "red");
  const ok = await post(`/requests/${d.requestId}/approve`, { pin: "1234", numberMatch: d.numberMatch });
  assert.match((await post("/contracts/sign", { party: "kavya@cosign", counterparty: "Other Co", agentId, token: ok.token })).reason, /not Other Co/);
  assert.equal((await post("/contracts/sign", { party: "kavya@cosign", counterparty: "HomeFix Services", agentId, token: ok.token })).ok, true);
  // A payment token can't be reused to release data
  assert.match((await post("/data/release", { subject: "kavya@cosign", recipient: "HomeFix Services", fields: ["x"], agentId, token: ok.token })).reason, /doesn't authorise sharing data/);
});

it("rejects malformed input with a clear 400", async () => {
  const bad1 = await post("/requests", { body: { user: "not-an-address" }, signature: "x" });
  assert.equal(bad1.code, 400);
  assert.match(bad1.error, /Invalid input/);
  const { client } = await agent("Mitra2");
  const noAmount = client.request({ action: "payment", payee: "X", purpose: "Pay", reversible: true } as any);
  assert.match((await post("/requests", noAmount)).error, /Payments need amount and payee/);
  assert.match((await post("/requests/whatever/approve", { pin: "12" })).error, /PIN must be 4 digits/);
});

it("reports live metrics from the receipt log", async () => {
  const { client } = await agent("Mitra3");
  const g = await post("/requests", client.request({ action: "payment", amount: 900, payee: "FreshBasket", category: "groceries", purpose: "Weekly groceries", reversible: true }));
  assert.equal(g.status, "approved");
  assert.equal((await post(`/requests/${g.requestId}/undo`, {})).status, "undone");
  const m = (await fetch(`${base}/metrics?user=kavya@cosign`).then((r) => r.json())) as any;
  assert.ok(m.decisions >= 3);
  assert.ok(m.autoApproved >= 1);
  assert.ok(m.regretRate > 0, "the undone grocery order counts as a regret");
  assert.equal(m.protectedActionRate, 100);
  const spec = await fetch(`${base}/openapi.yaml`).then((r) => r.text());
  assert.match(spec, /openapi: 3\.1/);
});
