import { useEffect, useRef, useState } from "react";
import { Engine, engineSupported, type Decision } from "./engine";
import { Reveal } from "./Sections";

type Line = { kind: "ok" | "no" | "info" | "head"; text: string; mono?: string };
const short = (t: string) => `${t.slice(0, 22)}…${t.slice(-10)}`;

export function LiveEngine() {
  const [engine, setEngine] = useState<Engine | null>(null);
  const [failed, setFailed] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [busy, setBusy] = useState(false);
  const [pin, setPin] = useState("");
  const green = useRef<Decision | null>(null);
  const amber = useRef<Decision | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const boot = async () => {
    try {
      const e = await Engine.create();
      setEngine(e);
      green.current = null; amber.current = null;
      setLines([
        { kind: "head", text: "Engine ready — keys generated in this browser" },
        { kind: "info", text: "Cosign issuer key", mono: `${e.issuerPubHex.slice(0, 32)}…` },
        { kind: "info", text: "Mitra (agent) key", mono: `${e.agentPubHex.slice(0, 32)}…` },
        { kind: "info", text: "Kavya's device key: locked with PIN 1234 (PBKDF2 + AES-GCM)" },
        { kind: "info", text: "Kavya's limit: groceries ≤ ₹3,000 an order at FreshBasket" },
      ]);
    } catch { setFailed(true); }
  };
  useEffect(() => { if (engineSupported()) boot(); else setFailed(true); }, []);
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" }); }, [lines]);

  const add = (...l: Line[]) => setLines((x) => [...x, ...l]);
  const run = async (title: string, fn: (e: Engine) => Promise<void>) => {
    if (!engine || busy) return;
    setBusy(true);
    add({ kind: "head", text: title });
    if (window.innerWidth < 1024) logRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    try { await fn(engine); } catch (err) { add({ kind: "no", text: (err as Error).message }); }
    setBusy(false);
  };
  const showDecision = (d: Decision) => {
    add({ kind: d.status === "blocked" ? "no" : d.status === "approved" ? "ok" : "info", text: `Cosign: ${d.tier.toUpperCase()} · ${d.status} — ${d.reasons.join("; ")}` });
    if (d.hash) add({ kind: "info", text: "Request hash (SHA-256)", mono: `${d.hash.slice(0, 32)}…` });
    if (d.token) add({ kind: "ok", text: "Approval token (Ed25519-signed, single use, 5 min)", mono: short(d.token) });
  };

  const steps: { group: string; items: { label: string; act: () => void; needsPin?: boolean }[] }[] = [
    {
      group: "Inside the limit",
      items: [
        { label: "Mitra asks: groceries ₹2,140", act: () => run("Mitra signs a request: ₹2,140 to FreshBasket", async (e) => {
          const req = await e.agentRequest({ amount: 2140, payee: "FreshBasket", category: "groceries", purpose: "Weekly groceries" });
          add({ kind: "info", text: "Agent signature", mono: `${req.signature.slice(0, 32)}…` });
          const d = await e.submit(req); green.current = d; showDecision(d);
        }) },
        { label: "Bank pays with the token", act: () => run("Bank verifies the token offline, then pays", async (e) => {
          if (!green.current?.token) return add({ kind: "no", text: "Run “Mitra asks: groceries” first" });
          const r = await e.bankPay({ to: "FreshBasket", amount: 2140, token: green.current.token }); add({ kind: r.ok ? "ok" : "no", text: r.text });
        }) },
        { label: "Replay the same token", act: () => run("Someone sends the same token again", async (e) => {
          if (!green.current?.token) return add({ kind: "no", text: "Run the first two steps first" });
          const r = await e.bankPay({ to: "FreshBasket", amount: 2140, token: green.current.token }); add({ kind: r.ok ? "ok" : "no", text: r.text });
        }) },
      ],
    },
    {
      group: "Above the limit",
      items: [
        { label: "Mitra asks: insurance ₹18,400", act: () => run("Mitra signs a request: ₹18,400 to Suraksha General", async (e) => {
          const d = await e.submit(await e.agentRequest({ amount: 18400, payee: "Suraksha General", category: "insurance", purpose: "Renew health insurance" }));
          amber.current = d; showDecision(d);
        }) },
        { label: "Mitra tries to pay right away", act: () => run("Mitra tries to pay before Kavya decides", async (e) => {
          const r = await e.bankPay({ to: "Suraksha General", amount: 18400, token: amber.current?.token }); add({ kind: r.ok ? "ok" : "no", text: r.text });
        }) },
        { label: "Approve with PIN", needsPin: true, act: () => run(`Kavya enters PIN “${pin.replace(/./g, "•")}” on her phone`, async (e) => {
          if (!amber.current || amber.current.status !== "pending") return add({ kind: "no", text: "Nothing is waiting — run “Mitra asks: insurance” first" });
          const d = await e.approve(amber.current.id, pin); amber.current = d;
          add({ kind: "ok", text: "Device key unlocked — it signed this exact request" }); showDecision(d);
        }) },
        { label: "Bank pays with the token", act: () => run("Bank verifies the token and Kavya's device signature", async (e) => {
          if (!amber.current?.token) return add({ kind: "no", text: "Approve with the PIN first" });
          const r = await e.bankPay({ to: "Suraksha General", amount: 18400, token: amber.current.token }); add({ kind: r.ok ? "ok" : "no", text: r.text });
        }) },
        { label: "Tamper: make it ₹28,400", act: () => run("Someone edits the token's amount to ₹28,400", async (e) => {
          if (!amber.current?.token) return add({ kind: "no", text: "Approve with the PIN first" });
          const r = await e.bankPay({ to: "Suraksha General", amount: 28400, token: Engine.tamper(amber.current.token, 28400) }); add({ kind: r.ok ? "ok" : "no", text: r.text });
        }) },
      ],
    },
    {
      group: "Attacks",
      items: [
        { label: "Forged request (wrong key)", act: () => run("A hijacked page forges a request as Mitra: ₹9,999 to refund-desk", async (e) => {
          showDecision(await e.submit(await e.agentRequest({ amount: 9999, payee: "refund-desk", category: "refund", purpose: "Pending refund" }, Engine.randomKey())));
        }) },
      ],
    },
  ];

  return (
    <section id="engine" className="bg-gold-soft px-5 py-20 md:py-24">
      <div className="mx-auto max-w-[1240px]">
        <Reveal>
          <p className="text-sm font-semibold text-gold">Try the real engine</p>
          <h2 className="mt-2 max-w-3xl text-[32px] font-semibold leading-[1.08] md:text-[46px]">Don't take the page's word for it. Run it.</h2>
          <p className="mt-4 max-w-2xl text-[17px] text-muted-foreground">A browser port of the Cosign v0 engine. The keys, Ed25519 signatures, SHA-256 hashes and PIN lock are real and run on your device — nothing is sent anywhere. The bank and money are simulated.</p>
        </Reveal>
        <div className="mt-10 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-5">
            {failed && <p className="rounded-xl border border-border bg-background p-4 text-sm">This browser can't run the engine (it needs Web Crypto). Try a recent Chrome, Edge, Safari or Firefox.</p>}
            {steps.map((g) => (
              <div key={g.group} className="rounded-2xl border border-border bg-background p-4">
                <p className="mb-3 text-sm font-semibold text-muted-foreground">{g.group}</p>
                <div className="flex flex-wrap gap-2">
                  {g.items.map((it) => (
                    <span key={it.label} className="flex flex-wrap items-center gap-2">
                      {it.needsPin && (
                        <>
                          <label htmlFor="engine-pin" className="sr-only">PIN</label>
                          <input id="engine-pin" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" placeholder="PIN (1234)" className="min-h-11 w-28 rounded-xl border border-input px-3 text-base" />
                        </>
                      )}
                      <button onClick={it.act} disabled={!engine || busy || (it.needsPin && pin.length !== 4)} className="min-h-11 rounded-xl border border-ink/15 bg-secondary px-3 text-sm font-semibold hover:bg-ink hover:text-primary-foreground disabled:opacity-40">{it.label}</button>
                    </span>
                  ))}
                </div>
              </div>
            ))}
            <button onClick={() => { setPin(""); boot(); }} disabled={busy} className="rounded-full border-2 border-ink px-5 py-2 text-sm font-semibold">Reset with fresh keys</button>
          </div>
          <div ref={logRef} className="h-[520px] overflow-y-auto rounded-2xl bg-ink p-5 font-mono text-[13px] leading-relaxed text-primary-foreground" aria-live="polite" aria-label="Engine log">
            {lines.length === 0 && <p className="opacity-60">{failed ? "Engine unavailable." : "Generating keys…"}</p>}
            {lines.map((l, i) => (
              <div key={i} className={l.kind === "head" ? "mt-4 font-sans font-semibold text-[#e8c766] first:mt-0" : "mt-1"}>
                {l.kind === "ok" && <span className="text-[#3dcf91]">✓ </span>}
                {l.kind === "no" && <span className="text-[#ff6b6b]">✗ </span>}
                {l.kind === "info" && <span className="opacity-50">· </span>}
                <span className={l.kind === "info" ? "opacity-80" : ""}>{l.text}</span>
                {l.mono && <span className="block break-all pl-4 opacity-60">{l.mono}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
