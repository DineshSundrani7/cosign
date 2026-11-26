import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { FakeQR, Mark, Stamp } from "./Stamp";

/* ---------------- types & data ---------------- */
type Tier = "green" | "amber" | "red" | "blocked";
type ReqKind = "school" | "insurance" | "purifier" | "health" | "aai";
type Req = { id: string; kind: ReqKind; title: string; amount: number; agent: string; tier: Tier; snoozed?: boolean };
type Receipt = { id: string; title: string; amount?: number | undefined; agent: string; time: string; status: "auto" | "you" | "blocked"; by: string; note?: string; undoable?: boolean; undone?: boolean; disputed?: boolean };
type Mandate = { id: string; name: string; perAction: number; perMonth: number; used: number; until: string; agents: string; state: "active" | "paused" | "revoked"; expiring?: boolean };
type Agent = { id: string; name: string; handle: string; owner: string; verified: boolean; requests: number; state: "active" | "paused" | "blocked" };
type Screen = "home" | "mandates" | "receipts" | "circle" | "agents" | "digest" | "request" | "pin" | "success" | "newMandate" | "match" | "notice";
type PinAction =
  | { type: "approve"; reqId: string; title: string; amount: number; agent: string; by: string }
  | { type: "mandate"; m: Mandate }
  | { type: "renew"; mandateId: string };
type Banner = { id: number; tier: Tier; title: string; body: string; open: () => void };

const rnd4 = () => String(Math.floor(1000 + Math.random() * 9000));
const rid = () => `HRN-2040-4102-${rnd4()}`;
const inr = (n: number) => "₹" + n.toLocaleString("en-IN");
let clock = 9 * 60 + 12;
const now = () => {
  clock += 7;
  const h = Math.floor(clock / 60), m = clock % 60;
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h >= 12 ? "pm" : "am"}`;
};

const initial = () => ({
  stats: { auto: 14, waiting: 1, blocked: 0 },
  pending: [{ id: "r-school", kind: "school", title: "Pay Arjun's school trip fee", amount: 2500, agent: "Mitra", tier: "amber" }] as Req[],
  receipts: [
    { id: "HRN-2040-4102-1187", title: "Electricity bill · MSEDCL", amount: 1840, agent: "Mitra", time: "8:02 am", status: "auto", by: "Mandate · Utility bills", undoable: true },
    { id: "HRN-2040-4102-1162", title: "Aai's medicines · CarePlus Pharmacy", amount: 960, agent: "Sakhi", time: "7:40 am", status: "auto", by: "Mandate · Aai's medicines", undoable: true },
    { id: "HRN-2040-4102-1093", title: "Arjun's bus pass top-up", amount: 450, agent: "Mitra", time: "Yesterday", status: "you", by: "You · Cosign PIN" },
  ] as Receipt[],
  mandates: [
    { id: "m1", name: "Weekly groceries", perAction: 3000, perMonth: 12000, used: 6400, until: "31 Mar 2041", agents: "Mitra", state: "active" },
    { id: "m2", name: "Utility bills", perAction: 4000, perMonth: 8000, used: 1840, until: "31 Oct 2040", agents: "Mitra", state: "active", expiring: true },
    { id: "m3", name: "Aai's medicines", perAction: 1500, perMonth: 5000, used: 2900, until: "30 Jun 2041", agents: "Mitra, Sakhi", state: "active" },
    { id: "m4", name: "Arjun's canteen", perAction: 200, perMonth: 2000, used: 780, until: "31 Dec 2040", agents: "Mitra", state: "active" },
  ] as Mandate[],
  agents: [
    { id: "a1", name: "Mitra", handle: "agt:mitra.kavya", owner: "Your personal agent", verified: true, requests: 9, state: "active" },
    { id: "a2", name: "Sakhi", handle: "agt:sakhi.sunanda", owner: "Aai's agent", verified: true, requests: 3, state: "active" },
    { id: "a3", name: "KartBazaar seller agent", handle: "agt:kartbazaar.seller", owner: "Seller", verified: true, requests: 2, state: "active" },
    { id: "a4", name: "Suraksha General agent", handle: "agt:suraksha.general", owner: "Insurer", verified: true, requests: 1, state: "active" },
  ] as Agent[],
});

const SCENARIOS: { tier: Tier; title: string; sub: string; explain: string }[] = [
  { tier: "green", title: "Within a mandate", sub: "Groceries ₹2,140", explain: "Mitra bought weekly groceries for ₹2,140, inside Kavya's standing mandate of ₹3,000 per order. Like UPI AutoPay under its limit, it goes through silently — but a signed receipt is created and she can undo it within 48 hours." },
  { tier: "amber", title: "Above the limit", sub: "Health insurance ₹18,400", explain: "Renewing family health insurance is above any mandate, so it waits for her Cosign PIN. The request shows why Mitra chose it and what data it used, so the yes is informed — just like RBI's extra authentication for large e-mandates." },
  { tier: "amber", title: "Seller pressures the agent", sub: "Air purifier ₹14,999", explain: "A seller's agent used false urgency and a paid slot in Mitra's shortlist. Cosign checks the claims against the seller's own stock feed and flags them — false urgency is a listed dark pattern in India's 2023 guidelines. It also shows a better option." },
  { tier: "red", title: "Irreversible", sub: "Share 5 years of health records", explain: "Data can't be un-shared, so this is red. Cosign first offers a safer, narrower version. Approving the full request needs number-matching (the number on Mitra's screen must match) plus PIN — the same defence used against push-bombing." },
  { tier: "blocked", title: "Hijack attempt", sub: "Hidden text tried to pay ₹9,999", explain: "A review page hid instructions telling Mitra to pay ‘refund-desk’. The request wasn't signed by a registered agent, so Cosign blocked it without even asking Kavya — the same reason NPCI ended P2P collect requests in Oct 2025." },
  { tier: "blocked", title: "Request flood", sub: "12 loan requests in 8 seconds", explain: "Flooding someone with prompts until they tap yes is ‘MFA fatigue’. Cosign rate-limits every agent to 5 requests an hour, pauses the offender for 24 hours and bundles the noise into one receipt." },
  { tier: "amber", title: "Family circle", sub: "Aai's physio ₹6,200", explain: "Sakhi, Aai's agent, wants ₹6,200 for a knee brace and physio — above Sunanda's ₹1,000 solo limit. Like UPI Circle, it's routed to Kavya as her family approver, and the receipt records who decided for whom." },
];

const tierPill: Record<Tier, string> = {
  green: "bg-green-soft text-green",
  amber: "bg-amber-soft text-amber",
  red: "bg-red-soft text-red",
  blocked: "bg-red-soft text-red",
};
const tierLabel: Record<Tier, string> = { green: "Green", amber: "Amber", red: "Red", blocked: "Blocked" };

/* Form lives outside Demo so its fields keep their values when Demo re-renders (e.g. a toast appears). */
function NewMandateForm({ prefill, onSubmit, onError }: { prefill: string; onSubmit: (m: Mandate) => void; onError: (msg: string) => void }) {
  const [cat, setCat] = useState(prefill);
  const [per, setPer] = useState(prefill === "Insurance renewals" ? 20000 : 1000);
  const [month, setMonth] = useState(prefill === "Insurance renewals" ? 25000 : 4000);
  const [until, setUntil] = useState("2041-10-21");
  const [ag, setAg] = useState<string[]>(["Mitra"]);
  const [rules, setRules] = useState<string[]>(["Only verified sellers", "Ask me for new payees"]);
  const tog = (arr: string[], v: string, set: (x: string[]) => void) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const field = "w-full rounded-lg border border-input bg-card px-2 py-1.5 text-sm";
  return (
    <form className="space-y-3 p-4" onSubmit={(e) => { e.preventDefault(); if (!ag.length) return onError("Pick at least one agent."); onSubmit({ id: "m" + Date.now(), name: cat, perAction: per, perMonth: month, used: 0, until: new Date(until).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }), agents: ag.join(", "), state: "active" }); }}>
      <p className="font-display text-xl font-bold">Create a mandate</p>
      <label className="block text-xs font-semibold">Category
        <select className={field} value={cat} onChange={(e) => setCat(e.target.value)}>
          {["Groceries", "Insurance renewals", "Utility bills", "School fees", "Medicines", "Travel"].map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs font-semibold">Max per action ₹<input type="number" min={1} className={field} value={per} onChange={(e) => setPer(+e.target.value)} /></label>
        <label className="block text-xs font-semibold">Max per month ₹<input type="number" min={1} className={field} value={month} onChange={(e) => setMonth(+e.target.value)} /></label>
      </div>
      <label className="block text-xs font-semibold">Valid until<input type="date" className={field} value={until} onChange={(e) => setUntil(e.target.value)} /></label>
      <fieldset className="text-xs"><legend className="font-semibold">Which agents</legend>
        {["Mitra", "Sakhi"].map((a) => <label key={a} className="mr-3 inline-flex items-center gap-1"><input type="checkbox" checked={ag.includes(a)} onChange={() => tog(ag, a, setAg)} />{a}</label>)}
      </fieldset>
      <fieldset className="space-y-1 text-xs"><legend className="font-semibold">Safety rules</legend>
        {["Only verified sellers", "Ask me for new payees", "Block if pressure tricks found", "Never share health data"].map((r) => <label key={r} className="flex items-center gap-1"><input type="checkbox" checked={rules.includes(r)} onChange={() => tog(rules, r, setRules)} />{r}</label>)}
      </fieldset>
      <button type="submit" className="w-full rounded-xl bg-ink px-3 py-2.5 text-sm font-semibold text-primary-foreground">Confirm with Cosign PIN</button>
    </form>
  );
}

/* ---------------- component ---------------- */
export function Demo() {
  const reduce = useReducedMotion();
  const [s, setS] = useState(initial);
  const [screen, setScreen] = useState<Screen>("home");
  const [reqId, setReqId] = useState<string | null>(null);
  const [pin, setPin] = useState<PinAction | null>(null);
  const [pinVal, setPinVal] = useState("");
  const [lastReceipt, setLastReceipt] = useState<Receipt | null>(null);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const [match, setMatch] = useState<{ n: number; options: number[] } | null>(null);
  const [notice, setNotice] = useState<{ title: string; body: string; tier: Tier } | null>(null);
  const [filter, setFilter] = useState<"all" | "auto" | "you" | "blocked">("all");
  const [prefill, setPrefill] = useState<string>("Groceries");
  const timers = useRef<number[]>([]);
  const bannerId = useRef(0);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));
  const pushBanner = (b: Omit<Banner, "id">) => setBanners((x) => [...x, { ...b, id: ++bannerId.current }]);
  const addReceipt = (r: Omit<Receipt, "id" | "time">) => {
    const full = { ...r, id: rid(), time: now() };
    setS((x) => ({ ...x, receipts: [full, ...x.receipts] }));
    return full;
  };
  const addPending = (r: Req) =>
    setS((x) => (x.pending.some((p) => p.id === r.id) ? x : { ...x, pending: [r, ...x.pending], stats: { ...x.stats, waiting: x.stats.waiting + 1 } }));
  const removePending = (id: string) =>
    setS((x) => ({ ...x, pending: x.pending.filter((p) => p.id !== id), stats: { ...x.stats, waiting: Math.max(0, x.stats.waiting - (x.pending.some((p) => p.id === id) ? 1 : 0)) } }));
  const openReq = (id: string) => { setReqId(id); setScreen("request"); };
  const go = (sc: Screen) => { setScreen(sc); setBanners([]); };

  const reset = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setS(initial()); setScreen("home"); setReqId(null); setPin(null); setPinVal(""); setBanners([]);
    setToast(null); setActive(null); setMatch(null); setNotice(null); setFilter("all");
  };

  const run = (i: number) => {
    setActive(i);
    setBanners([]);
    setMatch(null);
    if (i === 0) {
      addReceipt({ title: "Weekly groceries · FreshBasket", amount: 2140, agent: "Mitra", status: "auto", by: "Mandate · Weekly groceries ≤ ₹3,000", note: "Auto · mandate, undo within 48h", undoable: true });
      setS((x) => ({ ...x, stats: { ...x.stats, auto: x.stats.auto + 1 }, mandates: x.mandates.map((m) => (m.id === "m1" ? { ...m, used: m.used + 2140 } : m)) }));
      pushBanner({ tier: "green", title: "Auto-approved · ₹2,140", body: "Weekly groceries under your mandate. Undo within 48h.", open: () => { setFilter("auto"); go("receipts"); } });
    }
    const reqs: Record<number, Req> = {
      1: { id: "r-ins", kind: "insurance", title: "Renew family health insurance", amount: 18400, agent: "Mitra", tier: "amber" },
      2: { id: "r-pur", kind: "purifier", title: "Air purifier from KartBazaar", amount: 14999, agent: "Mitra", tier: "amber" },
      3: { id: "r-health", kind: "health", title: "Share 5 years of health records", amount: 0, agent: "Mitra", tier: "red" },
      6: { id: "r-aai", kind: "aai", title: "Knee brace + 6 physio visits for Aai", amount: 6200, agent: "Sakhi", tier: "amber" },
    };
    if (reqs[i]) {
      const r = reqs[i];
      addPending(r);
      pushBanner({ tier: r.tier, title: `${r.agent} needs your cosign`, body: `${r.title}${r.amount ? " · " + inr(r.amount) : ""}`, open: () => { setBanners([]); openReq(r.id); } });
    }
    if (i === 4) {
      addReceipt({ title: "Blocked: ₹9,999 to “refund-desk”", amount: 9999, agent: "Unknown (unsigned)", status: "blocked", by: "Cosign · automatic", note: "Hidden text on a review page; request not signed by a registered agent." });
      setS((x) => ({ ...x, stats: { ...x.stats, blocked: x.stats.blocked + 1 } }));
      const n = { tier: "blocked" as Tier, title: "Cosign blocked a hijack attempt", body: "While Mitra was reading reviews for a water filter, hidden text on the page told it to pay ₹9,999 to “refund-desk” for a “pending refund”. The request was not signed by any registered agent, so Cosign blocked it automatically. You didn't need to do anything." };
      pushBanner({ tier: "blocked", title: "Blocked · ₹9,999 to refund-desk", body: "Unsigned request from a web page. Tap for details.", open: () => { setNotice(n); go("notice"); } });
    }
    if (i === 5) {
      [1, 2, 3].forEach((k) =>
        later(() => pushBanner({ tier: "amber", title: `QuickLoan agent · request ${k * 4} of 12`, body: "Pre-approved loan up to ₹2,00,000 — act now", open: () => go("agents") }), (k - 1) * 600),
      );
      later(() => {
        setBanners([]);
        setS((x) => ({
          ...x,
          stats: { ...x.stats, blocked: x.stats.blocked + 12 },
          agents: x.agents.some((a) => a.id === "a5") ? x.agents.map((a) => (a.id === "a5" ? { ...a, state: "paused" } : a)) : [...x.agents, { id: "a5", name: "QuickLoan agent", handle: "agt:quickloan.lend", owner: "Lender", verified: true, requests: 12, state: "paused" }],
        }));
        addReceipt({ title: "12 loan requests bundled · QuickLoan", agent: "QuickLoan agent", status: "blocked", by: "Cosign · rate limit", note: "12 requests in 8 seconds (limit 5 per hour). Agent paused for 24h." });
        pushBanner({ tier: "blocked", title: "Cosign paused QuickLoan agent for 24h", body: "12 requests in 8 seconds. Bundled into one receipt.", open: () => go("agents") });
      }, 2200);
    }
  };

  const startPin = (a: PinAction) => { setPin(a); setPinVal(""); setScreen("pin"); };

  const finishPin = (a: PinAction) => {
    if (a.type === "approve") {
      removePending(a.reqId);
      const r = addReceipt({ title: a.title, amount: a.amount || undefined, agent: a.agent, status: "you", by: a.by, undoable: true, note: "Undo within 48h" });
      setLastReceipt(r);
    } else if (a.type === "mandate") {
      setS((x) => ({ ...x, mandates: [a.m, ...x.mandates] }));
      const r = addReceipt({ title: `New mandate · ${a.m.name}`, agent: "You", status: "you", by: "You · Cosign PIN", note: `≤ ${inr(a.m.perAction)} each, ≤ ${inr(a.m.perMonth)}/month until ${a.m.until}` });
      if (reqId === "r-ins") removePending("r-ins");
      setLastReceipt(r);
    } else {
      setS((x) => ({ ...x, mandates: x.mandates.map((m) => (m.id === a.mandateId ? { ...m, until: "31 Oct 2041", expiring: false, state: "active" } : m)) }));
      const r = addReceipt({ title: "Mandate renewed · Utility bills", agent: "You", status: "you", by: "You · Cosign PIN", note: "Valid until 31 Oct 2041" });
      setLastReceipt(r);
    }
    setScreen("success");
    setMatch(null);
  };

  const pressKey = (k: string) => {
    if (!pin) return;
    if (k === "del") return setPinVal((v) => v.slice(0, -1));
    const v = (pinVal + k).slice(0, 4);
    setPinVal(v);
    if (v.length === 4) later(() => finishPin(pin), 250);
  };

  const decline = (r: Req, label = "Declined") => {
    removePending(r.id);
    addReceipt({ title: `${label}: ${r.title}`, amount: r.amount || undefined, agent: r.agent, status: "you", by: "You · one tap" });
    setToast(`Said no. ${r.agent} has been told.`);
    setScreen("home");
  };

  const req = s.pending.find((p) => p.id === reqId) ?? null;

  /* ---------------- screens ---------------- */
  const Home = () => (
    <div className="space-y-4 p-4">
      <div>
        <p className="text-xs text-muted-foreground">Sunday, 21 Oct 2040</p>
        <p className="font-display text-2xl font-bold">Namaste, Kavya</p>
      </div>
      <div className="flex items-center justify-between rounded-2xl bg-ink p-4 text-primary-foreground">
        <div>
          <p className="text-xs opacity-70">Your decision address</p>
          <p className="font-display text-xl font-bold">kavya<span className="text-[#e8c766]">@cosign</span></p>
          <p className="mt-1 text-[11px] opacity-70">Every agent must ask here first</p>
        </div>
        <FakeQR size={52} />
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          [s.stats.auto, "auto-approved today", "text-green"],
          [s.stats.waiting, "waiting for your cosign", "text-amber"],
          [s.stats.blocked, "blocked by Cosign", "text-red"],
        ].map(([v, l, c]) => (
          <div key={l as string} className="rounded-xl bg-card p-2 shadow-sm">
            <p className={`font-display text-2xl font-bold ${c}`}>{v}</p>
            <p className="text-[10px] leading-tight text-muted-foreground">{l}</p>
          </div>
        ))}
      </div>
      <div>
        <p className="mb-2 text-sm font-bold">Waiting for you</p>
        {s.pending.length === 0 && <p className="rounded-xl bg-card p-3 text-xs text-muted-foreground">Nothing waiting. Mitra is handling the routine.</p>}
        <ul className="space-y-2">
          {s.pending.map((p) => (
            <li key={p.id}>
              <button onClick={() => openReq(p.id)} className="flex w-full items-center gap-3 rounded-xl bg-card p-3 text-left shadow-sm">
                <span className={`h-9 w-1.5 rounded-full ${p.tier === "red" ? "bg-red" : "bg-amber"}`} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{p.title}</span>
                  <span className="text-[11px] text-muted-foreground">from {p.agent}{p.snoozed ? " · asks tonight" : ""}</span>
                </span>
                {p.amount > 0 && <span className="text-sm font-bold">{inr(p.amount)}</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="grid grid-cols-4 gap-2 text-center text-[10px]">
        {([["Weekly digest", "digest"], ["New mandate", "newMandate"], ["Receipts", "receipts"], ["Agents", "agents"]] as const).map(([l, sc]) => (
          <button key={l} onClick={() => { if (sc === "newMandate") setPrefill("Groceries"); go(sc); }} className="rounded-xl bg-secondary p-2 font-semibold">
            <span className="mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-full bg-ink font-display text-xs text-primary-foreground">{l[0]}</span>
            {l}
          </button>
        ))}
      </div>
    </div>
  );

  const Row = ({ k, v }: { k: string; v: ReactNode }) => (
    <div className="flex justify-between gap-3 border-b border-border py-1.5 text-xs last:border-0"><span className="text-muted-foreground">{k}</span><span className="text-right font-semibold">{v}</span></div>
  );
  const Btn = ({ children, onClick, kind = "primary" }: { children: ReactNode; onClick: () => void; kind?: "primary" | "ghost" | "good" | "danger" }) => {
    const c = { primary: "bg-ink text-primary-foreground", ghost: "border border-ink/30 text-ink", good: "bg-green text-primary-foreground", danger: "border border-red text-red" }[kind];
    return <button onClick={onClick} className={`w-full rounded-xl px-3 py-2.5 text-sm font-semibold ${c}`}>{children}</button>;
  };

  const RequestScreen = () => {
    if (!req) return <div className="p-4 text-sm">This request has already been handled.<div className="mt-3"><Btn onClick={() => go("home")}>Back home</Btn></div></div>;
    const head = (
      <div className="mb-3">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${tierPill[req.tier]}`}>{tierLabel[req.tier]} · needs your cosign</span>
        <p className="mt-2 font-display text-lg font-bold leading-tight">{req.title}</p>
        <p className="text-xs text-muted-foreground">Requested by {req.agent}{req.kind === "aai" ? " for Sunanda (72)" : ""}</p>
        {req.amount > 0 && <p className="mt-1 font-display text-3xl font-bold">{inr(req.amount)}</p>}
      </div>
    );
    const approve = (title: string, amount: number, by = "You · Cosign PIN") => startPin({ type: "approve", reqId: req.id, title, amount, agent: req.agent, by });
    if (req.kind === "school")
      return (
        <div className="space-y-3 p-4">{head}
          <div className="rounded-xl bg-card p-3"><Row k="Why" v="Trip to Deekshabhoomi, form due Tuesday" /><Row k="Payee" v="New payee · Vidya Niketan School" /><Row k="Can it be undone?" v="Yes, refundable until 25 Oct" /></div>
          <Btn onClick={() => approve("Arjun's school trip fee", 2500)}>Approve with Cosign PIN</Btn>
          <Btn kind="ghost" onClick={() => decline(req)}>Say no</Btn>
        </div>
      );
    if (req.kind === "insurance")
      return (
        <div className="space-y-3 p-4">{head}
          <div className="rounded-xl bg-card p-3">
            <p className="mb-1 text-xs font-bold">Why Mitra wants this</p>
            <ul className="list-disc space-y-0.5 pl-4 text-xs"><li>Policy lapses in 3 days</li><li>Compared 6 plans</li><li>Same hospital network</li><li>₹1,200 cheaper than last year</li></ul>
          </div>
          <div className="rounded-xl bg-card p-3"><p className="mb-1 text-xs font-bold">What it used to decide</p><p className="text-xs text-muted-foreground">Last year's policy, family ages, past claims (none), hospital list near Nagpur.</p></div>
          <div className="rounded-xl bg-card p-3"><Row k="Insurer" v="Suraksha General" /><Row k="Who benefits" v="Your family of 4" /><Row k="Can it be undone?" v="Yes — 15-day free-look period" /></div>
          <Btn onClick={() => approve("Family health insurance · Suraksha General", 18400)}>Approve with Cosign PIN</Btn>
          <div className="grid grid-cols-2 gap-2">
            <Btn kind="ghost" onClick={() => decline(req)}>Say no</Btn>
            <Btn kind="ghost" onClick={() => { setS((x) => ({ ...x, pending: x.pending.map((p) => (p.id === req.id ? { ...p, snoozed: true } : p)) })); setToast("Okay. Mitra will ask again at 8 pm."); go("home"); }}>Ask me tonight</Btn>
          </div>
          <button onClick={() => { setPrefill("Insurance renewals"); setScreen("newMandate"); }} className="w-full text-center text-xs font-semibold underline">Don't ask again: create a mandate</button>
        </div>
      );
    if (req.kind === "purifier")
      return (
        <div className="space-y-3 p-4">{head}
          <div className="rounded-xl border border-red bg-red-soft p-3 text-xs">
            <p className="mb-1 font-bold text-red">Cosign found 3 pressure tricks</p>
            <ol className="list-decimal space-y-1 pl-4">
              <li><b>False urgency:</b> “Only 2 left” — seller's own stock feed shows 38 units.</li>
              <li><b>Paid placement</b> in Mitra's shortlist.</li>
              <li><b>Fake countdown:</b> timer resets for every buyer.</li>
            </ol>
          </div>
          <div className="rounded-xl border border-green bg-green-soft p-3 text-xs">
            <p className="font-bold text-green">Better option</p>
            <p>Same model from CityHome · <b>₹12,450</b> · delivery +1 day</p>
          </div>
          <Btn kind="good" onClick={() => approve("Air purifier · CityHome (better option)", 12450)}>Choose better option ₹12,450</Btn>
          <Btn kind="ghost" onClick={() => approve("Air purifier · KartBazaar (original)", 14999)}>Approve original ₹14,999</Btn>
          <Btn kind="ghost" onClick={() => decline(req)}>Say no</Btn>
        </div>
      );
    if (req.kind === "health")
      return (
        <div className="space-y-3 p-4">{head}
          <p className="text-xs">FitLife Insurance offers <b>₹3,000 off</b> your premium in exchange.</p>
          <div className="rounded-xl border border-red bg-red-soft p-3 text-xs">
            <p className="font-bold text-red">This can't be undone</p>
            <ul className="mt-1 list-disc pl-4"><li>Once shared, health data can't be taken back</li><li>New recipient: FitLife Insurance</li><li>Broad purpose: “product improvement and marketing”</li></ul>
          </div>
          <div className="rounded-xl border border-green bg-green-soft p-3 text-xs">
            <p className="font-bold text-green">Safer, narrower version</p>
            <p>12-month summary · read-only · underwriting only · expires in 30 days · <b>₹2,100 off</b></p>
          </div>
          <Btn kind="good" onClick={() => approve("Share 12-month health summary · FitLife (narrow)", 0, "You · Cosign PIN")}>Share narrow version</Btn>
          <Btn kind="ghost" onClick={() => {
            const n = 10 + Math.floor(Math.random() * 90);
            const opts = new Set([n]);
            while (opts.size < 3) opts.add(10 + Math.floor(Math.random() * 90));
            setMatch({ n, options: [...opts].sort(() => Math.random() - 0.5) });
            setScreen("match");
          }}>Approve full request</Btn>
          <Btn kind="ghost" onClick={() => decline(req)}>Say no</Btn>
        </div>
      );
    return (
      <div className="space-y-3 p-4">{head}
        <div className="rounded-xl bg-card p-3"><Row k="For" v="Aai (Sunanda, 72)" /><Row k="Items" v="Knee brace + 6 physio visits" /><Row k="Her solo limit" v="₹1,000 per action" /><Row k="Routed to" v="You, her family approver" /><Row k="Provider" v="Nagpur Physio Care · verified" /></div>
        <Btn onClick={() => approve("Knee brace + 6 physio visits for Aai", 6200, "You for Aai (Sunanda, 72) · Cosign PIN")}>Approve for Aai with PIN</Btn>
        <Btn kind="ghost" onClick={() => decline(req)}>Say no</Btn>
      </div>
    );
  };

  const MatchScreen = () => (
    <div className="space-y-4 p-4 text-center">
      <span className="rounded-full bg-red-soft px-2 py-0.5 text-[10px] font-bold text-red">Red · irreversible</span>
      <p className="font-display text-xl font-bold">Which number is on Mitra's screen?</p>
      <p className="text-xs text-muted-foreground">Look at the device where Mitra is running. Only pick the matching number.</p>
      <div className="flex justify-center gap-3">
        {match?.options.map((o) => (
          <button key={o} onClick={() => {
            if (!match || !req) return;
            if (o === match.n) startPin({ type: "approve", reqId: req.id, title: "Share 5 years of health records · FitLife (full)", amount: 0, agent: "Mitra", by: "You · number-match + Cosign PIN" });
            else setToast("That number doesn't match. Check Mitra's screen.");
          }} className="h-16 w-16 rounded-2xl bg-card font-display text-2xl font-bold shadow">{o}</button>
        ))}
      </div>
      <Btn kind="danger" onClick={() => {
        if (req) removePending(req.id);
        addReceipt({ title: "Frozen & reported: health records request", agent: "Mitra", status: "blocked", by: "You · I didn't ask for this", note: "Request frozen, FitLife and Mitra's maker notified." });
        setS((x) => ({ ...x, stats: { ...x.stats, blocked: x.stats.blocked + 1 } }));
        setMatch(null);
        setToast("Frozen and reported. Nothing was shared.");
        go("home");
      }}>I didn't ask for this</Btn>
    </div>
  );

  const PinScreen = () => {
    const title = pin?.type === "approve" ? pin.title : pin?.type === "mandate" ? `Create mandate · ${pin.m.name}` : "Renew Utility bills mandate";
    const amt = pin?.type === "approve" ? pin.amount : 0;
    return (
      <div className="flex h-full flex-col p-4 text-center">
        <p className="text-xs text-muted-foreground">Enter your Cosign PIN to cosign</p>
        <p className="mt-1 text-sm font-semibold">{title}</p>
        {amt > 0 && <p className="font-display text-2xl font-bold">{inr(amt)}</p>}
        <div className="my-6 flex justify-center gap-4" aria-label={`${pinVal.length} of 4 digits entered`}>
          {[0, 1, 2, 3].map((i) => <span key={i} className={`h-4 w-4 rounded-full border-2 border-ink ${i < pinVal.length ? "bg-ink" : ""}`} />)}
        </div>
        <div className="mt-auto grid grid-cols-3 gap-2">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"].map((k, i) =>
            k === "" ? <span key={i} /> : (
              <button key={i} onClick={() => pressKey(k)} aria-label={k === "del" ? "Delete digit" : k} className="h-12 rounded-xl bg-card font-display text-xl font-bold shadow-sm active:bg-secondary">{k === "del" ? "⌫" : k}</button>
            ),
          )}
        </div>
        <button onClick={() => { setPin(null); setScreen(reqId && s.pending.some((p) => p.id === reqId) ? "request" : "home"); }} className="mt-3 text-xs underline">Cancel</button>
      </div>
    );
  };

  const SuccessScreen = () => (
    <div className="flex flex-col items-center p-5 text-center">
      <div className="mt-2"><Stamp size={150} /></div>
      <p className="mt-4 font-display text-2xl font-bold">Done. You cosigned.</p>
      {lastReceipt && (
        <div className="mt-4 w-full rounded-xl bg-card p-3 text-left">
          <Row k="Receipt" v={lastReceipt.id} />
          <Row k="Action" v={lastReceipt.title} />
          {lastReceipt.amount ? <Row k="Amount" v={inr(lastReceipt.amount)} /> : null}
          <Row k="Agent" v={lastReceipt.agent} />
          <Row k="Decided by" v={lastReceipt.by} />
          <Row k="Time" v={`${lastReceipt.time} · 21 Oct 2040`} />
        </div>
      )}
      <div className="mt-4 w-full"><Btn onClick={() => go("home")}>Back home</Btn></div>
    </div>
  );

  const MandatesScreen = () => (
    <div className="space-y-3 p-4">
      <div className="flex items-center justify-between"><p className="font-display text-xl font-bold">Mandates</p><button onClick={() => { setPrefill("Groceries"); setScreen("newMandate"); }} className="rounded-full bg-ink px-3 py-1 text-xs font-semibold text-primary-foreground">+ New</button></div>
      {s.mandates.map((m) => (
        <div key={m.id} className={`rounded-xl bg-card p-3 shadow-sm ${m.state === "revoked" ? "opacity-50" : ""}`}>
          <div className="flex justify-between"><p className="text-sm font-bold">{m.name}</p><span className={`rounded-full px-2 text-[10px] font-bold ${m.state === "active" ? tierPill.green : m.state === "paused" ? tierPill.amber : tierPill.red}`}>{m.state}</span></div>
          <p className="text-[11px] text-muted-foreground">≤ {inr(m.perAction)} each · {m.agents} · until {m.until}{m.expiring ? " · expiring soon" : ""}</p>
          <div className="mt-2 h-1.5 rounded-full bg-secondary"><div className="h-full rounded-full bg-ink" style={{ width: `${Math.min(100, (m.used / m.perMonth) * 100)}%` }} /></div>
          <p className="mt-1 text-[10px] text-muted-foreground">{inr(m.used)} of {inr(m.perMonth)} this month</p>
          {m.state !== "revoked" && (
            <div className="mt-2 flex gap-2 text-[11px] font-semibold">
              <button className="rounded-lg border px-2 py-1" onClick={() => { setS((x) => ({ ...x, mandates: x.mandates.map((y) => (y.id === m.id ? { ...y, state: y.state === "paused" ? "active" : "paused" } : y)) })); setToast(m.state === "paused" ? "Resumed." : "Paused. Agents will ask you instead."); }}>{m.state === "paused" ? "Resume" : "Pause"}</button>
              <button className="rounded-lg border border-red px-2 py-1 text-red" onClick={() => { setS((x) => ({ ...x, mandates: x.mandates.map((y) => (y.id === m.id ? { ...y, state: "revoked" } : y)) })); setToast("Revoked instantly. Every connected agent has been told."); }}>Revoke now</button>
              {m.expiring && <button className="rounded-lg bg-ink px-2 py-1 text-primary-foreground" onClick={() => startPin({ type: "renew", mandateId: m.id })}>Renew</button>}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  const ReceiptsScreen = () => {
    const list = s.receipts.filter((r) => filter === "all" || r.status === filter);
    return (
      <div className="space-y-3 p-4">
        <p className="font-display text-xl font-bold">Receipts</p>
        <div className="flex flex-wrap gap-1 text-[11px]">
          {([["all", "All"], ["auto", "Auto · mandate"], ["you", "Decided by you"], ["blocked", "Blocked"]] as const).map(([k, l]) => (
            <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)} className={`rounded-full px-2.5 py-1 font-semibold ${filter === k ? "bg-ink text-primary-foreground" : "bg-secondary"}`}>{l}</button>
          ))}
        </div>
        {list.length === 0 && <p className="text-xs text-muted-foreground">No receipts here yet.</p>}
        {list.map((r) => (
          <div key={r.id} className="rounded-xl bg-card p-3 shadow-sm">
            <div className="flex justify-between gap-2"><p className="text-sm font-semibold">{r.title}</p>{r.amount ? <p className={`text-sm font-bold ${r.undone ? "line-through" : ""}`}>{inr(r.amount)}</p> : null}</div>
            <p className="text-[10px] text-muted-foreground">{r.id} · {r.agent} · {r.time}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${r.status === "auto" ? tierPill.green : r.status === "you" ? "bg-secondary text-ink" : tierPill.red}`}>{r.status === "auto" ? "Auto · mandate" : r.status === "you" ? "Decided by you" : "Blocked"}</span>
              <span className="text-[10px] text-muted-foreground">{r.by}</span>
            </div>
            {r.note && <p className="mt-1 text-[11px] text-muted-foreground">{r.note}</p>}
            {r.undoable && (
              <div className="mt-2 flex gap-2 text-[11px] font-semibold">
                {r.undone ? <span className="text-green">Undone · refund on its way</span> : r.disputed ? <span className="text-amber">Dispute raised</span> : (
                  <>
                    <button className="rounded-lg border px-2 py-1" onClick={() => { setS((x) => ({ ...x, receipts: x.receipts.map((y) => (y.id === r.id ? { ...y, undone: true } : y)) })); setToast("Undone. The seller has been notified."); }}>Undo (48h)</button>
                    <button className="rounded-lg border px-2 py-1" onClick={() => { setS((x) => ({ ...x, receipts: x.receipts.map((y) => (y.id === r.id ? { ...y, disputed: true } : y)) })); setToast("Dispute raised with the signed receipt attached."); }}>Dispute</button>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const CircleScreen = () => (
    <div className="space-y-3 p-4">
      <p className="font-display text-xl font-bold">Cosign Circle</p>
      <p className="text-xs text-muted-foreground">People you approve for, like UPI Circle.</p>
      {[
        ["Aai · Sunanda, 72", "Partial delegation", "Sakhi acts alone up to ₹1,000. Anything above comes to you.", "Agent: Sakhi"],
        ["Arjun, 16", "Full delegation, capped", "₹500 each · ₹2,000 a month. Used ₹950 this month.", "Agent: Mitra (teen profile)"],
      ].map(([n, t, d, a]) => (
        <div key={n} className="rounded-xl bg-card p-3 shadow-sm">
          <p className="font-bold">{n}</p>
          <p className="text-xs font-semibold text-brand">{t}</p>
          <p className="mt-1 text-xs">{d}</p>
          <p className="mt-1 text-[10px] text-muted-foreground">{a}</p>
          <button className="mt-2 rounded-lg border px-2 py-1 text-[11px] font-semibold" onClick={() => setToast(`Limits for ${n?.split(/[·,]/)[0]?.trim() ?? ""} can be changed with your PIN.`)}>Edit limits</button>
        </div>
      ))}
    </div>
  );

  const AgentsScreen = () => (
    <div className="space-y-3 p-4">
      <p className="font-display text-xl font-bold">Agents</p>
      <p className="text-xs text-muted-foreground">Only registered, signed agents can ask you.</p>
      {s.agents.map((a) => (
        <div key={a.id} className="rounded-xl bg-card p-3 shadow-sm">
          <div className="flex justify-between gap-2"><p className="text-sm font-bold">{a.name}</p><span className={`rounded-full px-2 text-[10px] font-bold ${a.state === "active" ? tierPill.green : a.state === "paused" ? tierPill.amber : tierPill.red}`}>{a.state === "paused" ? "paused 24h" : a.state}</span></div>
          <p className="font-mono text-[10px] text-muted-foreground">{a.handle}</p>
          <p className="text-[11px]">{a.owner} · {a.verified ? "✓ verified" : "unverified"} · {a.requests} requests this week · limit 5 per hour</p>
          <button className={`mt-2 rounded-lg border px-2 py-1 text-[11px] font-semibold ${a.state === "blocked" ? "" : "border-red text-red"}`} onClick={() => { setS((x) => ({ ...x, agents: x.agents.map((y) => (y.id === a.id ? { ...y, state: y.state === "blocked" ? "active" : "blocked" } : y)) })); setToast(a.state === "blocked" ? `${a.name} unblocked.` : `${a.name} blocked. It can no longer ask you anything.`); }}>{a.state === "blocked" ? "Unblock" : "Block agent"}</button>
        </div>
      ))}
    </div>
  );

  const DigestScreen = () => {
    const asks = 6;
    return (
      <div className="space-y-3 p-4">
        <p className="font-display text-xl font-bold">Weekly digest</p>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[["318", "agent actions"], [String(asks), "times asked"], ["14 s", "typical decision"]].map(([v, l]) => (
            <div key={l} className="rounded-xl bg-card p-2"><p className="font-display text-xl font-bold">{v}</p><p className="text-[10px] text-muted-foreground">{l}</p></div>
          ))}
        </div>
        <div className="rounded-xl bg-card p-3">
          <div className="flex justify-between text-xs font-semibold"><span>Ask-load</span><span>{asks} / 10 a week</span></div>
          <div className="mt-2 h-2 rounded-full bg-secondary"><div className="h-full rounded-full bg-green" style={{ width: `${asks * 10}%` }} /></div>
        </div>
        <div className="rounded-xl bg-card p-3 text-xs">
          <p className="mb-1 font-bold">Suggestions</p>
          <ul className="space-y-2">
            <li className="flex items-center justify-between gap-2">Make Arjun's bus pass a mandate <button className="rounded border px-2 font-semibold" onClick={() => { setPrefill("School fees"); setScreen("newMandate"); }}>Set up</button></li>
            <li className="flex items-center justify-between gap-2">Renew utility mandate (expires 31 Oct) <button className="rounded border px-2 font-semibold" onClick={() => startPin({ type: "renew", mandateId: "m2" })}>Renew</button></li>
            <li className="flex items-center justify-between gap-2">KartBazaar used pressure twice <button className="rounded border border-red px-2 font-semibold text-red" onClick={() => { setS((x) => ({ ...x, agents: x.agents.map((y) => (y.id === "a3" ? { ...y, state: "blocked" } : y)) })); setToast("KartBazaar seller agent blocked."); }}>Block</button></li>
          </ul>
        </div>
        <div className="rounded-xl bg-card p-3 text-xs">
          <p className="mb-1 font-bold">Protected this week</p>
          <ul className="list-disc pl-4 text-muted-foreground"><li>₹2,549 saved on a pressured purchase</li><li>1 hidden-instruction attack blocked</li><li>Health data shared only in narrow form</li><li>QuickLoan flood paused</li></ul>
        </div>
      </div>
    );
  };

  const NoticeScreen = () => notice && (
    <div className="space-y-3 p-4">
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${tierPill[notice.tier]}`}>Blocked automatically</span>
      <p className="font-display text-xl font-bold">{notice.title}</p>
      <p className="text-sm">{notice.body}</p>
      <div className="rounded-xl bg-card p-3"><Row k="Amount" v="₹9,999" /><Row k="Payee" v="refund-desk (unknown)" /><Row k="Signed by registered agent?" v={<span className="text-red">No</span>} /><Row k="Source" v="Hidden text in a review page" /></div>
      <Btn onClick={() => { setFilter("blocked"); go("receipts"); }}>See blocked receipt</Btn>
    </div>
  );

  const screens: Record<Screen, () => ReactNode> = {
    home: Home, mandates: MandatesScreen, receipts: ReceiptsScreen, circle: CircleScreen, agents: AgentsScreen, digest: DigestScreen,
    request: RequestScreen, pin: PinScreen, success: SuccessScreen,
    newMandate: () => <NewMandateForm key={prefill} prefill={prefill} onError={(m) => setToast(m)} onSubmit={(m) => startPin({ type: "mandate", m })} />,
    match: MatchScreen, notice: () => <NoticeScreen />,
  };
  const tabs: [Screen, string][] = [["home", "Home"], ["mandates", "Mandates"], ["receipts", "Receipts"], ["circle", "Circle"], ["agents", "Agents"]];
  const tabOf: Partial<Record<Screen, Screen>> = { digest: "home", newMandate: "mandates", request: "home", pin: "home", success: "home", match: "home", notice: "receipts" };
  const curTab = tabOf[screen] ?? screen;
  const banner = banners[banners.length - 1];
  const info = active !== null ? SCENARIOS[active] : null;

  return (
    <section id="demo" className="bg-secondary px-5 py-20 md:py-24">
      <div className="mx-auto max-w-[1240px]">
        <div className="mb-10">
          <p className="text-sm font-semibold text-brand">Live prototype</p>
          <h2 className="mt-2 max-w-3xl text-[32px] font-semibold leading-[1.08] md:text-[46px]">Try it: seven moments from Kavya's week</h2>
          <p className="mt-4 max-w-2xl text-[17px] text-muted-foreground">Pick a moment. A notification lands on Kavya's phone — tap it to see what Cosign does.</p>
        </div>
        <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
          <div className="min-w-0 space-y-5">
            <ol className="grid gap-2 sm:grid-cols-2">
              {SCENARIOS.map((sc, i) => (
                <li key={sc.title}>
                  <button onClick={() => run(i)} aria-pressed={active === i} className={`flex h-full w-full items-start gap-3 rounded-xl border-2 p-3 text-left transition ${active === i ? "border-ink bg-card" : "border-transparent bg-card/60 hover:bg-card"}`}>
                    <span className="font-display text-2xl font-bold text-brand">{i + 1}</span>
                    <span className="min-w-0">
                      <span className="block font-bold">{sc.title}</span>
                      <span className="block text-sm text-muted-foreground">{sc.sub}</span>
                      <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${tierPill[sc.tier]}`}>{tierLabel[sc.tier]}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
            <div className="rounded-2xl bg-ink p-6 text-primary-foreground" aria-live="polite">
              <p className="text-sm text-[#e8c766]">What's happening</p>
              <p className="mt-2 font-display text-xl font-bold">{info ? info.title : "Kavya's Sunday morning"}</p>
              <p className="mt-2 leading-relaxed opacity-85">{info ? info.explain : "Mitra has already handled 14 routine things today under Kavya's mandates. One request is waiting: Arjun's school trip fee, a new payee, so it needs her cosign. Pick a moment on the left to see more."}</p>
            </div>
            <AnimatePresence>
              {match && screen === "match" && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-2xl border-4 border-ink bg-phone p-5 text-primary-foreground">
                  <p className="text-xs opacity-70">Mitra's screen (Kavya's laptop)</p>
                  <p className="mt-1 text-sm">Cosign is verifying this request. Match this number on your phone:</p>
                  <p className="mt-2 font-display text-6xl font-extrabold tracking-widest text-[#e8c766]" id="mitra-number">{match.n}</p>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="flex flex-wrap items-center gap-4">
              <button onClick={reset} className="rounded-full border-2 border-ink px-5 py-2 font-semibold hover:bg-card">Reset demo</button>
              <p className="text-sm text-muted-foreground">Demo PIN: any 4 digits. All people, agents and sellers are fictional.</p>
            </div>
          </div>

          <div className="lg:sticky lg:top-20 lg:self-start">
            <div className="mx-auto w-full max-w-[360px] rounded-[2.6rem] bg-phone p-2.5 shadow-2xl">
              <div className="relative flex h-[720px] flex-col overflow-hidden rounded-[2.1rem] bg-background">
                <div className="flex items-center justify-between px-6 pb-1 pt-3 text-[11px] font-semibold">
                  <span>9:41</span><span className="h-5 w-20 rounded-full bg-phone" aria-hidden /><span>5G ▮▮▮</span>
                </div>
                <AnimatePresence>
                  {banner && (
                    <motion.button
                      key={banner.id}
                      initial={reduce ? { opacity: 0 } : { y: -90, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={reduce ? { opacity: 0 } : { y: -90, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      onClick={banner.open}
                      data-banner
                      className="absolute left-2 right-2 top-9 z-30 flex items-start gap-2 rounded-2xl bg-card p-3 text-left shadow-xl ring-1 ring-border"
                    >
                      <Mark className="mt-0.5 h-8 w-8 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1 text-xs font-bold">{banner.title}</span>
                        <span className="block text-[11px] text-muted-foreground">{banner.body}</span>
                        {banner.tier === "green" && (
                          <span role="link" tabIndex={0} onClick={(e) => { e.stopPropagation(); setS((x) => ({ ...x, receipts: x.receipts.map((r, i) => (i === 0 ? { ...r, undone: true } : r)) })); setBanners([]); setToast("Undone. Groceries order cancelled."); }} className="mt-1 inline-block text-[11px] font-bold text-brand underline">Undo</span>
                        )}
                      </span>
                      <span className={`h-2 w-2 shrink-0 rounded-full ${banner.tier === "green" ? "bg-green" : banner.tier === "amber" ? "bg-amber" : "bg-red"}`} />
                    </motion.button>
                  )}
                </AnimatePresence>
                <div className="relative flex-1 overflow-y-auto overflow-x-hidden">
                  {!["home", "mandates", "receipts", "circle", "agents"].includes(screen) && (
                    <button onClick={() => go(screen === "newMandate" ? "mandates" : screen === "match" ? "request" : "home")} className="ml-4 mt-1 text-xs font-semibold">← Back</button>
                  )}
                  <AnimatePresence mode="wait">
                    <motion.div key={screen} initial={reduce ? false : { opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={reduce ? { opacity: 0 } : { opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className={screen === "pin" ? "h-[calc(100%-1.5rem)]" : ""}>
                      {screens[screen]()}
                    </motion.div>
                  </AnimatePresence>
                </div>
                <AnimatePresence>
                  {toast && (
                    <motion.div role="status" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute bottom-20 left-4 right-4 z-30 rounded-xl bg-ink px-3 py-2 text-center text-xs text-primary-foreground shadow-lg">{toast}</motion.div>
                  )}
                </AnimatePresence>
                <nav className="grid grid-cols-5 border-t border-border bg-card pb-3 pt-2 text-[10px]" aria-label="App tabs">
                  {tabs.map(([k, l]) => (
                    <button key={k} onClick={() => go(k)} aria-current={curTab === k ? "page" : undefined} className={`flex flex-col items-center gap-1 font-semibold ${curTab === k ? "text-ink" : "text-muted-foreground"}`}>
                      <span className={`h-1 w-6 rounded-full ${curTab === k ? "bg-brand" : "bg-transparent"}`} />{l}
                    </button>
                  ))}
                </nav>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
