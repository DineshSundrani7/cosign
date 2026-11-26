import type { ReactNode } from "react";
import { Reveal } from "./Sections";

function Head({ id, label, title, kicker, dark = false, children }: { id: string; label: string; title: string; kicker?: string; dark?: boolean; children: ReactNode }) {
  return (
    <section id={id} className={`px-5 py-20 md:py-24 ${dark ? "bg-ink text-primary-foreground" : ""}`}>
      <div className="mx-auto max-w-[1240px]">
        <Reveal>
          <p className={`text-sm font-semibold ${dark ? "text-[#e8c766]" : "text-gold"}`}>{label}</p>
          <h2 className="mt-2 max-w-3xl text-[32px] font-semibold leading-[1.08] md:text-[46px]">{title}</h2>
          {kicker && <p className={`mt-4 max-w-2xl text-[17px] ${dark ? "opacity-80" : "text-muted-foreground"}`}>{kicker}</p>}
        </Reveal>
        <Reveal delay={0.1}><div className="mt-10">{children}</div></Reveal>
      </div>
    </section>
  );
}

/* ---------- Under the hood: the request pipeline ---------- */
const PIPE: { who: string; step: string; detail: string; tone: "agent" | "cosign" | "you" | "rail" }[] = [
  { who: "Agent", step: "Sends a signed request", detail: "Action, amount, payee, data used, can it be undone, the seller's claims — signed with the agent's registered key.", tone: "agent" },
  { who: "Cosign", step: "Gateway checks identity", detail: "Valid signature? Registered and not paused? Within its rate limit? If not, the request is blocked here.", tone: "cosign" },
  { who: "Cosign", step: "Policy engine sorts it", detail: "Your mandates decide green, amber or red. Risk checks add new-payee, timing and seller-claim signals.", tone: "cosign" },
  { who: "You", step: "Decide on your phone", detail: "Green is signed under your mandate. Amber and red reach your phone; your PIN unlocks a key in its secure chip that signs this exact request.", tone: "you" },
  { who: "Cosign", step: "Returns an approval token", detail: "Valid for this action, amount and payee only, single use, expires in minutes.", tone: "cosign" },
  { who: "Bank or rail", step: "Verifies, then executes", detail: "No valid token for an amber or red action means no execution. This is where Cosign is enforced.", tone: "rail" },
  { who: "Everyone", step: "Gets the signed receipt", detail: "Written to a tamper-evident log. Powers the 48-hour undo, disputes and the regret-rate metric.", tone: "cosign" },
];
const toneCls = {
  agent: "bg-secondary text-ink",
  cosign: "bg-gold text-white",
  you: "bg-brand text-white",
  rail: "bg-ink text-primary-foreground",
};

export function UnderTheHood() {
  const standards = [
    ["Google AP2 mandates", "Signed intent and cart mandates prove what the user approved, down to items and price."],
    ["OpenID CIBA", "The standard way for an agent's backend to ask a user for approval on a separate device."],
    ["UPI mandates and NPCI's agent registry", "Reserve Pay, mandates and the reported Unified Agent Protocol verify agents and limits for payments."],
    ["DPDP consent managers", "The regulated route for giving and withdrawing consent to share personal data."],
  ];
  return (
    <Head id="tech" label="Under the hood" title="Cosign doesn't watch agents. Agents must bring it a signed yes." kicker="The same reason UPI works: the bank won't move money without your PIN. Cosign doesn't invent a new protocol — it is the person's decision layer on top of standards that already exist.">
      <div className="grid gap-10 lg:grid-cols-[1.25fr_0.75fr]">
        <ol className="relative space-y-3">
          <span className="absolute bottom-6 left-[27px] top-6 w-px bg-gold/40" aria-hidden />
          {PIPE.map((p, i) => (
            <li key={p.step} className="relative flex gap-4">
              <span className="z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-gold/40 bg-background font-display text-xl font-semibold text-gold">{i + 1}</span>
              <div className="flex-1 rounded-2xl border border-border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${toneCls[p.tone]}`}>{p.who}</span>
                  <p className="font-semibold">{p.step}</p>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{p.detail}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="space-y-4">
          <div className="rounded-2xl bg-gold-soft p-6">
            <p className="font-display text-xl font-semibold">Set up once</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li><span className="font-semibold">Agents register</span> and get a verified identity and signing key.</li>
              <li><span className="font-semibold">You link them</span> to your Cosign address, like linking a bank account to a UPI ID, and set your mandates.</li>
              <li><span className="font-semibold">Your phone creates a key</span> in its secure chip. Only your PIN or fingerprint unlocks it.</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-border p-6">
            <p className="font-display text-xl font-semibold">Built on existing standards</p>
            <dl className="mt-3 space-y-3 text-sm">
              {standards.map(([k, v]) => (
                <div key={k}><dt className="font-semibold">{k}</dt><dd className="text-muted-foreground">{v}</dd></div>
              ))}
            </dl>
          </div>
          <p className="rounded-2xl border border-gold/30 bg-gold-soft p-4 text-sm"><span className="font-semibold text-gold">The honest gap:</span> step 6 only works where the executor demands the token. Direct to families, Cosign controls the agent's payment connector and alerts the family; banks and UPI apps add the hard stop because they hold the money.</p>
          <p className="rounded-2xl border border-gold/40 bg-gold-soft p-4 text-sm"><span className="font-semibold">Working v0:</span> steps 1–7 run in code, with signatures, tokens, a mock bank and tests — and you can run them yourself in the next section.</p>
        </div>
      </div>
    </Head>
  );
}

/* ---------- Build log: how it was made with AI ---------- */
export function BuildLog() {
  const log = [
    ["Started with a hunch", "Personal AI agents will spend money and share data for us. Today's consent is either “allow all” or a flood of pop-ups. The first version was a “UPI PIN for agents”."],
    ["Researched the market with AI", "Used Claude to map 15+ players: NPCI's agent protocol, Pine Labs P3P, Razorpay, Visa, Mastercard, Google AP2, developer approval gateways and DPDP consent managers."],
    ["Pivoted on what we found", "The payment plumbing was already being built by much bigger players. So Cosign moved from “a new rail” to “the person's decision layer on top of the rails” — covering money, data and contracts — and got its new name."],
    ["Built a working prototype", "This website's phone demo, chat assistant, read-aloud and 2010–2040 journey — written in React with AI pair-programming."],
    ["Built the core backend (v0)", "Real signed agent requests, a policy engine, PIN-locked device keys, single-use approval tokens, a mock bank that refuses without a cosign, Family Circle approvals, seller-claim checks, 48-hour undo, a hash-chained receipt log, SQLite persistence and an MCP connector so a real AI assistant must ask first. The bank and money are simulated."],
    ["Made it clickable", "A browser port of the engine on this page: real keys, signatures, PIN lock and bank checks running on the visitor's own device, so anyone can try the attacks."],
    ["Tested it", "17 automated backend tests (forgery, tampering, replay, flooding, expired tokens, Family Circle, seller claims, undo, edited receipts, restarts), every demo scenario clicked through on desktop and phone sizes, and an automated WCAG 2.1 AA check with no violations."],
    ["What's next", "Five interviews with families managing a parent's finances, one conversation with a bank's digital team, and a pilot measuring regret rate and fraud stopped."],
  ];
  return (
    <Head id="build" label="Build log" title="How this was made with AI" kicker="Claude did the research legwork and wrote most of the code. I set the direction and made the product calls: the problem, the pivot, the name, and what to leave out.">
      <ol className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {log.map(([t, d], i) => (
          <li key={t} className="rounded-2xl border border-border p-6">
            <p className="font-display text-3xl font-semibold text-gold">{i + 1}</p>
            <p className="mt-2 text-lg font-semibold">{t}</p>
            <p className="mt-2 text-sm text-muted-foreground">{d}</p>
          </li>
        ))}
      </ol>
    </Head>
  );
}
