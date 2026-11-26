# Cosign request format — v0.1 (draft)

An AI agent sends this to a person's Cosign address before it pays, shares personal data or signs anything. Cosign answers with a decision and, when approved, a single-use approval token that a bank, rail or merchant verifies on its own.

This draft maps onto existing standards instead of inventing new ones:

| Cosign | Closest existing standard |
|---|---|
| Decision request sent to the user's address | OpenID CIBA backchannel request, with the details in a Rich Authorization Request (RAR) |
| Approval token for a specific purchase | Google AP2 Cart Mandate (user-signed, exact items and price) |
| Standing mandate | AP2 Intent Mandate · UPI AutoPay / Reserve Pay mandate |
| Agent identity | NPCI's reported agent registry · Visa Trusted Agent Protocol |
| Family approver | UPI Circle partial delegation |
| Data-sharing approval | DPDP consent manager consent artefact |

## 1. Decision request

```json
{
  "body": {
    "agentId": "agt_…",
    "user": "kavya@cosign",
    "action": "payment",              // payment | data_share | contract
    "purpose": "Renew family health insurance",
    "reversible": true,
    "amount": 18400,                  // payments, in rupees
    "payee": "Suraksha General",
    "category": "insurance",
    "data": ["health records 2035-2040"],   // data_share only
    "recipient": "FitLife Insurance",       // data_share / contract
    "sellerClaims": [{ "claim": "Only 2 left", "kind": "stock", "value": 2 }],
    "nonce": "random, unique per request",
    "issuedAt": 2234567890000         // ms since epoch; rejected if older than 2 minutes
  },
  "signature": "Ed25519 signature by the agent's registered key over canonical JSON of body"
}
```

Canonical JSON = object keys sorted at every level, no whitespace, undefined fields dropped.

## 2. Decision

```json
{ "requestId": "req_…", "status": "approved | pending | declined | blocked | undone",
  "tier": "green | amber | red | blocked", "reasons": ["…"],
  "token": "…",            // when approved
  "numberMatch": "27" }    // red only: shown on the agent's screen, the approver must pick it
```

| Tier | When | Who decides |
|---|---|---|
| green | Inside an active mandate, known payee, no false or unverifiable seller claims | The mandate (signed automatically) |
| amber | Payment outside a mandate, above a limit, new payee, failed seller claim | The user — or their Family Circle approver — with a PIN |
| red | Data sharing, contracts, anything irreversible | The user or approver, with PIN + number-match |
| blocked | Unregistered agent, bad signature, stale or replayed request, flood | Nobody — it never reaches a person |

Seller claims of kind `stock` are re-checked by Cosign against the seller's own stock feed; the agent's `verified` flag is never trusted on its own.

## 3. Approval token

`base64url(header) . base64url(claims) . signature` — signed by the Cosign issuer key (Ed25519).

```json
{ "jti": "tok_…", "iss": "cosign", "sub": "kavya@cosign", "agent": "agt_…",
  "act": "payment", "amt": 18400, "payee": "Suraksha General",
  "reqHash": "sha256 of the canonical request body",
  "tier": "amber", "decidedBy": "user:pin",          // or "circle:<approver>", "mandate:<id>"
  "approver": "kavya@cosign",                        // only when a Family Circle approver decided
  "userSig": "Ed25519 signature by the approver's device key over reqHash",
  "iat": 0, "exp": 0 }      // valid for 5 minutes
```

## 4. What the executor must check

A bank, rail or merchant MUST refuse an agent-initiated action unless:

1. The token signature verifies against Cosign's published issuer key (`/.well-known/cosign-keys`).
2. `exp` is in the future, `jti` has not been used before, and `jti` is not on Cosign's published revoked list (a 48-hour undo cancels unused tokens).
3. `act`, `amt`, `payee` / `recipient`, `sub` and `agent` match the action being executed exactly.
4. For amber and red tokens, `userSig` verifies against the device key of `approver` (or `sub` if there is no approver) over `reqHash`.

The executor never needs to call Cosign to verify a token; it only refreshes the public key set.
