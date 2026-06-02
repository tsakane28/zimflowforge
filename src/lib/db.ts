import { openDB, type IDBPDatabase } from "idb";

export interface RateRecord {
  id?: number;
  date: string; // ISO date
  currency: string;
  bid: number;
  ask: number;
  mid: number;
  source: string; // RBZ Sync | PDF Upload | Seed
  importMethod: "auto" | "pdf" | "seed";
  status: "ok" | "stale" | "error";
  publishedAt?: string;
}

export interface AuditEntry {
  id?: number;
  ts: string;
  action: string;
  event: string;
  status: "success" | "info" | "warning" | "error";
  payload?: unknown;
}

let dbp: Promise<IDBPDatabase> | null = null;

export const getDb = () => {
  if (typeof window === "undefined") return null as any;
  if (!dbp) {
    dbp = openDB("fx-workbench", 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("rates")) {
          const s = db.createObjectStore("rates", { keyPath: "id", autoIncrement: true });
          s.createIndex("date_ccy", ["date", "currency"]);
          s.createIndex("date", "date");
          s.createIndex("currency", "currency");
        }
        if (!db.objectStoreNames.contains("audit")) {
          db.createObjectStore("audit", { keyPath: "id", autoIncrement: true });
        }
      },
    });
  }
  return dbp;
};

export const addRates = async (rows: RateRecord[]) => {
  const db = await getDb();
  if (!db) return;
  const tx = db.transaction("rates", "readwrite");
  for (const r of rows) {
    // dedupe per (date, currency)
    const existing = await tx.store.index("date_ccy").get([r.date, r.currency]);
    if (existing) await tx.store.delete(existing.id);
    await tx.store.add(r);
  }
  await tx.done;
};

export const getAllRates = async (): Promise<RateRecord[]> => {
  const db = await getDb();
  if (!db) return [];
  return (await db.getAll("rates")) as RateRecord[];
};

export const addAudit = async (e: AuditEntry) => {
  const db = await getDb();
  if (!db) return;
  await db.add("audit", e);
};

export const getAudit = async (): Promise<AuditEntry[]> => {
  const db = await getDb();
  if (!db) return [];
  return ((await db.getAll("audit")) as AuditEntry[]).reverse();
};
