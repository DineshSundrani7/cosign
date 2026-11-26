/**
 * Tamper-evident receipt log. Each entry stores the hash of the previous entry,
 * so editing or deleting any past receipt breaks every hash after it.
 */
import { canonical, sha256 } from "./crypto.js";

export interface Receipt {
  index: number;
  at: number;
  event: "approved" | "declined" | "blocked" | "pending" | "executed" | "refused";
  requestId?: string;
  agent?: string;
  user?: string;
  summary: string;
  decidedBy?: string;
  prevHash: string;
  hash: string;
}

export class ReceiptLog {
  readonly entries: Receipt[] = [];

  append(entry: Omit<Receipt, "index" | "at" | "prevHash" | "hash">, at = Date.now()): Receipt {
    const prevHash = this.entries.at(-1)?.hash ?? "GENESIS";
    const base = { ...entry, index: this.entries.length, at, prevHash };
    const receipt: Receipt = { ...base, hash: sha256(canonical(base)) };
    this.entries.push(receipt);
    return receipt;
  }

  /** Recomputes every hash. Returns the first broken index if the log was altered. */
  verify(): { ok: true } | { ok: false; brokenAt: number } {
    let prev = "GENESIS";
    for (const r of this.entries) {
      const { hash, ...base } = r;
      if (r.prevHash !== prev || sha256(canonical(base)) !== hash) return { ok: false, brokenAt: r.index };
      prev = hash;
    }
    return { ok: true };
  }
}
