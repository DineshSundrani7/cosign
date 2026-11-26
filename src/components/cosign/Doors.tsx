import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { Mark } from "./Stamp";

/* Two ways in: straight to people and families, and through banks and UPI apps.
   On scroll, lines draw out from Cosign and each door swings open to reveal its side. */
function Door({ label, sub, delay, children }: { label: string; sub: string; delay: number; children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <div className="relative [perspective:1600px]">
      <div className="h-full rounded-3xl border border-border bg-background p-7 shadow-[0_24px_60px_-30px_rgba(16,19,26,0.35)]">{children}</div>
      {!reduce && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex flex-col justify-between rounded-3xl bg-ink p-7 text-primary-foreground [backface-visibility:hidden]"
          style={{ transformOrigin: "left center" }}
          initial={{ rotateY: 0, opacity: 1 }}
          whileInView={{ rotateY: -108, opacity: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ delay, duration: 1.1, ease: [0.6, 0.05, 0.2, 1] }}
        >
          <div className="rounded-2xl border border-white/15 p-4">
            <p className="text-sm text-[#e8c766]">Door</p>
            <p className="mt-1 font-display text-3xl font-semibold">{label}</p>
            <p className="mt-1 text-sm opacity-70">{sub}</p>
          </div>
          <div className="flex items-end justify-between">
            <div className="h-24 w-[45%] rounded-xl border border-white/10" />
            <span className="mb-10 mr-1 h-3 w-10 rounded-full bg-[#e8c766]" />
          </div>
        </motion.div>
      )}
    </div>
  );
}

export function TwoDoors() {
  const reduce = useReducedMotion();
  const draw = (delay: number) => (reduce ? {} : { initial: { pathLength: 0 }, whileInView: { pathLength: 1 }, viewport: { once: true, amount: 0.8 }, transition: { delay, duration: 0.9, ease: "easeInOut" as const } });
  return (
    <section id="doors" className="relative overflow-hidden px-5 py-20 md:py-24">
      <div className="pointer-events-none absolute left-1/2 top-24 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-gold-bright/15 blur-3xl" aria-hidden />
      <div className="relative mx-auto max-w-[1240px]">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold text-gold">Two doors in</p>
          <h2 className="mt-2 text-[32px] font-semibold leading-[1.08] md:text-[46px]">Straight to families first. Through banks next.</h2>
          <p className="mx-auto mt-4 max-w-xl text-[17px] text-muted-foreground">Families can start today through the AI assistants they already use. Banks add the hard stop: no cosign, no payment.</p>
        </div>

        <div className="relative mx-auto mt-10 hidden h-28 max-w-[900px] md:block" aria-hidden>
          <svg viewBox="0 0 900 112" className="absolute inset-0 h-full w-full" fill="none">
            <motion.path d="M450 40 C 450 80, 225 60, 225 112" stroke="var(--gold-bright)" strokeWidth="2.5" strokeLinecap="round" {...draw(0.2)} />
            <motion.path d="M450 40 C 450 80, 675 60, 675 112" stroke="var(--brand)" strokeWidth="2.5" strokeLinecap="round" {...draw(0.35)} />
          </svg>
          <div className="absolute left-1/2 top-0 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-background px-4 py-2 font-display text-lg font-semibold shadow-sm">
            <Mark className="h-7 w-7" /> Cosign
          </div>
        </div>

        <div className="mt-8 grid gap-6 md:mt-0 md:grid-cols-2">
          <Door label="For people" sub="and their families" delay={0.9}>
            <span className="rounded-full bg-gold-soft px-3 py-1 text-xs font-bold text-gold">Year 1 · direct</span>
            <h3 className="mt-4 text-2xl font-semibold">For people and families</h3>
            <p className="mt-2 text-muted-foreground">No bank contract needed. Start where agents already live.</p>
            <ul className="mt-5 space-y-3 text-sm">
              <li><span className="font-semibold">Free connector for your AI assistant</span> — your agent has to ask Cosign before it pays or shares anything.</li>
              <li><span className="font-semibold">Family plan</span> — a parent's or teen's agent can't go above their limit without your cosign. They keep their own phone and independence.</li>
              <li><span className="font-semibold">One place for every receipt</span> — what every agent did, with a 48-hour undo and disputes.</li>
            </ul>
            <a href="#demo" className="mt-6 inline-block rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-primary-foreground">Try the family demo</a>
          </Door>

          <Door label="For banks" sub="and UPI apps" delay={1.15}>
            <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-brand">Year 2 · embedded</span>
            <h3 className="mt-4 text-2xl font-semibold">For banks and UPI apps</h3>
            <p className="mt-2 text-muted-foreground">“Protected by Cosign” inside the app your customers already trust.</p>
            <ol className="mt-5 space-y-3 text-sm">
              <li><span className="font-semibold">1. Add the SDK</span> — approval requests appear inside your app, marked Protected by Cosign.</li>
              <li><span className="font-semibold">2. Route agent payments to Cosign</span> — your customers' limits, Circle and receipts come built in.</li>
              <li><span className="font-semibold">3. Verify the token before you release money</span> — offline, with Cosign's public keys. No token, no payment.</li>
            </ol>
            <p className="mt-4 text-sm text-muted-foreground">You get fewer fraud losses and disputes, and a trust feature you don't have to build.</p>
            <a href="#tech" className="mt-6 inline-block rounded-full border-2 border-ink px-5 py-2 text-sm font-semibold">See under the hood</a>
          </Door>
        </div>
      </div>
    </section>
  );
}
