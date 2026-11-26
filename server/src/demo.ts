/**
 * npm run demo — plays Kavya's week end to end in the terminal.
 * Every check below is real: signatures, PIN unlock, token verification, replay and tamper detection.
 * Only the money and the bank are simulated.
 */
import { AgentClient } from "./agent.js";
import { MockBank } from "./bank.js";
import { CosignService } from "./cosign.js";
import { b64u, fromB64u, newKeyPair } from "./crypto.js";
import { MockDataHolder } from "./executors.js";

const c = { g: "\x1b[32m", r: "\x1b[31m", y: "\x1b[33m", m: "\x1b[35m", b: "\x1b[1m", d: "\x1b[2m", x: "\x1b[0m" };
const tierColor = { green: c.g, amber: c.y, red: c.r, blocked: c.r } as const;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, process.env.FAST ? 0 : ms));
const title = async (t: string) => { await sleep(500); console.log(`\n${c.b}${c.m}▸ ${t}${c.x}`); };
const ok = (t: string) => console.log(`  ${c.g}✓${c.x} ${t}`);
const no = (t: string) => console.log(`  ${c.r}✗${c.x} ${t}`);
const info = (t: string) => console.log(`  ${c.d}${t}${c.x}`);

const USER = "kavya@cosign";
const cosign = new CosignService();
cosign.registerUser(USER, "1234", {
  mandates: [{ id: "groceries", category: "groceries", maxPerAction: 3000, maxPerMonth: 12000, expiresAt: Date.now() + 90 * 864e5 }],
  knownPayees: ["FreshBasket"],
});
const { agentId, privateKey } = cosign.registerAgent("Mitra", USER);
const mitra = new AgentClient(agentId, privateKey, USER);
cosign.registerUser("sunanda@cosign", "4321", {
  circleApprover: USER,
  mandates: [{ id: "solo", category: "*", maxPerAction: 1000, maxPerMonth: 5000, expiresAt: Date.now() + 365 * 864e5 }],
  knownPayees: ["CarePlus Pharmacy"],
});
cosign.setMerchantStock("FreshBasket", 38);
const bank = new MockBank(() => cosign.publicKeys());

const show = (d: ReturnType<typeof cosign.submit>) =>
  console.log(`  Cosign: ${tierColor[d.tier]}${c.b}${d.tier.toUpperCase()}${c.x} · ${d.status}${d.reasons.length ? ` — ${d.reasons.join("; ")}` : ""}`);
const bankSays = (r: ReturnType<typeof bank.pay>) => (r.ok ? ok(`Bank executed ${r.txnId} (decided by ${r.decidedBy})`) : no(`Bank refused: ${r.reason}`));

console.log(`${c.b}Cosign v0 — your agent proposes, you cosign${c.x}`);
info(`User ${USER} · PIN-locked device key · mandate: groceries ≤ ₹3,000 per order`);
info(`Agent “Mitra” registered with its own Ed25519 key (${agentId})`);

await title("1. Groceries ₹2,140 — inside the mandate");
const d1 = cosign.submit(mitra.request({ action: "payment", amount: 2140, payee: "FreshBasket", category: "groceries", purpose: "Weekly groceries", reversible: true }));
show(d1);
bankSays(bank.pay({ from: USER, to: "FreshBasket", amount: 2140, agentId, token: d1.token }));

await title("2. A seller tells the agent “only 2 left”");
const dS = cosign.submit(mitra.request({ action: "payment", amount: 1800, payee: "FreshBasket", category: "groceries", purpose: "Dry fruits offer", reversible: true, sellerClaims: [{ claim: "Only 2 left — buy now", kind: "stock", value: 2 }] }));
info("Cosign checks the seller's own stock feed: 38 in stock");
show(dS);
cosign.decline(dS.requestId);
ok("Kavya says no in one tap");

await title("3. Health insurance ₹18,400 — above every limit");
const d2 = cosign.submit(mitra.request({ action: "payment", amount: 18400, payee: "Suraksha General", category: "insurance", purpose: "Renew family health insurance", reversible: true }));
show(d2);
info("Agent tries to pay before Kavya decides…");
bankSays(bank.pay({ from: USER, to: "Suraksha General", amount: 18400, agentId }));
info("Kavya types the wrong PIN on her phone…");
try { cosign.approve(d2.requestId, "0000"); } catch (e) { no((e as Error).message); }
info("Kavya types the right PIN — her phone's key signs this exact request");
const a2 = cosign.approve(d2.requestId, "1234");
ok(`Approved · token valid 5 minutes, single use, ₹18,400 to Suraksha General only`);
bankSays(bank.pay({ from: USER, to: "Suraksha General", amount: 18400, agentId, token: a2.token }));

await title("4. Attacks on the token");
info("Someone replays the same token…");
bankSays(bank.pay({ from: USER, to: "Suraksha General", amount: 18400, agentId, token: a2.token }));
const d3 = cosign.submit(mitra.request({ action: "payment", amount: 900, payee: "FreshBasket", category: "groceries", purpose: "Top-up", reversible: true }));
const [h, p, s] = d3.token!.split(".");
const claims = JSON.parse(fromB64u(p!)); claims.amt = 2900; claims.payee = "refund-desk";
info("Someone edits a ₹900 token to pay ₹2,900 to “refund-desk”…");
bankSays(bank.pay({ from: USER, to: "refund-desk", amount: 2900, agentId, token: `${h}.${b64u(JSON.stringify(claims))}.${s}` }));
info("Someone uses the ₹900 token to pay a different shop…");
bankSays(bank.pay({ from: USER, to: "OtherShop", amount: 900, agentId, token: d3.token }));

await title("5. Share 5 years of health records — irreversible");
const d4 = cosign.submit(mitra.request({ action: "data_share", data: ["health records 2035–2040"], recipient: "FitLife Insurance", purpose: "₹3,000 premium discount", reversible: false }));
show(d4);
info(`Mitra's screen shows the number ${c.b}${d4.numberMatch}${c.x}${c.d}; Kavya must pick the same number`);
try { cosign.approve(d4.requestId, "1234", { numberMatch: "11" === d4.numberMatch ? "12" : "11" }); } catch (e) { no((e as Error).message); }
const a4 = cosign.approve(d4.requestId, "1234", { numberMatch: d4.numberMatch });
ok("Approved with PIN + number-match");
const hospital = new MockDataHolder("CityCare Hospital", () => cosign.publicKeys());
const ask = (fields: string[], recipient = "FitLife Insurance") => hospital.release({ subject: USER, recipient, fields, agentId, token: a4.token });
const hs = (r: ReturnType<typeof ask>) => (r.ok ? ok(`CityCare Hospital released ${r.released?.join(", ")} (${r.ref})`) : no(`CityCare Hospital refused: ${r.reason}`));
hs(ask(["health records 2035–2040", "full medical history"]));
hs(ask(["health records 2035–2040"], "QuickLoans"));
hs(ask(["health records 2035–2040"]));
hs(ask(["health records 2035–2040"]));

await title("6. Hijack — hidden text on a web page tries to pay ₹9,999");
const rogue = new AgentClient("agt_unknown", newKeyPair().privateKey, USER);
show(cosign.submit(rogue.request({ action: "payment", amount: 9999, payee: "refund-desk", category: "refund", purpose: "Pending refund", reversible: true })));
const forged = mitra.request({ action: "payment", amount: 500, payee: "FreshBasket", category: "groceries", purpose: "Snacks", reversible: true });
forged.body.amount = 2999; forged.body.payee = "refund-desk";
info("A request signed by Mitra, edited in transit…");
show(cosign.submit(forged));

await title("7. Flood — a lender's agent fires request after request");
const lender = cosign.registerAgent("QuickLoan agent", USER);
const ql = new AgentClient(lender.agentId, lender.privateKey, USER);
let last;
for (let i = 0; i < 6; i++) last = cosign.submit(ql.request({ action: "contract", recipient: "QuickLoan", purpose: `Pre-approved loan offer ${i + 1}`, reversible: false }));
show(last!);

await title("8. Family Circle — Kavya's mother's agent wants ₹6,200 for physio");
const sakhiKeys = cosign.registerAgent("Sakhi", "sunanda@cosign");
const sakhi = new AgentClient(sakhiKeys.agentId, sakhiKeys.privateKey, "sunanda@cosign");
const med = cosign.submit(sakhi.request({ action: "payment", amount: 960, payee: "CarePlus Pharmacy", category: "medicines", purpose: "Monthly medicines", reversible: true }));
info("Medicines ₹960 — inside Sunanda's own ₹1,000 limit:"); show(med);
const physio = cosign.submit(sakhi.request({ action: "payment", amount: 6200, payee: "Nagpur Physio Care", category: "health", purpose: "Knee brace + 6 physio visits", reversible: true }));
info("Physio ₹6,200 — above her limit, so it goes to Kavya:"); show(physio);
try { cosign.approve(physio.requestId, "4321"); } catch (e) { no(`Sunanda's own PIN can't approve it: ${(e as Error).message}`); }
const pa = cosign.approve(physio.requestId, "1234");
ok("Kavya cosigns from her phone");
bankSays(bank.pay({ from: "sunanda@cosign", to: "Nagpur Physio Care", amount: 6200, agentId: sakhiKeys.agentId, token: pa.token }));

await title("9. Undo — Sakhi accidentally orders the medicines twice");
const oops = cosign.submit(sakhi.request({ action: "payment", amount: 960, payee: "CarePlus Pharmacy", category: "medicines", purpose: "Monthly medicines (duplicate)", reversible: true }));
show(oops);
cosign.undo(oops.requestId);
ok("Undone within 48 hours — the unused token is cancelled");
bankSays(bank.pay({ from: "sunanda@cosign", to: "CarePlus Pharmacy", amount: 960, agentId: sakhiKeys.agentId, token: oops.token }));

await title("10. Receipts — tamper-evident history");
ok(`${cosign.receipts.entries.length} receipts, chain check: ${JSON.stringify(cosign.receipts.verify())}`);
info("Someone quietly edits receipt #0 to hide a payment…");
cosign.receipts.entries[0]!.summary = "Pay ₹1 to FreshBasket";
const v = cosign.receipts.verify();
v.ok ? ok("Chain intact") : no(`Chain broken at receipt #${v.brokenAt} — the edit is detected`);
console.log(`\n${c.b}Done.${c.x} ${c.d}Signatures, PIN unlock, tokens and checks are real; the money and the bank are simulated.${c.x}\n`);
