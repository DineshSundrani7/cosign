/* One list feeds both the FAQ section and the chat assistant. Edit answers here.
   `keys` are words or short phrases a visitor might type; each match counts strongly. */
export const FAQ: { q: string; a: string; keys: string[]; hidden?: boolean }[] = [
  {
    q: "What is Cosign?",
    a: "Cosign is one place to approve everything your AI agent can't take back: money above the limits you set, sharing your personal data, and signing contracts. Routine actions go through under your limits; exceptions wait for your PIN.",
    keys: ["what is cosign", "what's cosign", "what does cosign do", "explain", "idea", "overview", "summary", "purpose", "tell me about"],
  },
  {
    q: "How does it work?",
    a: "You set limits once (mandates). Any registered agent must send anything outside those limits to your Cosign address, like kavya@cosign. You say no in one tap or yes with your PIN, and everyone gets a signed receipt with 48 hours to undo.",
    keys: ["how does it work", "how it works", "work", "process", "flow", "steps", "address", "mandate", "limit"],
  },
  {
    q: "How is this different from UPI's agent payments?",
    a: "Payment rails such as UPI mandates, Reserve Pay and NPCI's reported agent protocol let agents pay within limits you approve once. They cover payments only and are built to remove asks. Cosign sits on top of them and also covers data sharing and contracts, checks seller claims, and gives everyone a signed receipt.",
    keys: ["upi", "npci", "rail", "reserve pay", "p3p", "razorpay", "pine labs", "different", "difference", "vs", "versus", "compare"],
  },
  {
    q: "Who are the competitors?",
    a: "Three groups: payment rails and card networks (NPCI's agent protocol, Pine Labs P3P, Razorpay, Visa, Mastercard), developer approval gateways (AgentLock, Preloop, WorkOS Airlock) and data-consent infrastructure (DPDP consent managers). The Landscape section compares them side by side.",
    keys: ["competitor", "competition", "alternative", "similar", "agentlock", "preloop", "visa", "mastercard", "landscape", "market", "rival"],
  },
  {
    q: "Will it ask me all the time?",
    a: "No. Anything inside a mandate goes through silently with a receipt. Cosign aims for at most ten questions a week by bundling requests and rate-limiting agents.",
    keys: ["often", "popup", "pop-up", "notification", "annoying", "too many", "all the time", "every time", "spam me"],
  },
  {
    q: "How does it work technically?",
    a: "Agents register and sign every request. Cosign's gateway checks the agent, the policy engine applies your limits, and amber or red requests reach your phone, where your PIN unlocks a key that signs that exact request. The agent gets a single-use approval token, and the bank or rail refuses to execute without it. It builds on Google's AP2 mandates, OpenID CIBA, UPI mandates and DPDP consent managers.",
    keys: ["how does it work technically", "work technically", "technical", "technically", "architecture", "pipeline", "infrastructure", "backend", "token", "api", "protocol", "ap2", "ciba", "enforce", "under the hood", "integrate"],
  },
  {
    q: "Is this just a frontend?",
    a: "No. There's a working v0 backend in the project's code: signed agent requests, a policy engine, PIN-locked device keys, single-use approval tokens, a mock bank, hospital and e-sign desk that each refuse without a cosign, Family Circle, undo, SQLite storage, live metrics and 21 automated tests. The “Try the real engine” section runs the same logic in your browser with real signatures. The bank and money are simulated.",
    keys: ["frontend", "front end", "backend", "back end", "real code", "code", "github", "working", "built", "engine", "tests", "demo only", "just a website"],
  },
  {
    q: "Who is Cosign for?",
    a: "Two doors. First, people and families directly: a free connector for AI assistants and a Family plan, so a parent's or teen's agent can't go above their limit without your cosign. Next, banks and UPI apps, which embed “Protected by Cosign” and refuse agent payments without a cosign token.",
    keys: ["who is it for", "who uses", "target", "customer", "bank", "banks", "families", "b2b", "b2c", "go to market", "gtm", "launch first", "partner", "first use case"],
  },
  {
    q: "What are the green, amber and red tiers?",
    a: "Green actions are inside a mandate and go through with a receipt. Amber ones (above a limit, a new payee or a flagged seller) wait for your PIN. Red ones can't be undone, like sharing health data or signing a contract, so you see a narrower option first, then number-match and PIN. Blocked requests never reach you.",
    keys: ["tier", "green", "amber", "red", "level", "category", "categories", "risk"],
  },
  {
    q: "What happens with things I can't undo?",
    a: "Red actions, like sharing health records or signing a contract, first show a safer, narrower option. Approving the full request needs number-matching with the agent's screen plus your PIN.",
    keys: ["undo", "irreversible", "cannot undo", "can't undo", "health", "contract", "sign", "medical record", "number match", "number-match"],
  },
  {
    q: "How does it stop scams and hijacked agents?",
    a: "Only registered, signed agents can send requests. Unsigned requests, such as hidden text on a web page telling your agent to pay someone, are blocked before they reach you. Floods of requests are rate-limited and the agent is paused for 24 hours.",
    keys: ["scam", "fraud", "hijack", "hack", "safe", "security", "secure", "fake", "block", "prompt injection", "attack", "flood"],
  },
  {
    q: "What about my personal data and privacy?",
    a: "Sharing personal data is treated as a red action because it can't be taken back. Cosign shows what data is asked for, who gets it and why, and offers a narrower version first. It is designed to work with India's DPDP consent managers rather than replace them.",
    keys: ["privacy", "private", "personal data", "data", "dpdp", "consent manager", "share my", "information"],
  },
  {
    q: "What is the signed receipt?",
    a: "Every decision creates a signed record of who proposed the action, who decided and why. You can undo eligible actions within 48 hours or raise a dispute with the receipt attached, and merchants can accept it as proof an order was really wanted.",
    keys: ["receipt", "proof", "record", "dispute", "audit", "refund", "return", "48 hours", "undo a payment", "undo payment", "cancel", "reverse"],
  },
  {
    q: "Can my family use it?",
    a: "Yes — families are the first audience. With a Family plan, an elder's or teen's agent can't go above their limit, pay a new payee or share their data without a trusted family member's cosign. The parent agrees and keeps their own phone. UPI Circle already does part of this for UPI payments; Cosign extends it to AI agents, every app, data sharing and contracts.",
    keys: ["help families", "useful for families", "family", "families", "parent", "parents", "mother", "father", "elder", "teen", "child", "kid", "circle", "grandparent"],
  },
  {
    q: "What does it cost?",
    a: "The proposal: the connector is free; families pay for a Family plan first. Next, banks and UPI apps pay per protected customer, and agent companies pay for know-your-agent registration. Later, merchants pay for verified orders and insurers share premiums on a cosign guarantee. Selling people's data is off the table.",
    keys: ["make money", "earn", "revenue model", "cost", "price", "pricing", "free", "fee", "charge", "business model", "revenue", "monetize", "monetise", "how much", "subscription"],
  },
  {
    q: "How do I try the demo?",
    a: "Scroll to the Live prototype section, pick one of the seven moments, then tap the notification that slides onto the phone. Any 4 digits work as the PIN, and Reset demo starts over.",
    keys: ["demo", "try", "prototype", "test", "play", "pin", "phone"],
  },
  {
    q: "Is Cosign a real product?",
    a: "Not as a live product yet. Cosign is in development: there is this clickable prototype and a working v0 backend (signed agent requests, approval tokens, Family Circle, undo, a mock bank, hospital and e-sign desk, SQLite storage and 21 tests). Banks, money and the people in the demo are simulated.",
    keys: ["real", "available", "download", "launch", "release", "when", "app store", "play store", "sign up", "signup", "waitlist", "buy"],
  },
  {
    q: "Who built this?",
    a: "Cosign is an independent prototype, built part-time by a student alongside college studies. The idea and product decisions are the creator's; the code was written with an AI assistant (Claude).",
    keys: ["who built", "who made", "who created", "built by", "made by", "team", "founder", "creator", "author", "developer"],
  },
  {
    q: "Hello",
    a: "Hi! I can tell you what Cosign is, how it works, how it differs from UPI agent payments, how it stops scams, pricing or who built it. What would you like to know?",
    keys: ["hi", "hello", "hey", "hii", "namaste", "good morning", "good evening"],
    hidden: true,
  },
  {
    q: "Thanks",
    a: "You're welcome! Try the live demo on this page if you haven't yet.",
    keys: ["thanks", "thank you", "thx", "great", "cool", "nice", "ok", "okay"],
    hidden: true,
  },
];

const STOP = new Set("a an the is are am was were be to of in on for and or it its this that i me my you your we our do does did can could would should will how what why who when where which with about from as at by not no yes so if than then there their they them have has had just please tell".split(" "));

const norm = (s: string) => s.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9'@\s-]/g, " ").replace(/\s+/g, " ").trim();
const stem = (w: string) => (w.length > 4 && w.endsWith("s") ? w.slice(0, -1) : w);
const tokens = (s: string) => norm(s).split(" ").filter((w) => w && !STOP.has(w)).map(stem);

export function faqAnswer(input: string): string {
  const text = ` ${norm(input)} `;
  const words = new Set(tokens(input));
  const scored = FAQ.map((f) => {
    let score = 0;
    for (const k of f.keys) {
      const nk = norm(k);
      if (nk.includes(" ")) { if (text.includes(` ${nk} `) || text.includes(nk)) score += 3 + nk.split(" ").length; }
      else if (words.has(stem(nk)) || text.includes(` ${nk} `)) score += 3;
    }
    for (const w of tokens(f.q)) if (words.has(w)) score += 1.5;
    for (const w of new Set(tokens(f.a))) if (words.has(w) && w.length > 3) score += 0.4;
    return { f, score };
  }).sort((x, y) => y.score - x.score);

  const best = scored[0];
  if (!best || best.score < 1.5) {
    return "I'm not sure about that one. I can answer questions about what Cosign is, how it works, the tiers, scams, privacy, receipts, families, pricing, competitors, the demo and who built it.";
  }
  const second = scored[1];
  const also = second && !second.f.hidden && !best.f.hidden && second.score >= 3 && second.score >= best.score * 0.75 ? `\n\nRelated: ${second.f.q}` : "";
  return best.f.a + also;
}

export const SITE_FACTS = FAQ.filter((f) => !f.hidden).map((f) => `Q: ${f.q}\nA: ${f.a}`).join("\n\n");
