import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { AgentClient } from "../src/agent.js";
import { MockBank } from "../src/bank.js";
import { CosignService } from "../src/cosign.js";
import { b64u, fromB64u, newKeyPair, unlockWithPin } from "../src/crypto.js";

const USER = "kavya@cosign";
let clock = Date.UTC(2040, 9, 21, 9, 0);
const now = () => clock;

function setup() {
  clock = Date.UTC(2040, 9, 21, 9, 0);
  const cosign = new CosignService(now);
  cosign.registerUser(USER, "1234", {
    mandates: [{ id: "groceries", category: "groceries", maxPerAction: 3000, maxPerMonth: 12000, expiresAt: Date.UTC(2041, 2, 31) }],
    knownPayees: ["FreshBasket"],
  });
  const { agentId, privateKey } = cosign.registerAgent("Mitra", USER);
  const mitra = new AgentClient(agentId, privateKey, USER);
  const bank = new MockBank(() => cosign.publicKeys(), now);
  return { cosign, mitra, bank, agentId };
}

const groceries = { action: "payment" as const, amount: 2140, payee: "FreshBasket", category: "groceries", purpose: "Weekly groceries", reversible: true };
const insurance = { action: "payment" as const, amount: 18400, payee: "Suraksha General", category: "insurance", purpose: "Renew family health insurance", reversible: true };

describe("Cosign v0", () => {
  let s: ReturnType<typeof setup>;
  beforeEach(() => { s = setup(); });

  it("auto-approves a payment inside a mandate (green) and the bank executes it", () => {
    const d = s.cosign.submit(s.mitra.request(groceries, now()));
    assert.equal(d.tier, "green");
    assert.equal(d.status, "approved");
    const pay = s.bank.pay({ from: USER, to: "FreshBasket", amount: 2140, agentId: s.agentId, token: d.token });
    assert.equal(pay.ok, true);
  });

  it("holds a payment above the limit (amber) until the user enters the right PIN", () => {
    const d = s.cosign.submit(s.mitra.request(insurance, now()));
    assert.equal(d.tier, "amber");
    assert.equal(d.status, "pending");
    assert.equal(s.bank.pay({ from: USER, to: "Suraksha General", amount: 18400, agentId: s.agentId }).ok, false);
    assert.throws(() => s.cosign.approve(d.requestId, "0000"), /Wrong PIN/);
    const ok = s.cosign.approve(d.requestId, "1234");
    assert.equal(ok.status, "approved");
    assert.equal(s.bank.pay({ from: USER, to: "Suraksha General", amount: 18400, agentId: s.agentId, token: ok.token }).ok, true);
  });

  it("requires number-matching for irreversible data sharing (red)", () => {
    const d = s.cosign.submit(s.mitra.request({ action: "data_share", data: ["health records 2035-2040"], recipient: "FitLife Insurance", purpose: "Premium discount", reversible: false }, now()));
    assert.equal(d.tier, "red");
    assert.ok(d.numberMatch);
    assert.throws(() => s.cosign.approve(d.requestId, "1234", { numberMatch: "00" }), /doesn't match/);
    assert.equal(s.cosign.approve(d.requestId, "1234", { numberMatch: d.numberMatch }).status, "approved");
  });

  it("blocks requests from unregistered agents and forged signatures", () => {
    const rogueKeys = newKeyPair();
    const rogue = new AgentClient("agt_unknown", rogueKeys.privateKey, USER);
    assert.equal(s.cosign.submit(rogue.request(groceries, now())).status, "blocked");
    const forged = new AgentClient(s.agentId, rogueKeys.privateKey, USER); // right id, wrong key
    assert.equal(s.cosign.submit(forged.request(groceries, now())).status, "blocked");
  });

  it("blocks a request that was edited after the agent signed it", () => {
    const req = s.mitra.request(groceries, now());
    req.body.amount = 2999; // change after signing
    const d = s.cosign.submit(req);
    assert.equal(d.status, "blocked");
  });

  it("blocks replayed and stale requests", () => {
    const req = s.mitra.request(groceries, now());
    assert.equal(s.cosign.submit(req).status, "approved");
    assert.equal(s.cosign.submit(req).status, "blocked"); // same nonce
    const stale = s.mitra.request(groceries, now() - 10 * 60 * 1000);
    assert.equal(s.cosign.submit(stale).status, "blocked");
  });

  it("pauses an agent that floods requests", () => {
    let last;
    for (let i = 0; i < 6; i++) { clock += 1000; last = s.cosign.submit(s.mitra.request({ ...groceries, amount: 100 }, now())); }
    assert.equal(last!.status, "blocked");
    assert.match(last!.reasons[0]!, /Rate limit/);
    clock += 1000;
    assert.equal(s.cosign.submit(s.mitra.request({ ...groceries, amount: 100 }, now())).status, "blocked"); // still paused
  });

  it("bank rejects a tampered token, a reused token, the wrong payee or amount, and an expired token", () => {
    const d = s.cosign.submit(s.mitra.request(groceries, now()));
    const token = d.token!;
    const [h, p, sig] = token.split(".");
    const claims = JSON.parse(fromB64u(p!));
    claims.amt = 2999;
    const tampered = `${h}.${b64u(JSON.stringify(claims))}.${sig}`;
    assert.equal(s.bank.pay({ from: USER, to: "FreshBasket", amount: 2999, agentId: s.agentId, token: tampered }).ok, false);
    assert.equal(s.bank.pay({ from: USER, to: "Elsewhere", amount: 2140, agentId: s.agentId, token }).ok, false);
    assert.equal(s.bank.pay({ from: USER, to: "FreshBasket", amount: 2500, agentId: s.agentId, token }).ok, false);
    assert.equal(s.bank.pay({ from: USER, to: "FreshBasket", amount: 2140, agentId: s.agentId, token }).ok, true);
    assert.equal(s.bank.pay({ from: USER, to: "FreshBasket", amount: 2140, agentId: s.agentId, token }).ok, false); // replay
    const d2 = s.cosign.submit(s.mitra.request({ ...groceries, amount: 500 }, now()));
    clock += 6 * 60 * 1000;
    assert.equal(s.bank.pay({ from: USER, to: "FreshBasket", amount: 500, agentId: s.agentId, token: d2.token }).ok, false); // expired
  });

  it("flags a seller claim that failed verification even inside a mandate", () => {
    const d = s.cosign.submit(s.mitra.request({ ...groceries, sellerClaims: [{ claim: "Only 2 left", verified: false }] }, now()));
    assert.equal(d.tier, "amber");
    assert.ok(d.reasons.some((r) => r.includes("Only 2 left")));
  });

  it("keeps the device key locked: the stored key is useless without the PIN", () => {
    const locked = s.cosign._deviceLockFor(USER)!;
    assert.throws(() => unlockWithPin(locked, "9999"), /Wrong PIN/);
  });

  it("detects any edit to the receipt log", () => {
    s.cosign.submit(s.mitra.request(groceries, now()));
    s.cosign.submit(s.mitra.request(insurance, now()));
    assert.deepEqual(s.cosign.receipts.verify(), { ok: true });
    s.cosign.receipts.entries[0]!.summary = "Pay ₹1 to FreshBasket";
    assert.deepEqual(s.cosign.receipts.verify(), { ok: false, brokenAt: 0 });
  });
});
