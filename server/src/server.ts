/**
 * npm start — the Cosign v0 HTTP API plus a tiny phone-style approval page.
 *
 *   GET  /health
 *   GET  /.well-known/cosign-keys        public keys banks use to verify tokens offline
 *   POST /agents          {name, user}    demo only: registers an agent and returns its key
 *   POST /requests        SignedRequest   agent asks for a cosign
 *   GET  /requests/:id                    status (agents poll this)
 *   POST /requests/:id/approve {pin, numberMatch?}
 *   POST /requests/:id/decline
 *   GET  /approve/:id                     the approval page the user opens on their phone
 *   POST /bank/pay        PaymentInstruction  the mock bank (enforces the token)
 *   GET  /receipts                        receipt log + chain check
 *
 * Demo user: kavya@cosign, PIN 1234, mandate groceries ≤ ₹3,000.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { MockBank } from "./bank.js";
import { CosignService, describe } from "./cosign.js";

export function createApp() {
  const cosign = new CosignService();
  cosign.registerUser("kavya@cosign", "1234", {
    mandates: [{ id: "groceries", category: "groceries", maxPerAction: 3000, maxPerMonth: 12000, expiresAt: Date.now() + 90 * 864e5 }],
    knownPayees: ["FreshBasket"],
  });
  const bank = new MockBank(() => cosign.publicKeys());

  const send = (res: ServerResponse, status: number, body: unknown, type = "application/json") => {
    res.writeHead(status, { "content-type": type, "access-control-allow-origin": "*", "access-control-allow-headers": "content-type" });
    res.end(type === "application/json" ? JSON.stringify(body, null, 2) : String(body));
  };
  const readJson = (req: IncomingMessage) =>
    new Promise<any>((resolve, reject) => {
      let raw = "";
      req.on("data", (c) => { raw += c; if (raw.length > 100_000) reject(new Error("Body too large")); });
      req.on("end", () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error("Invalid JSON")); } });
    });

  return createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const parts = url.pathname.split("/").filter(Boolean);
    try {
      if (req.method === "OPTIONS") return send(res, 204, "");
      if (req.method === "GET" && url.pathname === "/health") return send(res, 200, { ok: true });
      if (req.method === "GET" && url.pathname === "/.well-known/cosign-keys") return send(res, 200, cosign.publicKeys());
      if (req.method === "POST" && url.pathname === "/agents") {
        const { name, user } = await readJson(req);
        return send(res, 201, cosign.registerAgent(String(name ?? "Agent"), String(user ?? "kavya@cosign")));
      }
      if (req.method === "POST" && url.pathname === "/requests") return send(res, 200, cosign.submit(await readJson(req)));
      if (parts[0] === "requests" && parts[1]) {
        const id = parts[1];
        if (req.method === "GET" && parts.length === 2) {
          const r = cosign.get(id);
          return r ? send(res, 200, r) : send(res, 404, { error: "Unknown request" });
        }
        if (req.method === "POST" && parts[2] === "approve") {
          const { pin, numberMatch } = await readJson(req);
          return send(res, 200, cosign.approve(id, String(pin ?? ""), { numberMatch: numberMatch ? String(numberMatch) : undefined }));
        }
        if (req.method === "POST" && parts[2] === "decline") return send(res, 200, cosign.decline(id));
      }
      if (req.method === "GET" && parts[0] === "approve" && parts[1]) {
        const r = cosign.get(parts[1]);
        return r ? send(res, 200, approvalPage(r.requestId, describe(r.body), r.tier, r.reasons, r.status, r.body.purpose), "text/html; charset=utf-8") : send(res, 404, "Unknown request", "text/plain");
      }
      if (req.method === "POST" && url.pathname === "/bank/pay") return send(res, 200, bank.pay(await readJson(req)));
      if (req.method === "GET" && url.pathname === "/receipts") return send(res, 200, { chain: cosign.receipts.verify(), entries: cosign.receipts.entries });
      return send(res, 404, { error: "Not found" });
    } catch (e) {
      return send(res, 400, { error: (e as Error).message });
    }
  });
}

const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

function approvalPage(id: string, summary: string, tier: string, reasons: string[], status: string, purpose: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cosign request</title>
<style>body{margin:0;font:16px/1.5 system-ui,sans-serif;background:#e7f6f3;color:#10131a;display:grid;place-items:center;min-height:100vh}main{box-sizing:border-box;background:#fff;border-radius:20px;padding:24px;width:min(380px,92vw);box-shadow:0 20px 50px -20px #14a09180}.pill{display:inline-block;border-radius:99px;padding:2px 10px;font-size:13px;font-weight:700;background:${tier === "red" ? "#fbe9ea;color:#b3121e" : "#fdf1dc;color:#9a5b00"}}h1{font-size:22px;margin:10px 0 4px}ul{padding-left:18px;color:#556070;font-size:14px}input{width:100%;box-sizing:border-box;font-size:20px;padding:12px;border:1px solid #cfd7e1;border-radius:12px;margin-top:8px;letter-spacing:6px;text-align:center}button{width:100%;min-height:48px;margin-top:10px;border:0;border-radius:12px;font-weight:700;font-size:16px}.yes{background:#10131a;color:#fff}.no{background:#f1f4f8;color:#10131a}#msg{margin-top:12px;font-weight:600}</style></head>
<body><main><span class="pill">${esc(tier)} · ${esc(status)}</span><h1>${esc(summary)}</h1><p style="color:#556070;margin:0">${esc(purpose)}</p><ul>${reasons.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>
${status === "pending" ? `${tier === "red" ? `<label>Number on your agent's screen<input id="nm" inputmode="numeric" maxlength="2"></label>` : ""}<label>Cosign PIN<input id="pin" type="password" inputmode="numeric" maxlength="4"></label><button class="yes" id="yes">Cosign</button><button class="no" id="no">Say no</button>` : ""}
<p id="msg"></p></main>
<script>
const m=document.getElementById('msg');
async function go(path,body){const r=await fetch('/requests/${esc(id)}/'+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body||{})});const j=await r.json();m.textContent=j.error?('✗ '+j.error):(j.status==='approved'?'✓ Cosigned. Your agent can go ahead.':'Declined. Your agent has been told.');if(!j.error){document.querySelectorAll('button,input,label').forEach(e=>e.remove());document.querySelector('.pill').textContent=j.tier+' · '+j.status}}
const y=document.getElementById('yes');if(y){y.onclick=()=>go('approve',{pin:document.getElementById('pin').value,numberMatch:(document.getElementById('nm')||{}).value});document.getElementById('no').onclick=()=>go('decline');}
</script></body></html>`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT ?? 8787);
  createApp().listen(port, () => console.log(`Cosign v0 API on http://localhost:${port}  (user kavya@cosign, PIN 1234)`));
}
