/**
 * SQLite persistence using Node's built-in node:sqlite (Node 22+). No extra dependencies.
 *   state     one row: the service + bank snapshot as JSON (keys, users, agents, requests, used tokens…)
 *   receipts  the append-only receipt log, one row per receipt, stored with its hash
 * On startup the receipt chain is re-verified, so a database edited by hand is rejected.
 */
import { DatabaseSync } from "node:sqlite";
import type { Snapshot } from "./cosign.js";
import type { Receipt } from "./receipts.js";

export interface Stored { service: Snapshot; bank: unknown; receipts: Receipt[] }

export class SqliteStore {
  private readonly db: DatabaseSync;
  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY CHECK (id = 1), service TEXT NOT NULL, bank TEXT NOT NULL, updated_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS receipts (idx INTEGER PRIMARY KEY, hash TEXT NOT NULL UNIQUE, body TEXT NOT NULL);
    `);
  }

  load(): Stored | undefined {
    const row = this.db.prepare("SELECT service, bank FROM state WHERE id = 1").get() as { service: string; bank: string } | undefined;
    if (!row) return undefined;
    const receipts = (this.db.prepare("SELECT body FROM receipts ORDER BY idx").all() as { body: string }[]).map((r) => JSON.parse(r.body) as Receipt);
    return { service: JSON.parse(row.service), bank: JSON.parse(row.bank), receipts };
  }

  save(service: Snapshot, bank: unknown, receipts: Receipt[]) {
    const insert = this.db.prepare("INSERT OR IGNORE INTO receipts (idx, hash, body) VALUES (?, ?, ?)");
    this.db.exec("BEGIN");
    try {
      this.db.prepare("INSERT INTO state (id, service, bank, updated_at) VALUES (1, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET service = excluded.service, bank = excluded.bank, updated_at = excluded.updated_at")
        .run(JSON.stringify(service), JSON.stringify(bank), Date.now());
      for (const r of receipts) insert.run(r.index, r.hash, JSON.stringify(r));
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }

  close() { this.db.close(); }
}
