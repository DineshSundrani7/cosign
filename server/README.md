# Cosign v0 — backend

The working core of Cosign: an AI agent asks, a person cosigns, and a bank refuses to act without a valid cosign.

**Real:** Ed25519 signatures, the policy engine, PIN-locked device keys, single-use approval tokens, offline token verification, replay and tamper detection, rate limiting, a hash-chained receipt log, and an MCP connector for real AI assistants.
**Simulated:** the bank, the money, and the phone's secure chip (a PIN-encrypted key file).

## Run it

Needs Node.js 20+.

```bash
cd server
npm install
npm run demo     # plays seven scenarios end to end in the terminal
npm test         # 12 automated tests
npm start        # HTTP API + approval page on http://localhost:8787 (user kavya@cosign, PIN 1234)
```

## How a request flows

1. **Agent signs a request** (`src/agent.ts`) — action, amount, payee, data, reversibility, nonce, timestamp.
2. **Gateway** (`src/cosign.ts`) — registered agent? valid signature? fresh? not a replay? under the rate limit? Otherwise blocked.
3. **Policy engine** (`src/policy.ts`) — green inside a mandate, amber outside it, red for data, contracts and anything irreversible.
4. **User decides** — the PIN unlocks the device key, which signs this exact request; red also needs number-matching.
5. **Approval token** — signed by Cosign, single use, 5-minute expiry, bound to the exact amount, payee, account and agent.
6. **Bank enforces** (`src/bank.ts`) — verifies the token offline with Cosign's public keys and refuses anything that doesn't match.
7. **Receipt log** (`src/receipts.ts`) — every decision chained by hash, so edits are detectable.

Request format: [`../docs/SPEC.md`](../docs/SPEC.md) · Threat model: [`../docs/SECURITY.md`](../docs/SECURITY.md)

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

## API

| Method | Path | What it does |
|---|---|---|
| GET | `/.well-known/cosign-keys` | Public keys executors use to verify tokens |
| POST | `/agents` | Demo only: register an agent and get its key |
| POST | `/requests` | Agent submits a signed request |
| GET | `/requests/:id` | Status (agents poll this) |
| POST | `/requests/:id/approve` | `{ pin, numberMatch? }` |
| POST | `/requests/:id/decline` | One-tap no |
| GET | `/approve/:id` | Phone-style approval page |
| POST | `/bank/pay` | Mock bank — needs a valid token |
| GET | `/receipts` | Receipt log and chain check |
