import { motion, useMotionValueEvent, useScroll, useSpring, useTransform } from "framer-motion";
import { useRef, useState } from "react";

type Stop = { year: string; title: string; text: string; future?: boolean; cosign?: boolean };

/* Facts up to 2026 come from public records and the news reports in Sources; 2027 onwards is the Cosign scenario. */
const STOPS: Stop[] = [
  { year: "2010", title: "Every Indian gets a digital identity", text: "The first Aadhaar numbers are issued. Proving who you are starts moving online." },
  { year: "2016", title: "UPI makes money move with a PIN", text: "Request, PIN, receipt — a habit hundreds of millions of people learn by heart." },
  { year: "2020", title: "UPI AutoPay", text: "Standing mandates let bills and subscriptions go through without asking every time." },
  { year: "2023", title: "A law for personal data", text: "The Digital Personal Data Protection Act sets out how consent to use your data must work." },
  { year: "2024", title: "UPI Circle", text: "You can let someone you trust pay on your behalf, within limits you set." },
  { year: "2025", title: "AI agents start to pay", text: "A ChatGPT-and-UPI pilot tests agent payments. NPCI ends P2P collect requests because of fraud." },
  { year: "2026", title: "Rails for agents", text: "Pine Labs' P3P goes live, NPCI's agent protocol is reported, and DPDP consent managers can register." },
  { year: "2027", title: "Cosign Family launches", text: "Families connect Cosign to their AI assistants: a parent's agent can't spend above their limit without a family cosign.", future: true, cosign: true },
  { year: "2030", title: "Banks embed Cosign", text: "Banks and UPI apps add “Protected by Cosign” — and refuse agent payments that come without a cosign.", future: true, cosign: true },
  { year: "2040", title: "Agents act. People still decide.", text: "Agents handle hundreds of actions a week for Kavya. The few that can't be undone wait for her cosign.", future: true, cosign: true },
];

export function Journey() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 65%", "end 55%"] });
  const p = useSpring(scrollYProgress, { stiffness: 120, damping: 24, mass: 0.4 });
  const top = useTransform(p, [0, 1], ["0%", "100%"]);
  const fill = useTransform(p, [0, 1], ["0%", "100%"]);
  const [active, setActive] = useState(0);
  const [year, setYear] = useState(2010);
  const items = useRef<(HTMLLIElement | null)[]>([]);
  useMotionValueEvent(p, "change", (v) => {
    const c = Math.min(1, Math.max(0, v));
    const box = ref.current;
    if (!box) return;
    const y = c * box.offsetHeight; // where the ball is, in px from the top of the list
    const tops = items.current.map((el) => (el ? el.offsetTop + 14 : 0));
    let i = 0;
    while (i < tops.length - 1 && tops[i + 1] <= y) i++;
    setActive(i);
    const a = Number(STOPS[i].year), next = STOPS[i + 1] ? Number(STOPS[i + 1].year) : a;
    const span = (tops[i + 1] ?? tops[i] + 1) - tops[i];
    const t = Math.min(1, Math.max(0, (y - tops[i]) / (span || 1)));
    setYear(Math.round(a + (next - a) * t));
  });
  const now = STOPS[active];

  return (
    <section id="journey" className="relative overflow-hidden bg-gold-soft px-5 py-20 md:py-24">
      <div className="pointer-events-none absolute -left-40 top-20 h-[520px] w-[520px] rounded-full bg-gold-bright/20 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -right-40 bottom-10 h-[420px] w-[420px] rounded-full bg-brand/10 blur-3xl" aria-hidden />
      <div className="relative mx-auto grid max-w-[1240px] gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <p className="text-sm font-semibold text-gold">The journey</p>
          <h2 className="mt-2 text-[32px] font-semibold leading-[1.08] md:text-[46px]">From a PIN for money to a cosign for everything</h2>
          <p className="mt-4 max-w-md text-[17px] text-muted-foreground">Scroll to travel from 2010 to 2040. Each step made it easier for software to act for us — and raised the question of who decides.</p>
          <div className="mt-8 hidden rounded-3xl border border-gold/30 bg-background/70 p-6 backdrop-blur lg:block" aria-hidden>
            <p className="font-display text-7xl font-semibold tabular-nums text-gold">{year}</p>
            <p className="mt-2 text-lg font-semibold">{now.title}</p>
            <p className={`mt-1 text-sm font-semibold ${now.future ? "text-gold" : "text-muted-foreground"}`}>{now.future ? "The Cosign scenario" : "What happened"}</p>
          </div>
        </div>

        <div ref={ref} className="relative pl-12">
          <div className="absolute bottom-2 left-[15px] top-2 w-[3px] rounded-full bg-gold/20" aria-hidden>
            <motion.div className="w-full rounded-full bg-gradient-to-b from-brand via-gold-bright to-seal" style={{ height: fill }} />
            <motion.div className="absolute left-1/2" style={{ top }}>
              <span className="absolute -left-[13px] -top-[13px] block h-[26px] w-[26px] rounded-full bg-gold-bright shadow-[0_0_0_7px_rgba(201,151,40,0.18),0_0_32px_8px_rgba(201,151,40,0.45)]" />
              <span className="absolute -left-[5px] -top-[5px] block h-[10px] w-[10px] rounded-full bg-white" />
            </motion.div>
          </div>
          <ol className="space-y-10">
            {STOPS.map((s, i) => {
              const on = i <= active;
              return (
                <li key={s.year} ref={(el) => { items.current[i] = el; }} className="relative">
                  <span className={`absolute -left-[42px] top-2 h-3 w-3 rounded-full border-2 transition-colors duration-300 ${on ? (s.future ? "border-gold bg-gold" : "border-brand bg-brand") : "border-gold/40 bg-background"}`} aria-hidden />
                  <div className={`rounded-2xl border p-5 transition-all duration-500 ${i === active ? "border-gold bg-background shadow-[0_18px_40px_-20px_rgba(201,151,40,0.55)]" : on ? "border-border bg-background/80" : "border-transparent bg-background/50"}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-2xl font-semibold tabular-nums">{s.year}</span>
                      {s.cosign && <span className="rounded-full bg-gold px-2 py-0.5 text-xs font-bold text-white">Cosign</span>}
                      {s.future && !s.cosign && <span className="rounded-full bg-gold-soft px-2 py-0.5 text-xs font-bold text-gold">Scenario</span>}
                    </div>
                    <h3 className="mt-1 text-xl font-semibold">{s.title}</h3>
                    <p className="mt-1 text-muted-foreground">{s.text}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
