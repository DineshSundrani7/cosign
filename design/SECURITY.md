# How someone would attack Cosign — and what stops them

v0 is a prototype. "Covered" means there is working code and a test for it in `server/`. "Planned" means the design accounts for it but v0 doesn't implement it.

| Attack | What the attacker tries | Defence | v0 |
|---|---|---|---|
| Hidden-text hijack (prompt injection) | A web page tells the agent to pay "refund-desk" | Only registered agents can ask; requests must be signed with the agent's key; a new payee is never green | Covered |
| Forged request | Someone sends a request pretending to be the agent | Ed25519 signature over the canonical request; unknown agent IDs are blocked | Covered |
| Edited in transit | Amount or payee changed after the agent signed | Signature no longer verifies → blocked | Covered |
| Replayed request | The same signed request is sent again | One-time nonce + 2-minute freshness window | Covered |
| Approval fatigue / flooding | Many requests until the user taps yes | 5 requests per agent per hour, then the agent is paused for 24 hours | Covered |
| Tampered token | Raise the amount or change the payee inside an approval token | Token is signed by Cosign; any edit breaks the signature | Covered |
| Token reuse | Pay twice with one approval | Single-use `jti`, checked by the bank | Covered |
| Token for something else | Use a ₹900 groceries token to pay another shop | Bank checks amount, payee, account and agent exactly | Covered |
| Stolen token | Use an approval later | Tokens expire after 5 minutes | Covered |
| Approved by mistake | A duplicate or unwanted order | 48-hour undo cancels an unused token (banks check the revoked list); disputes come with the receipt chain as evidence | Covered |
| Cosign itself is compromised | Issue tokens nobody approved | Amber and red tokens carry the approver's own device signature, which Cosign can't produce | Covered |
| Stolen device key file | Copy the user's key from storage | Key is encrypted with the PIN (scrypt + AES-GCM); useless without it | Covered (simulated secure chip) |
| Push-bombing a red action | Trick the user into approving the wrong request | Number-matching between the agent's screen and the phone | Covered |
| Seller pressure tricks | Fake "only 2 left" to rush the agent | Stock claims re-checked against the seller's own stock feed; a false or unverifiable claim is never green | Covered (demo stock feed) |
| An elder's agent is pushed into a big purchase | A seller agent pressures a parent's agent | Family Circle: above the parent's own limit, only the family approver's PIN and device key can cosign | Covered |
| History rewriting | Edit a receipt to hide a payment | Hash-chained receipt log; any edit breaks the chain | Covered |
| Phishing approval page | A fake Cosign page steals the PIN | Real approvals happen inside the bank's or Cosign's own app, never via a link | Planned |
| SIM swap / account takeover | Move someone's Cosign to a new phone | Device re-binding needs bank-grade KYC and a cooling-off period | Planned |
| Agent skips Cosign | The agent pays directly | The bank refuses agent payments without a token — enforcement lives with whoever holds the money | Covered in the mock bank |

Known v0 limits: in-memory storage, a software key standing in for a phone's secure chip, a demo-only `/agents` endpoint that hands out keys, no TLS, and an approval link instead of in-app push. None of these are production choices.
