import { addAudit, addRates, getAllRates } from "./db";
import { describeFallback, formatLongDate, toIsoDate } from "./businessDay";

export interface NewPublication { date: string; url: string; count: number }

export interface SyncResult {
  status: "connected" | "cached" | "manual";
  message: string;
  targetDate: string;
  fellBack: boolean;
  imported: number;
  skipped: number;
  haveTarget: boolean;
  latestAvailable?: string;
  newPublications: NewPublication[];
  /** Recommended delay in ms before the next auto sync check. */
  nextCheckDelayMs: number;
  /** Human readable explanation of the next-check schedule. */
  nextCheckReason: string;
}

/**
 * Smart retry/backoff schedule:
 *  - Weekdays 08:00-14:59 local, target not yet found → poll every 5 min
 *   (RBZ typically publishes mid-morning; we want to catch it quickly).
 *  - Weekdays 15:00-17:59, still missing → 15 min (still expected today).
 *  - Weekdays 18:00+, still missing → 60 min (unlikely to appear today).
 *  - Target already imported → 60 min (just watching for corrections).
 *  - Weekend / public holiday fallback → 4 h (nothing new will publish).
 */
const computeNextCheck = (haveTarget: boolean, fellBack: boolean, now = new Date()) => {
  const MIN = 60 * 1000;
  const hour = now.getHours();
  if (fellBack) {
    return { ms: 4 * 60 * MIN, reason: "Weekend — RBZ does not publish. Rechecking in 4 h." };
  }
  if (haveTarget) {
    return { ms: 60 * MIN, reason: "Today's rate captured. Rechecking hourly for corrections." };
  }
  if (hour >= 8 && hour < 15) {
    return { ms: 5 * MIN, reason: "Awaiting today's publication — rechecking every 5 min." };
  }
  if (hour >= 15 && hour < 18) {
    return { ms: 15 * MIN, reason: "Late-window watch — rechecking every 15 min." };
  }
  return { ms: 60 * MIN, reason: "Off-hours — rechecking hourly." };
};

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

    const newPublications: NewPublication[] = [];

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
        newPublications.push({ date: entry.date, url: entry.url, count: rows.length });
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
    const latestAvailable = data.entries.length
      ? data.entries[data.entries.length - 1].date
      : undefined;
    const prefix = fellBack ? "Weekend fallback — " : "";
    const next = computeNextCheck(haveTarget, fellBack);
    return {
      status: haveTarget ? "connected" : "cached",
      message: haveTarget
        ? `${prefix}Live RBZ data – ${formatLongDate(target)} • ${imported} new, ${skipped} cached · ${next.reason}`
        : latestAvailable
          ? `${prefix}Awaiting RBZ publication for ${formatLongDate(target)} – showing latest (${latestAvailable}) · ${next.reason}`
          : `${prefix}No RBZ PDFs found for ${target.toLocaleString("en-GB", { month: "long", year: "numeric" })} · ${next.reason}`,
      targetDate: targetIso,
      fellBack,
      imported,
      skipped,
      haveTarget,
      latestAvailable,
      newPublications,
      nextCheckDelayMs: next.ms,
      nextCheckReason: next.reason,
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
    // On failure, back off more aggressively to avoid hammering a broken endpoint.
    const next = { ms: 10 * 60 * 1000, reason: "Sync error — retrying in 10 min." };
    return {
      status: "cached",
      message: `${prefix}Using cached data – ${formatLongDate(target)} (sync error) · ${next.reason}`,
      targetDate: targetIso,
      fellBack,
      imported,
      skipped,
      haveTarget: false,
      newPublications: [],
      nextCheckDelayMs: next.ms,
      nextCheckReason: next.reason,
    };
  }
};
