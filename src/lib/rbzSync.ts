import { addAudit, addRates, getAllRates } from "./db";
import { describeFallback, formatLongDate, toIsoDate } from "./businessDay";
import { loadSettings } from "./syncSettings";

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

/** Configurable retry/backoff schedule — driven by user settings (Settings page). */
const computeNextCheck = (haveTarget: boolean, fellBack: boolean, now = new Date()) => {
  const MIN = 60 * 1000;
  const s = loadSettings();
  const hour = now.getHours();
  if (fellBack) {
    if (!s.weekendEnabled) {
      return { ms: s.weekendIdleMinutes * MIN, reason: `Weekend — checks disabled. Rechecking in ${s.weekendIdleMinutes} min.` };
    }
    return { ms: s.weekendIdleMinutes * MIN, reason: `Weekend — rechecking in ${s.weekendIdleMinutes} min.` };
  }
  if (haveTarget) {
    return { ms: s.haveTargetMinutes * MIN, reason: `Today's rate captured. Rechecking every ${s.haveTargetMinutes} min for corrections.` };
  }
  const win = s.weekdayWindows.find((w) => hour >= w.startHour && hour < w.endHour);
  if (win) {
    return { ms: win.intervalMinutes * MIN, reason: `Publication window (${String(win.startHour).padStart(2,"0")}:00–${String(win.endHour).padStart(2,"0")}:00) — rechecking every ${win.intervalMinutes} min.` };
  }
  return { ms: s.weekdayOffHoursMinutes * MIN, reason: `Off-hours — rechecking every ${s.weekdayOffHoursMinutes} min.` };
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
    const errMin = loadSettings().errorMinutes;
    const next = { ms: errMin * 60 * 1000, reason: `Sync error — retrying in ${errMin} min.` };
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
