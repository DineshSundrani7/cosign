/** What an AI agent's side of Cosign looks like: build a request and sign it with the agent's key. */
import { randomBytes } from "node:crypto";
import { canonical, signText } from "./crypto.js";
import type { RequestBody, SignedRequest } from "./types.js";

export class AgentClient {
  constructor(readonly agentId: string, private readonly privateKey: string, readonly user: string) {}

  request(fields: Omit<RequestBody, "agentId" | "user" | "nonce" | "issuedAt">, now = Date.now()): SignedRequest {
    const body: RequestBody = { ...fields, agentId: this.agentId, user: this.user, nonce: randomBytes(12).toString("base64url"), issuedAt: now };
    return { body, signature: signText(this.privateKey, canonical(body)) };
  }
}
