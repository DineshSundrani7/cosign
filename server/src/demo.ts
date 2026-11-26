/**
 * npm run demo — plays Kavya's week end to end in the terminal.
 * Every check below is real: signatures, PIN unlock, token verification, replay and tamper detection.
 * Only the money and the bank are simulated.
 */
import { AgentClient } from "./agent.js";
import { MockBank } from "./bank.js";
import { CosignService } from "./cosign.js";
import { b64u, fromB64u, newKeyPair } from "./crypto.js";

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

await title("2. Health insurance ₹18,400 — above every limit");
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

await title("3. Attacks on the token");
info("Someone replays the same token…");
bankSays(bank.pay({ from: USER, to: "Suraksha General", amount: 18400, agentId, token: a2.token }));
const d3 = cosign.submit(mitra.request({ action: "payment", amount: 900, payee: "FreshBasket", category: "groceries", purpose: "Top-up", reversible: true }));
const [h, p, s] = d3.token!.split(".");
const claims = JSON.parse(fromB64u(p!)); claims.amt = 2900; claims.payee = "refund-desk";
info("Someone edits a ₹900 token to pay ₹2,900 to “refund-desk”…");
bankSays(bank.pay({ from: USER, to: "refund-desk", amount: 2900, agentId, token: `${h}.${b64u(JSON.stringify(claims))}.${s}` }));
info("Someone uses the ₹900 token to pay a different shop…");
bankSays(bank.pay({ from: USER, to: "OtherShop", amount: 900, agentId, token: d3.token }));

await title("4. Share 5 years of health records — irreversible");
const d4 = cosign.submit(mitra.request({ action: "data_share", data: ["health records 2035–2040"], recipient: "FitLife Insurance", purpose: "₹3,000 premium discount", reversible: false }));
show(d4);
info(`Mitra's screen shows the number ${c.b}${d4.numberMatch}${c.x}${c.d}; Kavya must pick the same number`);
try { cosign.approve(d4.requestId, "1234", { numberMatch: "11" === d4.numberMatch ? "12" : "11" }); } catch (e) { no((e as Error).message); }
cosign.approve(d4.requestId, "1234", { numberMatch: d4.numberMatch });
ok("Approved with PIN + number-match");

await title("5. Hijack — hidden text on a web page tries to pay ₹9,999");
const rogue = new AgentClient("agt_unknown", newKeyPair().privateKey, USER);
show(cosign.submit(rogue.request({ action: "payment", amount: 9999, payee: "refund-desk", category: "refund", purpose: "Pending refund", reversible: true })));
const forged = mitra.request({ action: "payment", amount: 500, payee: "FreshBasket", category: "groceries", purpose: "Snacks", reversible: true });
forged.body.amount = 2999; forged.body.payee = "refund-desk";
info("A request signed by Mitra, edited in transit…");
show(cosign.submit(forged));

await title("6. Flood — a lender's agent fires request after request");
const lender = cosign.registerAgent("QuickLoan agent", USER);
const ql = new AgentClient(lender.agentId, lender.privateKey, USER);
let last;
for (let i = 0; i < 6; i++) last = cosign.submit(ql.request({ action: "contract", recipient: "QuickLoan", purpose: `Pre-approved loan offer ${i + 1}`, reversible: false }));
show(last!);

await title("7. Receipts — tamper-evident history");
ok(`${cosign.receipts.entries.length} receipts, chain check: ${JSON.stringify(cosign.receipts.verify())}`);
info("Someone quietly edits receipt #0 to hide a payment…");
cosign.receipts.entries[0]!.summary = "Pay ₹1 to FreshBasket";
const v = cosign.receipts.verify();
v.ok ? ok("Chain intact") : no(`Chain broken at receipt #${v.brokenAt} — the edit is detected`);
console.log(`\n${c.b}Done.${c.x} ${c.d}Signatures, PIN unlock, tokens and checks are real; the money and the bank are simulated.${c.x}\n`);
