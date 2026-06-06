import { create } from "zustand";
import { addAudit, addRates, getAllRates, getAudit, type AuditEntry, type RateRecord } from "@/lib/db";
import { ensureSeed } from "@/lib/seed";
import { syncLatestRBZRates } from "@/lib/rbzSync";
import { describeFallback, formatLongDate, mostRecentBusinessDay } from "@/lib/businessDay";


export type SyncStatus = "idle" | "connected" | "syncing" | "cached" | "manual";

interface FxState {
  rates: RateRecord[];
  audit: AuditEntry[];
  syncStatus: SyncStatus;
  syncMessage: string;
  lastSyncAt?: string;
  initialized: boolean;
  init: () => Promise<void>;
  refreshAudit: () => Promise<void>;
  refreshRates: () => Promise<void>;
  runSync: () => Promise<void>;
  importPdf: (file: File) => Promise<{ count: number; date: string }>;
}

export const useFxStore = create<FxState>((set, get) => ({
  rates: [],
  audit: [],
  syncStatus: "idle",
  syncMessage: "Not synced",
  initialized: false,

  init: async () => {
    if (get().initialized) return;
    const seeded = await ensureSeed();
    const [rates, audit] = await Promise.all([getAllRates(), getAudit()]);
    const { target, fellBack } = describeFallback(new Date());
    const longDate = formatLongDate(target);
    const prefix = fellBack ? "Weekend fallback — " : "";
    set({
      rates,
      audit,
      initialized: true,
      syncStatus: "cached",
      syncMessage: seeded
        ? `${prefix}Seed dataset loaded – ${longDate}`
        : `${prefix}Using cached data – ${longDate}`,
    });
    void mostRecentBusinessDay;
    // Auto-fetch latest publication on load (weekend-aware).
    try { await get().runSync(); } catch { /* swallow — cached data already shown */ }
  },


  refreshAudit: async () => set({ audit: await getAudit() }),
  refreshRates: async () => set({ rates: await getAllRates() }),

  runSync: async () => {
    set({ syncStatus: "syncing", syncMessage: "Contacting RBZ publication endpoint…" });
    const res = await syncLatestRBZRates();
    set({
      syncStatus: res.status === "cached" ? "cached" : "connected",
      syncMessage: res.message,
      lastSyncAt: new Date().toISOString(),
    });
    await get().refreshAudit();
  },

  importPdf: async (file: File) => {
    await addAudit({
      ts: new Date().toISOString(),
      action: "PDF Upload Started",
      event: `User uploaded ${file.name}`,
      status: "info",
      payload: { name: file.name, size: file.size },
    });
    try {
      if (typeof window === "undefined") {
        throw new Error("PDF parsing is only available in the browser");
      }

      const { parseRbzPdf } = await import("@/lib/pdfParser");
      const parsed = await parseRbzPdf(file);
      if (parsed.rows.length === 0) {
        await addAudit({
          ts: new Date().toISOString(),
          action: "PDF Parse Warning",
          event: "No currency rows matched the expected RBZ layout",
          status: "warning",
          payload: { sample: parsed.rawText.slice(0, 500) },
        });
      } else {
        await addRates(parsed.rows);
        await addAudit({
          ts: new Date().toISOString(),
          action: "PDF Parsed Successfully",
          event: `Extracted ${parsed.rows.length} currency rows for publication date ${parsed.publicationDate}`,
          status: "success",
          payload: parsed.rows,
        });
        await addAudit({
          ts: new Date().toISOString(),
          action: "Historical Record Created",
          event: `Persisted ${parsed.rows.length} rate records to IndexedDB`,
          status: "success",
        });
      }
      await get().refreshRates();
      await get().refreshAudit();
      set({
        syncStatus: "connected",
        syncMessage: `Manual import successful – ${parsed.publicationDate}`,
      });
      return { count: parsed.rows.length, date: parsed.publicationDate };
    } catch (e) {
      await addAudit({
        ts: new Date().toISOString(),
        action: "PDF Parse Failed",
        event: String(e),
        status: "error",
      });
      await get().refreshAudit();
      set({ syncStatus: "manual", syncMessage: "Manual Import Required" });
      throw e;
    }
  },
}));
