import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";
import { Listen } from "./Listen";
import { Mark, Signature, Stamp } from "./Stamp";

const NAV = [
  ["journey", "Journey"],
  ["problem", "Problem"],
  ["doors", "Who it's for"],
  ["how", "How it works"],
  ["tech", "Under the hood"],
  ["engine", "Real engine"],
  ["demo", "Demo"],
  ["landscape", "Landscape"],
  ["market", "Go to market"],
  ["build", "Build log"],
  ["about", "About"],
  ["faq", "FAQ"],
] as const;

const SIG_AGENT = "M8 40 C 20 12, 34 12, 36 34 S 52 50, 60 26 S 78 10, 84 34 L 98 30 C 108 28, 116 40, 128 30";
const SIG_YOU = "M6 42 C 14 8, 30 6, 30 30 C 30 48, 18 50, 22 36 C 28 18, 48 20, 54 34 C 60 46, 70 22, 80 26 C 90 30, 88 44, 100 38 C 116 30, 120 14, 132 22 C 142 28, 140 46, 156 36 C 168 28, 184 26, 206 30";

export function Nav() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = open ? "hidden" : "";
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <nav className="mx-auto flex max-w-[1240px] items-center gap-3 px-5 py-3" aria-label="Sections">
        <a href="#top" className="flex shrink-0 items-center gap-2 font-display text-xl font-bold">
          <Mark /> Cosign
        </a>
        <ul className="ml-auto hidden items-center gap-0.5 text-sm 2xl:flex">
          {NAV.map(([id, label]) => (
            <li key={id}>
              <a href={`#${id}`} className="inline-block whitespace-nowrap rounded-full px-3 py-2 text-muted-foreground hover:text-ink">{label}</a>
            </li>
          ))}
        </ul>
        <div className="ml-auto 2xl:ml-2"><Listen /></div>
        <a href="#demo" className="hidden whitespace-nowrap rounded-full bg-ink px-4 py-2 text-sm font-semibold text-primary-foreground sm:inline-block">Try the demo</a>
        <button onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open} aria-controls="side-menu" className="flex h-11 w-11 items-center justify-center rounded-full border border-border 2xl:hidden">
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        </button>
      </nav>
      <AnimatePresence>
        {open && (
          <>
            <motion.div className="fixed inset-0 z-[60] bg-ink/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
            <motion.aside
              id="side-menu"
              aria-label="Menu"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 36 }}
              className="fixed inset-y-0 right-0 z-[60] flex h-dvh w-[min(320px,85vw)] flex-col bg-background p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-display text-xl font-bold"><Mark /> Cosign</span>
                <button onClick={() => setOpen(false)} aria-label="Close menu" className="flex h-11 w-11 items-center justify-center rounded-full border border-border text-xl">×</button>
              </div>
              <ul className="mt-8 space-y-1">
                {NAV.map(([id, label]) => (
                  <li key={id}><a href={`#${id}`} onClick={() => setOpen(false)} className="block rounded-xl px-3 py-3 font-display text-xl font-semibold hover:bg-secondary">{label}</a></li>
                ))}
              </ul>
              <a href="#demo" onClick={() => setOpen(false)} className="mt-auto rounded-full bg-ink px-5 py-3 text-center font-semibold text-primary-foreground">Try the demo</a>
              <p className="mt-4 text-center text-xs text-muted-foreground">Built by Dinesh Sundrani · DNS Labs</p>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}

/* Gentle fade-up as sections scroll into view. */
export function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const reduce = useReducedMotion();
  if (reduce) return <>{children}</>;
  return (
    <motion.div initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "0px 0px -80px 0px" }} transition={{ duration: 0.6, delay, ease: [0.2, 0.7, 0.2, 1] }}>
      {children}
    </motion.div>
  );
}

function Band({ id, label, title, kicker, children, tone = "plain" }: { id: string; label: string; title: ReactNode; kicker?: ReactNode; children: ReactNode; tone?: "plain" | "ink" | "tint" }) {
  const toneCls = tone === "ink" ? "bg-ink text-primary-foreground" : tone === "tint" ? "bg-secondary" : "";
  return (
    <section id={id} className={`${toneCls} px-5 py-20 md:py-24`}>
      <div className="mx-auto max-w-[1240px]">
        <Reveal>
          <p className={`text-sm font-semibold ${tone === "ink" ? "text-[#e8c766]" : "text-brand"}`}>{label}</p>
          <h2 className="mt-2 max-w-3xl text-[32px] font-semibold leading-[1.08] md:text-[46px]">{title}</h2>
          {kicker && <p className={`mt-4 max-w-2xl text-[17px] ${tone === "ink" ? "opacity-80" : "text-muted-foreground"}`}>{kicker}</p>}
        </Reveal>
        <Reveal delay={0.1}><div className="mt-10">{children}</div></Reveal>
      </div>
    </section>
  );
}

/* ---------- hero picture: the decision slip ---------- */
function Slip() {
  const reduce = useReducedMotion();
  const rows = [
    ["Proposed by", "Mitra, Kavya's agent · registered ✓"],
    ["Why", "Policy lapses in 3 days · ₹1,200 cheaper than last year"],
    ["Can it be undone?", "Yes, 15-day free look"],
    ["Why it's asking", "Above her ₹4,000 limit"],
  ];
  return (
    <div className="relative mx-auto w-full max-w-[460px] pb-6 pt-4">
      <div className="absolute inset-x-6 top-0 h-full rotate-[4deg] rounded-2xl border border-border bg-secondary" aria-hidden />
      <div className="absolute right-0 top-2 z-10 hidden rotate-[4deg] rounded-full bg-red-soft px-3 py-1 text-xs font-bold text-red sm:block" aria-hidden>
        Blocked · ₹9,999 to refund-desk
      </div>
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative rounded-2xl border border-border bg-card p-6 shadow-[0_24px_60px_-24px_rgba(16,19,26,0.35)]"
      >
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>Decision request · kavya@cosign</span>
          <span className="rounded-full bg-amber-soft px-2 py-0.5 font-bold text-amber">Amber</span>
        </div>
        <p className="mt-3 font-display text-2xl font-semibold leading-tight">Renew family health insurance</p>
        <p className="mt-1 font-display text-4xl font-semibold">₹18,400</p>
        <dl className="mt-4 divide-y divide-border text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 py-2">
              <dt className="shrink-0 text-muted-foreground">{k}</dt>
              <dd className="text-right font-medium">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-5 grid grid-cols-2 gap-4">
          <div>
            <Signature d={SIG_AGENT} className="h-10 w-full text-ink-soft" delay={0.2} />
            <div className="border-t border-ink pt-1 text-xs text-muted-foreground">Proposed · Mitra (agent)</div>
          </div>
          <div className="relative">
            <Signature d={SIG_YOU} className="h-10 w-full text-brand" delay={1.3} />
            <div className="border-t border-ink pt-1 text-xs text-muted-foreground">Cosigned · Kavya (PIN)</div>
            <div className="absolute -bottom-24 right-0 sm:-bottom-10 sm:-right-8">
              <Stamp size={92} delay={2.4} />
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden px-5 pb-16 pt-12 md:pt-20">
      <div className="pointer-events-none absolute inset-0 rule-paper opacity-50 [mask-image:linear-gradient(to_bottom,black,transparent_75%)]" aria-hidden />
      <div className="pointer-events-none absolute -top-24 right-[-120px] h-[560px] w-[560px] rounded-full bg-gold-bright/20 blur-3xl drift" aria-hidden />
      <div className="pointer-events-none absolute bottom-0 left-[-160px] h-[380px] w-[380px] rounded-full bg-gold-bright/12 blur-3xl drift [animation-delay:-7s]" aria-hidden />
      <div className="relative mx-auto grid max-w-[1240px] items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <p className="text-sm text-muted-foreground"><span className="inline-flex items-center gap-2"><span className="h-2 w-2 animate-pulse rounded-full bg-gold" aria-hidden />A DNS Labs concept · working prototype · in development</span></p>
          <h1 className="mt-5 text-[44px] font-semibold leading-[1.02] md:text-[64px]">
            Your agent proposes.<br /><span className="text-brand">You cosign.</span>
          </h1>
          <p className="mt-6 max-w-[34rem] text-[17px] leading-relaxed text-muted-foreground">
            India's payment rails are learning to let AI agents spend small amounts without asking. Cosign is the one place where everything an agent can't take back waits for your second signature — or your family's: money above your limits, your personal data, and your name on a contract.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#demo" className="rounded-full bg-ink px-6 py-3 font-semibold text-primary-foreground transition hover:bg-ink-soft">Try the live demo</a>
            <a href="#landscape" className="rounded-full border-2 border-ink px-6 py-3 font-semibold transition hover:bg-secondary">See the landscape</a>
          </div>
        </div>
        <Slip />
      </div>
      <div className="relative mx-auto mt-14 grid max-w-[1240px] gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-3">
        {[
          ["Routine goes through", "Under limits you set once. You get a receipt and 48 hours to undo."],
          ["Exceptions wait for you", "Above a limit, a new payee, your data or a contract: your PIN decides."],
          ["Fakes never reach you", "Unregistered agents and hidden-text hijacks are stopped before they ask."],
        ].map(([t, d]) => (
          <div key={t} className="bg-background p-6">
            <p className="font-display text-xl font-semibold">{t}</p>
            <p className="mt-2 text-muted-foreground">{d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function Problem() {
  const items = [
    ["Permission creeps", "One “allow” at setup becomes permission forever. An agent quietly renews a ₹20,000 plan you forgot you had."],
    ["Agents get steered", "Seller agents, paid rankings and hidden instructions on web pages learn to push your agent where they want it."],
    ["Nobody can prove who decided", "When an order goes wrong, was it you, your agent or the seller's agent? There is no record everyone trusts."],
  ];
  return (
    <Band id="problem" label="The problem" title="Rails decide how agents pay. Nobody decides what they should never do alone." tone="tint">
      <blockquote className="rounded-2xl bg-ink p-8 text-xl leading-relaxed text-primary-foreground md:p-10 md:text-2xl">
        In an agent-run life there is no single, trusted place where a person says yes or no <em className="not-italic text-[#e8c766]">before</em> an action that can't be undone happens — across every agent, app and seller, and across money, data and signatures. Consent today is a blanket “allow all” or a flood of pop-ups, and neither proves who decided.
      </blockquote>
      <ol className="mt-10 grid gap-6 md:grid-cols-3">
        {items.map(([t, d], i) => (
          <li key={t} className="border-t-2 border-ink pt-5">
            <span className="font-display text-3xl font-semibold text-brand">{String.fromCharCode(97 + i)}.</span>
            <h3 className="mt-2 text-2xl font-semibold">{t}</h3>
            <p className="mt-2 text-muted-foreground">{d}</p>
          </li>
        ))}
      </ol>
      <div className="mt-10 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-background p-5">
          <p className="font-display text-4xl font-semibold">7%</p>
          <p className="mt-1 text-muted-foreground">of US and UK fashion shoppers surveyed would let an AI assistant buy without approval, even under preset conditions (ACI Worldwide research, reported by Fortune, Sept 2026).</p>
        </div>
        <div className="rounded-xl border border-border bg-background p-5">
          <p className="font-display text-4xl font-semibold">112</p>
          <p className="mt-1 text-muted-foreground">startups build payments for AI agents, and they raised $115M in 2026 — more than in all of 2025 (Dealroom). Most of that money goes into helping agents pay.</p>
        </div>
      </div>
    </Band>
  );
}

export function How() {
  const steps = [
    ["Set limits once", "Standing mandates like “groceries up to ₹3,000 an order, until March”. Every one has an end date."],
    ["Agents must ask your address", "Any registered agent sends anything outside your limits to kavya@cosign — never to a pop-up inside some app."],
    ["You cosign or say no", "One tap to say no. Your PIN to say yes, plus number-matching for anything you can't undo."],
    ["Everyone gets the receipt", "A signed record of who proposed, who decided and why. Merchants accept it in disputes; you get 48 hours to undo."],
  ];
  const tiers = [
    { k: "green", name: "Green", who: "Nobody needs to look", when: "Inside a limit you set", what: "Goes through, with a receipt and a 48-hour undo.", hue: "61,207,145", level: 1 },
    { k: "amber", name: "Amber", who: "You look once", when: "Above a limit, a new payee or a flagged seller", what: "Waits for your PIN.", hue: "245,181,74", level: 2 },
    { k: "red", name: "Red", who: "You look twice", when: "Data, contracts, health — can't be undone", what: "A narrower option first, then number-match and PIN.", hue: "255,107,107", level: 3 },
    { k: "blocked", name: "Blocked", who: "It never reaches you", when: "Unregistered agent, hijack or flood", what: "Stopped at the gate and logged on a receipt.", hue: "139,149,167", level: 0 },
  ] as const;
  return (
    <Band id="how" label="How it works" title="One address, one PIN, one receipt — for every agent you use" tone="ink">
      <ol className="grid gap-3 md:grid-cols-4">
        {steps.map(([t, d], i) => (
          <li key={t} className="rounded-xl border border-primary-foreground/20 p-5">
            <span className="font-display text-3xl font-semibold text-[#e8c766]">{i + 1}</span>
            <p className="mt-3 text-lg font-semibold">{t}</p>
            <p className="mt-1 text-sm opacity-75">{d}</p>
          </li>
        ))}
      </ol>
      <h3 className="mb-2 mt-14 text-2xl font-semibold">Four tiers decide who has to look</h3>
      <p className="mb-6 max-w-xl text-sm opacity-70">The more an action can hurt you, the more of you it needs.</p>
      <div className="relative mb-4 hidden h-1.5 overflow-hidden rounded-full md:block" aria-hidden style={{ background: "linear-gradient(90deg, rgb(61,207,145) 0%, rgb(245,181,74) 38%, rgb(255,107,107) 70%, rgb(139,149,167) 100%)" }} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiers.map((t) => (
          <div
            key={t.k}
            className="relative overflow-hidden rounded-2xl border border-white/10 p-5"
            style={{ background: `radial-gradient(120% 90% at 0% 0%, rgba(${t.hue},0.28) 0%, rgba(${t.hue},0.06) 45%, rgba(255,255,255,0.02) 100%)` }}
          >
            <div className="flex items-center justify-between">
              <span className="font-display text-2xl font-semibold" style={{ color: `rgb(${t.hue})` }}>{t.name}</span>
              <span className="flex gap-1" role="img" aria-label={t.level ? `Needs ${t.level === 1 ? "no" : t.level === 2 ? "one" : "two"} check${t.level === 3 ? "s" : ""} from you` : "Stopped at the gate"}>
                {[1, 2, 3].map((n) => (
                  <span key={n} className="h-2 w-5 rounded-full" style={{ background: t.level >= n ? `rgb(${t.hue})` : "rgba(255,255,255,0.12)" }} />
                ))}
              </span>
            </div>
            <p className="mt-3 text-lg font-semibold">{t.who}</p>
            <p className="mt-1 text-sm opacity-70">{t.when}</p>
            <p className="mt-4 border-t border-white/10 pt-3 text-sm">{t.what}</p>
          </div>
        ))}
      </div>
      <div className="mt-14 grid gap-6 md:grid-cols-4">
        {[
          ["No is one tap", "Saying no is always easier than saying yes."],
          ["Every permission expires", "Mandates are dated. Nothing lasts forever by default."],
          ["Ten asks a week, at most", "Rate limits and bundling keep questions rare, so each one gets read."],
          ["Only registered agents can ask", "NPCI ended P2P UPI collect requests in Oct 2025 because of fraud. Cosign starts from there."],
        ].map(([t, d]) => (
          <div key={t} className="border-t-2 border-[#e8c766] pt-4">
            <p className="text-lg font-semibold">{t}</p>
            <p className="mt-2 text-sm opacity-75">{d}</p>
          </div>
        ))}
      </div>
    </Band>
  );
}

export function Landscape() {
  const groups = [
    {
      name: "Payment rails and card networks",
      who: "NPCI's Unified Agent Protocol (reported), Pine Labs P3P, Razorpay Agentic Payments on UPI Reserve Pay, Visa Intelligent Commerce, Mastercard Agent Pay",
      good: "Let a registered agent pay within limits you approve once. P3P has been live on UPI since June 2026; Razorpay runs on ChatGPT and Claude with Zomato, Swiggy and Zepto.",
      open: "Payments only, and built to remove asks. Data sharing and contracts aren't covered, and each rail has its own controls.",
    },
    {
      name: "Developer approval gateways",
      who: "AgentLock, Preloop, Permission Slip, Squidbrake, WorkOS Airlock, Auth0 human-in-the-loop",
      good: "Hold an agent's risky tool calls until a human approves, often from a phone, with audit trails and sometimes undo.",
      open: "Made for engineers and companies running agents, not for a schoolteacher in Nagpur or her mother.",
    },
    {
      name: "Data consent infrastructure",
      who: "DPDP Consent Managers (registration opened 13 Nov 2026), Account Aggregators",
      good: "A regulated, interoperable place to give, review and withdraw consent to share personal data.",
      open: "Data only, built for apps asking people — not for agents acting for people in real time.",
    },
  ];
  const matrix: [string, string, string, string][] = [
    ["What it covers", "Payments", "Tool calls in software teams", "Money, data and signatures"],
    ["Built for", "Merchants, banks, agent makers", "Engineers and companies", "Individuals and families"],
    ["Its job", "Let agents pay without asking each time", "Hold risky actions for a reviewer", "Decide the exceptions and prove who decided"],
    ["Who pays", "Merchants and transaction fees", "Companies", "Families first, then banks (proposed)"],
  ];
  const edges = [
    ["One inbox for money, data and signatures", "Rails cover payments, consent managers cover data. Cosign is the only place a person sees both, plus contracts, in one queue."],
    ["Built on the rails, not against them", "Cosign uses UPI mandates and NPCI's agent registry underneath. If NPCI ships the protocol, Cosign is the app on top, the way PhonePe sits on UPI."],
    ["It only asks about exceptions", "Rails make routine spending silent. Cosign handles what's left, so people are asked at most ten times a week."],
    ["It checks the seller, not just the agent", "Urgency, stock and price claims are checked against the seller's own feeds. Partner data from merchants and marketplaces makes this possible."],
    ["Proof that ends a dispute", "Signed receipts that merchants accept mean fewer “I never ordered this” returns and faster dispute resolution."],
    ["Families, not just individuals", "A Cosign Circle routes an elder's or a teen's big requests to a trusted approver, like UPI Circle."],
  ];
  return (
    <Band id="landscape" label="Landscape" title="Who's already building in this space — and the gap that's left" kicker="Agent payments are crowded and moving fast. Most players either make it easier for agents to pay, or help companies control their own agents. Very few work for the person on the other end.">
      <div className="grid gap-4 md:grid-cols-3">
        {groups.map((g) => (
          <article key={g.name} className="rounded-2xl border border-border p-6">
            <h3 className="text-xl font-semibold">{g.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{g.who}</p>
            <p className="mt-4 text-sm"><span className="font-semibold text-green">Does well: </span>{g.good}</p>
            <p className="mt-2 text-sm"><span className="font-semibold text-red">Leaves open: </span>{g.open}</p>
          </article>
        ))}
      </div>

      <h3 className="mb-4 mt-14 text-2xl font-semibold">Where Cosign sits</h3>
      <div className="grid gap-2" role="img" aria-label="Stack: agents at the top, Cosign in the middle, rails underneath">
        <div className="rounded-xl border border-border bg-secondary p-4">
          <p className="text-sm font-semibold text-muted-foreground">Agents</p>
          <p className="mt-1 flex flex-wrap gap-2 text-sm">{["Mitra (personal)", "Sakhi (Aai's)", "Seller agents", "Any app's agent"].map((a) => <span key={a} className="rounded-full bg-background px-3 py-1">{a}</span>)}</p>
        </div>
        <p className="text-center text-brand" aria-hidden>↓ anything outside your limits</p>
        <div className="rounded-xl bg-brand p-5 text-primary-foreground">
          <p className="flex items-center gap-2 font-display text-2xl font-semibold"><Mark className="h-7 w-7" /> Cosign</p>
          <p className="mt-1 opacity-90">Decision address · one inbox · PIN and number-match · signed receipts · seller checks · Circle</p>
        </div>
        <p className="text-center text-brand" aria-hidden>↓ approved actions settle on</p>
        <div className="grid gap-2 sm:grid-cols-4">
          {["UPI mandates and NPCI's agent protocol", "Cards: Visa and Mastercard agent tokens", "DPDP consent managers", "e-sign for contracts"].map((r) => (
            <div key={r} className="rounded-xl border border-border p-4 text-sm font-medium">{r}</div>
          ))}
        </div>
      </div>

      <h3 className="mb-4 mt-14 text-2xl font-semibold">Side by side</h3>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead>
            <tr className="border-b-2 border-ink bg-secondary">
              <th className="p-3"></th>
              <th className="p-3">Payment rails</th>
              <th className="p-3">Developer gateways</th>
              <th className="bg-brand p-3 text-primary-foreground">Cosign</th>
            </tr>
          </thead>
          <tbody>
            {matrix.map(([k, ...v]) => (
              <tr key={k} className="border-b border-border last:border-0">
                <th className="p-3 font-semibold">{k}</th>
                {v.map((c, i) => <td key={i} className={`p-3 ${i === 2 ? "bg-brand-soft font-semibold" : "text-muted-foreground"}`}>{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="mb-4 mt-14 text-2xl font-semibold">How Cosign stays different</h3>
      <div className="grid gap-6 md:grid-cols-3">
        {edges.map(([t, d]) => (
          <div key={t} className="border-t-2 border-brand pt-4">
            <p className="text-lg font-semibold">{t}</p>
            <p className="mt-2 text-sm text-muted-foreground">{d}</p>
          </div>
        ))}
      </div>
      <p className="mt-8 rounded-2xl border border-gold/30 bg-gold-soft p-5 text-sm"><span className="font-semibold text-gold">Honest risk:</span> if NPCI or the card networks add their own approval inbox inside every UPI app, the payments half of Cosign becomes a feature. The defence is the other half — data, contracts, seller checks and family approvals — which no rail is built to handle.</p>
    </Band>
  );
}

export function Who() {
  const quotes = [
    "I can't tell what Mitra did on its own.",
    "I gave permissions in 12 apps and can't find them to cancel.",
    "If I get too many pop-ups, I just tap yes.",
    "Who protects Aai when a seller's agent pushes hers?",
  ];
  return (
    <Band id="who" label="The persona" title="Meet Kavya" tone="tint">
      <div className="grid gap-10 md:grid-cols-[1fr_1.4fr]">
        <div className="rounded-2xl border-2 border-ink bg-background p-7">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-ink font-display text-2xl font-semibold text-primary-foreground">KD</div>
          <h3 className="mt-5 text-3xl font-semibold">Kavya Deshpande, 41</h3>
          <p className="mt-1 text-muted-foreground">Schoolteacher in Nagpur · daily UPI user</p>
          <dl className="mt-6 space-y-3 text-sm">
            <div className="flex justify-between gap-4 border-b border-border pb-2"><dt>Her agent</dt><dd className="font-semibold">Mitra</dd></div>
            <div className="flex justify-between gap-4 border-b border-border pb-2"><dt>Agent actions a week</dt><dd className="font-semibold">~300 (assumed)</dd></div>
            <div className="flex justify-between gap-4 border-b border-border pb-2"><dt>Handles</dt><dd className="text-right font-semibold">Bills, groceries, school forms, Aai's medicines</dd></div>
            <div className="flex justify-between gap-4"><dt>Her mother</dt><dd className="text-right font-semibold">Sunanda, 72 · agent “Sakhi”</dd></div>
          </dl>
        </div>
        <div>
          <ul className="space-y-5">
            {quotes.map((q) => (
              <li key={q} className="font-display text-2xl font-medium leading-snug md:text-[28px]">“{q}”</li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-muted-foreground">Illustrative quotes for a fictional persona.</p>
          <div className="mt-6 flex flex-wrap gap-2 text-sm">
            {["Elders and teens with a family approver", "Sellers who want proof an order was wanted", "Agent makers", "Regulators"].map((s) => (
              <span key={s} className="rounded-full bg-background px-3 py-1.5">{s}</span>
            ))}
          </div>
        </div>
      </div>
    </Band>
  );
}

export function Metrics() {
  const m = [
    ["≤ 10", "asks per person per week"],
    ["5–30 s", "time to decide (under 3 s suggests blind tapping)"],
    ["Falling", "regret rate: approvals later undone or disputed"],
    ["≥ 99%", "hijack and flood attempts stopped"],
    ["< 10 s", "to cancel any permission"],
    ["90-day", "retention"],
  ];
  return (
    <Band id="metrics" label="Success" title="Protect more while asking less">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.3fr]">
        <div className="rounded-2xl bg-brand p-8 text-primary-foreground">
          <p className="text-sm opacity-80">North Star</p>
          <p className="mt-2 font-display text-7xl font-semibold">≥ 95%</p>
          <p className="mt-3 text-xl font-semibold">Protected-action rate</p>
          <p className="mt-2 opacity-80">Share of amber and red actions that had a valid cosign before they happened.</p>
        </div>
        <div>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-3">
            {m.map(([v, l]) => (
              <div key={l} className="bg-background p-5">
                <p className="font-display text-3xl font-semibold">{v}</p>
                <p className="mt-1 text-sm text-muted-foreground">{l}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl border border-gold/30 bg-gold-soft p-4">
            <p className="text-xs font-bold text-gold">Guardrail</p>
            <p className="text-sm">Agents' task completion must not drop by more than 5%.</p>
          </div>
          <div className="mt-4 rounded-xl border border-border p-4">
            <p className="font-semibold">First test</p>
            <p className="text-sm text-muted-foreground">A 4-week pilot with 1,000 users of an agent-shopping feature. A/B: Cosign against a normal confirm button, measuring regret rate and returns.</p>
          </div>
        </div>
      </div>
    </Band>
  );
}

export function GoToMarket() {
  const road = [
    ["Year 1", "Families, direct", "A free connector for AI assistants and a paid Family plan. No bank contract needed; the goal is real users and real numbers."],
    ["Year 2", "Banks and UPI apps", "“10,000 families already use Cosign” opens the door. Banks embed it and add the hard stop: no cosign, no payment."],
    ["Year 3+", "Merchants, insurers, agent makers", "Cosign-verified orders for merchants, a cosign guarantee with an insurer, and know-your-agent certification for agent companies."],
  ];
  const pay = [
    ["Families", "A Family plan for managing a parent's or teen's agents.", "Year 1"],
    ["Banks and UPI apps", "Per protected customer per month: fewer fraud losses and disputes.", "Year 2"],
    ["Agent companies", "Know-your-agent registration, so banks and merchants trust their agents.", "Year 2"],
    ["Merchants", "Cosign-verified orders that cut fake returns and disputes.", "Year 3"],
    ["Insurers", "A shared-premium guarantee on cosigned payments.", "Year 3"],
  ];
  const risks = [
    ["Families won't pay", "Test with interviews first; free connector as the entry point"],
    ["Without a bank, Cosign can't freeze money", "Control the agent's connector and alert the family until a bank or payment partner adds the hard stop"],
    ["The big UPI apps build it themselves", "Offer Cosign as a white-label layer; win smaller banks and apps first"],
    ["Too many asks", "Tiers, mandates, rate limits and bundling"],
  ];
  return (
    <Band id="market" label="Go to market" title="Families first to prove demand. Banks next for scale." tone="tint">
      <div className="grid gap-10 md:grid-cols-2">
        <p className="text-[17px] leading-relaxed">
          Banks buy slowly and want proof. Families feel the pain now — a parent's agent pushed by a seller, a teen's subscriptions. So Cosign starts <strong>direct to families</strong> through the AI assistants they already use, then takes that traction to banks, who add the <strong>hard stop</strong>: no cosign, no payment.
        </p>
        <div className="rounded-2xl bg-ink p-6 text-primary-foreground">
          <p className="text-sm text-[#e8c766]">First use case</p>
          <p className="mt-1 font-display text-2xl font-semibold leading-snug">“Your parents' agents can't spend above ₹1,000 without you.”</p>
          <p className="mt-2 text-sm opacity-80">A clear payer, the adult child, and a clear fear: fraud aimed at elders. The parent agrees and keeps their own phone.</p>
        </div>
      </div>
      <ol className="mt-12 grid gap-0 md:grid-cols-3">
        {road.map(([y, t, d], i) => (
          <li key={y} className="relative border-t-4 border-ink pr-6 pt-6">
            <span className={`absolute -top-[10px] left-0 h-4 w-4 rounded-full ${i === 0 ? "bg-gold-bright" : "bg-ink"}`} />
            <p className="font-display text-3xl font-semibold">{y}</p>
            <p className="mt-1 font-semibold">{t}</p>
            <p className="mt-1 pb-6 text-sm text-muted-foreground">{d}</p>
          </li>
        ))}
      </ol>
      <h3 className="mb-3 mt-10 text-xl font-semibold">Who pays (proposed)</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {pay.map(([w, d, when]) => (
          <div key={w} className="rounded-xl border border-border bg-background p-4">
            <p className="text-xs font-bold text-gold">{when}</p>
            <p className="mt-1 font-semibold">{w}</p>
            <p className="mt-1 text-sm text-muted-foreground">{d}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm text-muted-foreground">Not on the list: selling people's data. It would break trust in a trust product and run into DPDP rules.</p>
      <h3 className="mb-3 mt-10 text-xl font-semibold">Risks</h3>
      <div className="grid gap-3 md:grid-cols-2">
        {risks.map(([r, m]) => (
          <div key={r} className="rounded-xl border border-border bg-background p-4">
            <p className="font-semibold">{r}</p>
            <p className="mt-1 text-sm text-muted-foreground">{m}</p>
          </div>
        ))}
      </div>
    </Band>
  );
}

export function About() {
  return (
    <Band id="about" label="About" title="A DNS Labs concept, built by Dinesh Sundrani" tone="ink">
      <div className="grid gap-10 md:grid-cols-[auto_1fr]">
        <div className="flex h-28 w-28 items-center justify-center rounded-3xl bg-[#9cc3e8] font-display text-4xl font-semibold text-ink">DS</div>
        <div className="max-w-3xl space-y-4 text-[17px] leading-relaxed">
          <p>Cosign started from one question: when everyone has an AI agent acting for them, who makes sure a person still decides the things that can't be undone?</p>
          <p className="opacity-80">Dinesh Sundrani is an MS Entrepreneurship student at IIT Madras with a B.Tech in Electrical Engineering. He has worked in the Founder's Office at Exira, a financing platform for manufacturing MSMEs, and on the business side of Kriya Neuro Technologies, a neurotech startup from IIT Madras's Brain Lab — work that sits where hardware, money and trust meet.</p>
          <p className="opacity-80">DNS Labs is where he designs and prototypes product ideas like this one: researched, tested against the market, and built to be tried, not just read.</p>
        </div>
      </div>
    </Band>
  );
}

export function Sources() {
  const s = [
    ["Outlook Business — NPCI's Unified Agent Protocol for UPI", "https://www.outlookbusiness.com/economy/india-plans-ai-powered-upi-payments-framework-through-unified-agent-protocol"],
    ["Inc42 — NPCI to launch agentic payments on UPI", "https://inc42.com/buzz/npci-to-launch-agentic-payments-on-upi-report/"],
    ["Pine Labs — P3P, India's first agentic payment protocol on UPI", "https://www.pinelabs.com/media-analyst/the-ai-agent-can-now-pay-pine-labs-launches-p3p-indias-first-agentic-payment-protocol-built-on-upi"],
    ["Razorpay — Agentic Payments on Claude with NPCI", "https://razorpay.com/newsroom/razorpay-npci-launch-agentic-payments-on-claude-powering-zomato-swiggy-zepto-at-the-india-ai-impact-summit/"],
    ["Fortune — Mastercard and Visa's AI shopping land grab", "https://fortune.com/2026/09/18/mastercard-visa-ai-shopping-payment-land-grab/"],
    ["Visa — Five trends shaping agentic commerce", "https://www.visa.com/en-us/thought-leadership/innovation/five-trends-shaping-the-future-of-agentic-commerce"],
    ["Dealroom — Most startups building payments for AI agents were founded in 2025 or 2026", "https://dealroom.co/charts/startup-stack-ai-spending"],
    ["PIB — DPDP Consent Manager registration framework", "https://www.pib.gov.in/PressReleasePage.aspx?PRID=2336151"],
    ["AgentLock on Product Hunt", "https://www.producthunt.com/posts/1137504"],
    ["WorkOS — AI agent approval workflows with Airlock", "https://workos.com/blog/ai-agent-approval-policies-airlock"],
    ["Google Cloud — Announcing the Agent Payments Protocol (AP2)", "https://cloud.google.com/blog/products/ai-machine-learning/announcing-agents-to-payments-ap2-protocol/"],
    ["AP2 protocol documentation", "https://ap2-protocol.org/"],
    ["Auth0 — Asynchronous authorization for AI agents with CIBA", "https://auth0.com/ai/docs/intro/asynchronous-authorization"],
    ["MediaNama — NPCI chairman on AI agents at GFF 2026", "https://www.medianama.com/2026/09/223-npci-ai-agents-upi-payments/"],
    ["BusinessWorld — NPCI to end UPI collect requests for P2P", "https://www.businessworld.in/article/npci-to-end-upi-collect-request-for-p2p-payments-in-oct-567598"],
    ["MediaNama — RBI e-mandate additional factor authentication, 2026", "https://www.medianama.com/2026/04/223-rbi-additional-factor-authentication-e-mandates/"],
    ["Business Standard — NPCI launches UPI Circle", "https://www.business-standard.com/finance/personal-finance/npci-launches-upi-circle-for-secure-delegated-payments-with-trusted-users-124081900536_1.html"],
    ["Nouwens et al. 2020 — Dark Patterns after the GDPR", "https://arxiv.org/abs/2001.02479"],
    ["Greshake et al. 2023 — Indirect prompt injection", "https://arxiv.org/abs/2302.12173"],
  ];
  return (
    <section id="sources" className="px-5 py-20">
      <div className="mx-auto max-w-[1240px]">
        <h2 className="text-[32px] font-semibold">Sources</h2>
        <ol className="mt-6 grid list-decimal gap-x-10 gap-y-2 pl-6 md:grid-cols-2">
          {s.map(([t, u]) => (
            <li key={u}><a href={u} target="_blank" rel="noreferrer" className="underline decoration-brand decoration-2 underline-offset-4 hover:text-ink-soft">{t}</a></li>
          ))}
        </ol>
        <p className="mt-6 text-sm text-muted-foreground">Several 2026 items come from news reports, and NPCI had not formally published the Unified Agent Protocol's details when they were written. Check the sources before relying on them.</p>
      </div>
    </section>
  );
}

export function Footer() {
  const cols: [string, [string, string][]][] = [
    ["Product", [["How it works", "#how"], ["Under the hood", "#tech"], ["Live demo", "#demo"], ["Landscape", "#landscape"], ["Metrics", "#metrics"]]],
    ["Company", [["Go to market", "#market"], ["Build log", "#build"], ["About", "#about"], ["FAQ", "#faq"], ["Sources", "#sources"]]],
  ];
  return (
    <footer className="border-t border-border px-5 pb-24 pt-12 text-sm text-muted-foreground">
      <div className="mx-auto grid max-w-[1240px] gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <p className="flex items-center gap-2 font-display text-lg font-semibold text-ink"><Mark className="h-6 w-6" /> Cosign <span className="font-sans text-sm font-normal text-muted-foreground">by DNS Labs</span></p>
          <p className="mt-3 max-w-sm">Your agent proposes. You cosign. A product concept; all people, agents and sellers in the demo are fictional.</p>
        </div>
        {cols.map(([h, links]) => (
          <div key={h}>
            <p className="font-semibold text-ink">{h}</p>
            <ul className="mt-3 space-y-2">{links.map(([l, href]) => <li key={l}><a href={href} className="hover:text-ink">{l}</a></li>)}</ul>
          </div>
        ))}
      </div>
      <div className="mx-auto mt-10 flex max-w-[1240px] flex-wrap justify-between gap-2 border-t border-border pt-6">
        <p>© 2026 DNS Labs</p>
        <p>Built by <span className="font-semibold text-ink">Dinesh Sundrani</span></p>
      </div>
    </footer>
  );
}
