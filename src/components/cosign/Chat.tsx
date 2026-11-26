import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { FAQ, SITE_FACTS, faqAnswer } from "./faq";
import { Mark } from "./Stamp";

type Msg = { role: "user" | "assistant"; content: string };
type Sample = ((input: Msg[] | string, opts?: Record<string, unknown>) => Promise<{ text: string }>) | null;

const ALL_QS = FAQ.filter((f) => !f.hidden).map((f) => f.q);

/* Uses Claude when the page runs on claude.ai; everywhere else (e.g. Vercel) it answers from the FAQ. */
export function Chat() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([{ role: "assistant", content: "Hi! Type any question about Cosign below, or tap one of the suggestions." }]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [sample, setSample] = useState<Sample>(null);
  const [showAll, setShowAll] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const asked = new Set(msgs.filter((m) => m.role === "user").map((m) => m.content));
  const fresh = ALL_QS.filter((q) => !asked.has(q));
  const chips = showAll ? fresh : fresh.slice(0, 4);

  useEffect(() => {
    let alive = true;
    try {
      const c = (window as unknown as { claude?: { use?: (n: string) => Promise<unknown> } }).claude;
      c?.use?.("sample").then((s) => { if (alive && typeof s === "function") setSample(() => s as Sample); }).catch(() => {});
    } catch { /* not on claude.ai */ }
    return () => { alive = false; };
  }, []);

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight }); }, [msgs, open]);
  useEffect(() => { if (open) window.setTimeout(() => inputRef.current?.focus(), 200); }, [open]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const send = async (q: string) => {
    const question = q.trim();
    if (!question || busy) return;
    const history: Msg[] = [...msgs, { role: "user", content: question }];
    setMsgs([...history, { role: "assistant", content: "…" }]);
    setText("");
    setBusy(true);
    const put = (content: string) => setMsgs((m) => [...m.slice(0, -1), { role: "assistant", content }]);
    if (sample) {
      const brief = `You are the help assistant on the Cosign website (a product concept by DNS Labs, built by Dinesh Sundrani). Answer the visitor's latest message in 2-4 short, plain sentences, using only these facts. Answer the specific question asked, not a general overview. If the facts don't cover it, say so briefly and suggest the FAQ or the live demo. Never invent prices, dates, partners or features.\n\nFACTS:\n${SITE_FACTS}`;
      let convo = history.slice(1).slice(-8);
      while (convo.length && convo[0].role !== "user") convo = convo.slice(1);
      const prompt: Msg[] = [{ role: "user", content: `${brief}\n\nVisitor: ${convo[0]?.content ?? question}` }, ...convo.slice(1)];
      try {
        const r = await sample(prompt, { modelTier: "quick", cache: false, onText: ({ text: t }: { text: string }) => put(t) });
        put(r.text || faqAnswer(question));
      } catch {
        put(faqAnswer(question));
      }
    } else {
      window.setTimeout(() => put(faqAnswer(question)), 350);
    }
    setBusy(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="cosign-chat"
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-ink py-2.5 pl-2.5 pr-4 font-semibold text-primary-foreground shadow-xl"
      >
        <Mark className="h-7 w-7" /> {open ? "Close" : "Ask Cosign"}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            id="cosign-chat"
            role="dialog"
            aria-label="Ask Cosign"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.18 }}
            className="fixed bottom-20 right-3 z-50 flex h-[min(560px,75vh)] w-[min(380px,calc(100vw-24px))] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
          >
            <div className="flex items-center gap-2 border-b border-border bg-ink px-4 py-3 text-primary-foreground">
              <Mark className="h-7 w-7" />
              <div>
                <p className="font-semibold leading-tight">Ask Cosign</p>
                <p className="text-xs opacity-70">{sample ? "AI answers from Cosign's facts" : "Instant answers from the FAQ"}</p>
              </div>
            </div>
            <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
              {msgs.map((m, i) => (
                <p key={i} className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${m.role === "user" ? "ml-auto bg-brand text-primary-foreground" : "bg-secondary"}`}>{m.content}</p>
              ))}
            </div>
            <div className={`flex flex-wrap gap-1.5 px-4 pb-2 ${showAll ? "max-h-40 overflow-y-auto" : ""}`}>
              {chips.map((s) => (
                <button key={s} onClick={() => send(s)} disabled={busy} className="rounded-full border border-border px-2.5 py-1 text-xs hover:bg-secondary">{s}</button>
              ))}
              {fresh.length > 4 && (
                <button onClick={() => setShowAll((v) => !v)} className="rounded-full px-2.5 py-1 text-xs font-semibold text-brand underline">{showAll ? "Fewer" : `More questions (${fresh.length - 4})`}</button>
              )}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); send(text); }} className="flex gap-2 border-t border-border p-3">
              <label htmlFor="cosign-chat-input" className="sr-only">Your question</label>
              <input ref={inputRef} id="cosign-chat-input" autoComplete="off" value={text} onChange={(e) => setText(e.target.value)} placeholder="Type your own question…" className="min-h-11 flex-1 rounded-xl border border-input px-3 text-base" />
              <button type="submit" disabled={busy || !text.trim()} className="min-h-11 rounded-xl bg-ink px-4 text-sm font-semibold text-primary-foreground disabled:opacity-40">Send</button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export function FaqSection() {
  return (
    <section id="faq" className="px-5 py-20 md:py-24">
      <div className="mx-auto grid max-w-[1240px] gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className="text-sm font-semibold text-gold">FAQ</p>
          <h2 className="mt-2 text-[32px] font-semibold leading-[1.08] md:text-[46px]">Questions people ask first</h2>
          <p className="mt-4 text-[17px] text-muted-foreground">Can't find yours? Use the Ask Cosign button in the corner.</p>
        </div>
        <div className="divide-y divide-border border-y border-border">
          {FAQ.filter((f) => !f.hidden).map((f) => (
            <details key={f.q} className="group py-4">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 font-display text-lg font-semibold">
                {f.q}
                <span className="text-2xl text-brand transition group-open:rotate-45" aria-hidden>+</span>
              </summary>
              <p className="mt-2 text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
