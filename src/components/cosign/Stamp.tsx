import { motion, useReducedMotion } from "framer-motion";

/* Brand mark: two interlocking rings — the agent's signature and yours. */
export function Mark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <rect width="40" height="40" rx="10" fill="var(--ink)" />
      <circle cx="16" cy="20" r="8" fill="none" stroke="#9cc3e8" strokeWidth="3" />
      <circle cx="24" cy="20" r="8" fill="none" stroke="#ff6b74" strokeWidth="3" />
    </svg>
  );
}

/* The seal that lands when you cosign. */
export function Stamp({ size = 160, delay = 0, label = "cosigned by you · signed receipt ·" }: { size?: number; delay?: number; label?: string }) {
  const reduce = useReducedMotion();
  const ring = `${label} ${label} `;
  return (
    <motion.div
      aria-label="Cosigned seal"
      role="img"
      initial={reduce ? { opacity: 1, rotate: -10 } : { opacity: 0, scale: 2.2, rotate: -28 }}
      animate={{ opacity: 0.94, scale: 1, rotate: -10 }}
      transition={reduce ? { duration: 0 } : { delay, type: "spring", stiffness: 520, damping: 22, mass: 0.9 }}
      style={{ width: size, height: size }}
      className="relative text-seal"
    >
      <svg viewBox="0 0 200 200" className="h-full w-full" aria-hidden>
        <defs>
          <filter id="seal-rough">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="2.5" />
          </filter>
          <path id="seal-circle" d="M100,100 m-74,0 a74,74 0 1,1 148,0 a74,74 0 1,1 -148,0" />
        </defs>
        <g filter="url(#seal-rough)" fill="none" stroke="currentColor">
          <circle cx="100" cy="100" r="94" strokeWidth="5" />
          <circle cx="100" cy="100" r="58" strokeWidth="2.5" />
          <text fill="currentColor" stroke="none" fontSize="14" fontWeight="700" letterSpacing="2" style={{ fontFamily: "var(--font-sans)" }}>
            <textPath href="#seal-circle">{ring}</textPath>
          </text>
          <path d="M76 100 l16 16 l32 -34" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </svg>
      {!reduce && (
        <motion.span
          className="absolute inset-0 rounded-full border-4 border-seal"
          initial={{ opacity: 0.5, scale: 1 }}
          animate={{ opacity: 0, scale: 1.5 }}
          transition={{ delay: delay + 0.15, duration: 0.6 }}
          aria-hidden
        />
      )}
    </motion.div>
  );
}

/* A hand-drawn signature that writes itself. */
export function Signature({ d, delay = 0, className = "" }: { d: string; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <svg viewBox="0 0 220 60" className={className} aria-hidden>
      <motion.path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={reduce ? { duration: 0 } : { delay, duration: 1.1, ease: "easeInOut" }}
      />
    </svg>
  );
}

export function FakeQR({ seed = "kavya@cosign", size = 56 }: { seed?: string; size?: number }) {
  const n = 21;
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const cells: [number, number][] = [];
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      h = (h * 1103515245 + 12345) >>> 0;
      const finder = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
      if (!finder && (h >> 16) % 2) cells.push([x, y]);
    }
  const F = ({ x, y }: { x: number; y: number }) => (
    <g>
      <rect x={x} y={y} width="7" height="7" fill="currentColor" />
      <rect x={x + 1} y={y + 1} width="5" height="5" fill="white" />
      <rect x={x + 2} y={y + 2} width="3" height="3" fill="currentColor" />
    </g>
  );
  return (
    <svg viewBox={`-1 -1 ${n + 2} ${n + 2}`} width={size} height={size} className="rounded bg-card text-ink" aria-label="QR code for decision address" role="img">
      <rect x="-1" y="-1" width={n + 2} height={n + 2} fill="white" />
      {cells.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="currentColor" />
      ))}
      <F x={0} y={0} />
      <F x={14} y={0} />
      <F x={0} y={14} />
    </svg>
  );
}
