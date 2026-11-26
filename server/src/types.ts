export type Action = "payment" | "data_share" | "contract";
export type Tier = "green" | "amber" | "red" | "blocked";
export type Status = "approved" | "pending" | "declined" | "blocked";

/** What an agent asks for. Spec: docs/SPEC.md */
export interface RequestBody {
  agentId: string;
  user: string; // the person's Cosign address, e.g. kavya@cosign
  action: Action;
  purpose: string;
  reversible: boolean;
  amount?: number; // rupees, for payments
  payee?: string;
  category?: string; // e.g. groceries, insurance
  data?: string[]; // for data_share: which fields
  recipient?: string; // for data_share / contract
  sellerClaims?: { claim: string; verified: boolean }[];
  nonce: string; // unique per request, stops replays
  issuedAt: number; // ms since epoch, must be fresh
}

export interface SignedRequest {
  body: RequestBody;
  signature: string; // agent's Ed25519 signature over canonical(body)
}

export interface Mandate {
  id: string;
  category: string;
  maxPerAction: number;
  maxPerMonth: number;
  expiresAt: number;
  payees?: string[]; // optional allow-list
  spentThisMonth: number;
}

export interface Decision {
  requestId: string;
  status: Status;
  tier: Tier;
  reasons: string[];
  token?: string;
  numberMatch?: string; // shown on the agent's screen for red actions
}

/** Claims inside a Cosign approval token. */
export interface TokenClaims {
  jti: string; // unique id, single use
  iss: "cosign";
  sub: string; // user address
  agent: string;
  act: Action;
  amt?: number;
  payee?: string;
  recipient?: string;
  reqHash: string; // sha256 of the canonical request body
  tier: Exclude<Tier, "blocked">;
  decidedBy: string; // "mandate:<id>" or "user:pin" or "user:pin+number-match"
  userSig?: string; // device signature over reqHash (amber and red only)
  iat: number;
  exp: number;
}
