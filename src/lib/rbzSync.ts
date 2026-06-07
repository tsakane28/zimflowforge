import { addAudit, addRates, getAllRates } from "./db";
import { describeFallback, formatLongDate, toIsoDate } from "./businessDay";

export interface SyncResult {
  status: "connected" | "cached" | "manual";
  message: string;
  targetDate: string;
  fellBack: boolean;
  imported: number;
  skipped: number;
}

interface ScrapeEntry { date: string; url: string }
interface ScrapeResponse { month: number; year: number; monthUrl?: string; entries: ScrapeEntry[]; error?: string }

/**
 * Sync RBZ daily exchange-rate PDFs for the current month:
 *  1. Scrape the month index via our server proxy (avoids browser CORS).
 *  2. Dedupe against dates already in IndexedDB.
 *  3. Download + parse each new PDF and persist its rows.
 *  4. Compute the weekend-aware "target date" so the UI knows what to display.
 */
export const syncLatestRBZRates = async (): Promise<SyncResult> => {
  const now = new Date();
  const { target, fellBack, reason } = describeFallback(now);
  const targetIso = toIsoDate(target);

  await addAudit({
    ts: new Date().toISOString(),
    action: "RBZ Sync Started",
    event: reason,
    status: "info",
    payload: { targetDate: targetIso, fellBack, today: toIsoDate(now) },
  });

  let imported = 0;
  let skipped = 0;
  let monthUrl: string | undefined;

  try {
    const res = await fetch(
      `/api/public/rbz/scrape?year=${target.getFullYear()}&month=${target.getMonth() + 1}`,
    );
    if (!res.ok) throw new Error(`Scrape failed: HTTP ${res.status}`);
    const data = (await res.json()) as ScrapeResponse;
    if (data.error) throw new Error(data.error);
    monthUrl = data.monthUrl;

    await addAudit({
      ts: new Date().toISOString(),
      action: "RBZ Index Scraped",
      event: `Found ${data.entries.length} PDF(s) for ${target.toLocaleString("en-GB", { month: "long", year: "numeric" })}`,
      status: "success",
      payload: { monthUrl, entries: data.entries },
    });

    const existingRates = await getAllRates();
    const existingDates = new Set(existingRates.filter((r) => r.source !== "Seed Data").map((r) => r.date));

    const { parseRbzPdf } = await import("./pdfParser");

    for (const entry of data.entries) {
      if (existingDates.has(entry.date)) { skipped++; continue; }
      try {
        const pdfRes = await fetch(`/api/public/rbz/pdf?url=${encodeURIComponent(entry.url)}`);
        if (!pdfRes.ok) throw new Error(`PDF HTTP ${pdfRes.status}`);
        const blob = await pdfRes.blob();
        const file = new File([blob], entry.url.split("/").pop() || "rbz.pdf", { type: "application/pdf" });
        const parsed = await parseRbzPdf(file);
        // Force the date from the URL — RBZ PDFs sometimes mis-state the header.
        const rows = parsed.rows.map((r) => ({ ...r, date: entry.date, publishedAt: entry.date, source: "RBZ Auto-Sync" }));
        if (rows.length === 0) {
          await addAudit({
            ts: new Date().toISOString(),
            action: "RBZ PDF Empty",
            event: `${entry.date} — no rate rows extracted`,
            status: "warning",
            payload: { url: entry.url },
          });
          continue;
        }
        await addRates(rows);
        imported++;
        await addAudit({
          ts: new Date().toISOString(),
          action: "RBZ PDF Imported",
          event: `Imported ${rows.length} rows for ${entry.date}`,
          status: "success",
          payload: { url: entry.url, count: rows.length },
        });
      } catch (e) {
        await addAudit({
          ts: new Date().toISOString(),
          action: "RBZ PDF Failed",
          event: `${entry.date} — ${String((e as Error)?.message ?? e)}`,
          status: "error",
          payload: { url: entry.url },
        });
      }
    }

    // Did we successfully resolve the target date?
    const finalRates = await getAllRates();
    const haveTarget = finalRates.some((r) => r.date === targetIso);
    const prefix = fellBack ? "Weekend fallback — " : "";
    return {
      status: haveTarget ? "connected" : "cached",
      message: haveTarget
        ? `${prefix}Live RBZ data – ${formatLongDate(target)} • ${imported} new, ${skipped} cached`
        : `${prefix}No PDF yet for ${formatLongDate(target)} • showing latest available`,
      targetDate: targetIso,
      fellBack,
      imported,
      skipped,
    };
  } catch (e) {
    await addAudit({
      ts: new Date().toISOString(),
      action: "RBZ Sync Failed",
      event: String((e as Error)?.message ?? e),
      status: "error",
      payload: { targetDate: targetIso, monthUrl },
    });
    const prefix = fellBack ? "Weekend fallback — " : "";
    return {
      status: "cached",
      message: `${prefix}Using cached data – ${formatLongDate(target)} (sync error)`,
      targetDate: targetIso,
      fellBack,
      imported,
      skipped,
    };
  }
};
