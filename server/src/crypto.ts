/**
 * Small crypto helpers built only on Node's standard library.
 * - Ed25519 signatures for agents, the Cosign issuer and the user's device key
 * - Canonical JSON so the same object always produces the same bytes to sign
 * - A PIN-locked private key that stands in for a phone's secure chip
 */
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  randomBytes,
  scryptSync,
  sign,
  verify,
} from "node:crypto";

export type KeyPair = { publicKey: string; privateKey: string };

export const b64u = (input: string | Buffer) => Buffer.from(input).toString("base64url");
export const fromB64u = (input: string) => Buffer.from(input, "base64url").toString("utf8");
export const sha256 = (input: string | Buffer) => createHash("sha256").update(input).digest("hex");
export const randomId = (prefix: string) => `${prefix}_${randomBytes(9).toString("base64url")}`;

/** Deterministic JSON: object keys sorted at every level, undefined values dropped. */
export function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
}

export function newKeyPair(): KeyPair {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    publicKey: publicKey.export({ type: "spki", format: "pem" }).toString(),
    privateKey: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  };
}

export function signText(privateKeyPem: string, text: string): string {
  return sign(null, Buffer.from(text), createPrivateKey(privateKeyPem)).toString("base64url");
}

export function verifyText(publicKeyPem: string, text: string, signature: string): boolean {
  try {
    return verify(null, Buffer.from(text), createPublicKey(publicKeyPem), Buffer.from(signature, "base64url"));
  } catch {
    return false;
  }
}

/* ---- PIN-locked device key: a stand-in for the key a phone keeps in its secure chip ---- */
export type LockedKey = { salt: string; iv: string; tag: string; data: string };

export function lockWithPin(privateKeyPem: string, pin: string): LockedKey {
  const salt = randomBytes(16);
  const key = scryptSync(pin, salt, 32);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(privateKeyPem, "utf8"), cipher.final()]);
  return { salt: b64u(salt), iv: b64u(iv), tag: b64u(cipher.getAuthTag()), data: b64u(data) };
}

/** Throws if the PIN is wrong (the AES-GCM auth tag will not verify). */
export function unlockWithPin(locked: LockedKey, pin: string): string {
  const key = scryptSync(pin, Buffer.from(locked.salt, "base64url"), 32);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(locked.iv, "base64url"));
  decipher.setAuthTag(Buffer.from(locked.tag, "base64url"));
  try {
    return Buffer.concat([decipher.update(Buffer.from(locked.data, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("Wrong PIN");
  }
}
