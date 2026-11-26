# Cosign v0 — backend

The working core of Cosign: an AI agent asks, a person cosigns, and a bank refuses to act without a valid cosign.

**Real:** Ed25519 signatures, the policy engine, PIN-locked device keys, single-use approval tokens, offline token verification, replay and tamper detection, rate limiting, Family Circle approvals, seller-claim checks against a stock feed, 48-hour undo and disputes, managing limits, a hash-chained receipt log, SQLite persistence (state survives restarts; the receipt chain is re-verified on load), and an MCP connector for real AI assistants.
**Simulated:** the bank, the money, and the phone's secure chip (a PIN-encrypted key file).

## Run it

Needs Node.js 20+.

```bash
cd server
npm install
npm run demo     # plays ten scenarios end to end in the terminal
npm test         # 17 automated tests
npm start        # HTTP API + approval page on http://localhost:8787, data saved in cosign.db (SQLite)
                 # kavya@cosign (PIN 1234) and her mother sunanda@cosign (big requests go to Kavya)
```

## How a request flows

1. **Agent signs a request** (`src/agent.ts`) — action, amount, payee, data, reversibility, nonce, timestamp.
2. **Gateway** (`src/cosign.ts`) — registered agent? valid signature? fresh? not a replay? under the rate limit? Otherwise blocked.
3. **Policy engine** (`src/policy.ts`) — green inside a mandate, amber outside it, red for data, contracts and anything irreversible.
4. **User decides** — the PIN unlocks the device key, which signs this exact request; red also needs number-matching.
5. **Approval token** — signed by Cosign, single use, 5-minute expiry, bound to the exact amount, payee, account and agent.
6. **Bank enforces** (`src/bank.ts`) — verifies the token offline with Cosign's public keys and refuses anything that doesn't match.
7. **Receipt log** (`src/receipts.ts`) — every decision chained by hash, so edits are detectable.

**Family Circle:** a parent's account can name a family approver. Requests above the parent's own limit need the approver's PIN and device key; the token records who decided for whom.
**Seller checks:** a "stock" claim ("only 2 left") is re-checked against the seller's stock feed. A false or unverifiable claim is never green.
**Undo and disputes:** approved payments can be undone for 48 hours (an unused token is cancelled, so the bank refuses it); after that, a dispute returns the receipt chain as evidence.

Request format: [`../design/SPEC.md`](../design/SPEC.md) · Threat model: [`../design/SECURITY.md`](../design/SECURITY.md)

## Use it from a real AI assistant (MCP)

1. Start the API: `npm start`
2. Add this to your MCP client config (for example Claude Desktop's `claude_desktop_config.json`), using your own path:

```json
{
  "mcpServers": {
    "cosign": { "command": "npx", "args": ["tsx", "/path/to/cosign/server/src/mcp.ts"] }
  }
}
```

3. Ask the assistant: "Renew my health insurance — ₹18,400 to Suraksha General." It calls `request_cosign`, gives you an approval link, waits for your PIN (1234), then calls `pay`. The mock bank refuses if you didn't approve.

## Deploy the API

- **Docker:** `docker build -t cosign-api server && docker run -p 8787:8787 -v cosign:/data cosign-api`
- **Render (free tier):** New → Blueprint → pick this repo; it reads `render.yaml`. The free tier's disk is temporary, so data resets when the service restarts.
- Settings: `PORT`, `COSIGN_DB` (SQLite file path), `COSIGN_ADMIN_TOKEN` (protects agent registration).

## API

| Method | Path | What it does |
|---|---|---|
| GET | `/.well-known/cosign-keys` | Public keys executors use to verify tokens |
| POST | `/agents` | Register an agent and get its key (needs `authorization: Bearer $COSIGN_ADMIN_TOKEN` when that variable is set) |
| POST | `/requests` | Agent submits a signed request |
| GET | `/requests/:id` | Status |
| GET | `/requests/:id/wait?timeout=25` | Long-poll: returns as soon as the person decides |
| POST | `/requests/:id/approve` | `{ pin, numberMatch? }` |
| POST | `/requests/:id/decline` | One-tap no |
| GET | `/approve/:id` | Phone-style approval page |
| POST | `/bank/pay` | Mock bank — needs a valid token |
| POST | `/requests/:id/undo` | Undo within 48 hours (cancels an unused token) |
| POST | `/requests/:id/dispute` | `{ reason }` — returns the receipt chain as evidence |
| GET / POST | `/users/:address/mandates` | List or add limits; `POST /users/:address/mandates/:id { state }` to pause or revoke |
| POST | `/bank/refund` | `{ txnId }` — mock refund |
| GET | `/receipts` | Receipt log and chain check |
