import { useEffect, useRef, useState } from "react";

/* Reads the page aloud with the browser's own voice (Web Speech API): free, no server, works offline.
   Blind visitors usually bring their own screen reader; this helps people with low vision or reading difficulty. */
export function Listen() {
  const [supported, setSupported] = useState(false);
  const [state, setState] = useState<"idle" | "playing" | "paused">("idle");
  const queue = useRef<HTMLElement[]>([]);
  const idx = useRef(0);
  const current = useRef<HTMLElement | null>(null);
  const run = useRef(0);

  useEffect(() => {
    try { setSupported(typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined"); } catch { setSupported(false); }
    return () => { try { window.speechSynthesis.cancel(); } catch { /* ignore */ } };
  }, []);

  const mark = (el: HTMLElement | null) => {
    current.current?.removeAttribute("data-reading");
    current.current = el;
    if (el) { el.setAttribute("data-reading", ""); el.scrollIntoView({ block: "center", behavior: "smooth" }); }
  };

  const speakNext = (token: number) => {
    if (token !== run.current) return;
    const el = queue.current[idx.current];
    if (!el) { mark(null); setState("idle"); return; }
    const text = (el.getAttribute("aria-label") || el.innerText || "").replace(/\s+/g, " ").trim();
    idx.current += 1;
    if (!text) { speakNext(token); return; }
    const u = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const v = voices.find((x) => x.lang === "en-IN") || voices.find((x) => x.lang.startsWith("en"));
    if (v) u.voice = v;
    u.rate = 1;
    u.onend = () => speakNext(token);
    u.onerror = (e) => { if (token !== run.current || e.error === "interrupted" || e.error === "canceled") return; mark(null); setState("idle"); };
    mark(el);
    window.speechSynthesis.speak(u);
  };

  const start = () => {
    const synth = window.speechSynthesis;
    if (state === "paused") { synth.resume(); setState("playing"); return; }
    if (state === "playing") { synth.pause(); setState("paused"); return; }
    synth.cancel();
    queue.current = Array.from(document.querySelectorAll<HTMLElement>("main h1, main h2, main h3, main > section p, main blockquote, main li, main summary"))
      .filter((el) => !el.closest("#demo, [aria-hidden='true'], details:not([open]) > p") && el.offsetParent !== null)
      .filter((el, _, all) => !all.some((o) => o !== el && o.contains(el)));
    idx.current = 0;
    run.current += 1;
    setState("playing");
    speakNext(run.current);
  };

  const stop = () => { run.current += 1; window.speechSynthesis.cancel(); mark(null); setState("idle"); };

  if (!supported) return null;
  const label = state === "playing" ? "Pause reading" : state === "paused" ? "Resume reading" : "Listen to this page";
  return (
    <div className="flex items-center gap-1">
      <button onClick={start} aria-label={label} title={label} className="flex h-11 items-center gap-2 rounded-full border border-border px-3 text-sm font-semibold hover:bg-secondary">
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
          {state === "playing" ? (
            <path d="M8 5v14M16 5v14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          ) : (
            <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z" /><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /></g>
          )}
        </svg>
        <span className="hidden sm:inline">{state === "playing" ? "Pause" : state === "paused" ? "Resume" : "Listen"}</span>
      </button>
      {state !== "idle" && (
        <button onClick={stop} aria-label="Stop reading" title="Stop reading" className="flex h-11 w-11 items-center justify-center rounded-full border border-border hover:bg-secondary">
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" /></svg>
        </button>
      )}
    </div>
  );
}
