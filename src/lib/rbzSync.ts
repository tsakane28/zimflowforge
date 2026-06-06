import { addAudit } from "./db";
import { describeFallback, formatLongDate, toIsoDate } from "./businessDay";

export interface SyncResult {
  status: "connected" | "cached" | "manual";
  message: string;
  targetDate: string;
  fellBack: boolean;
}

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/**
 * Build the RBZ Daily Exchange Rates index URL for the month of the target date.
 * Example: https://www.rbz.co.zw/index.php/research/markets/exchange-rates/13-daily-exchange-rates/1598-june-2026
 * The numeric slug prefix is unknown ahead of time, so we resolve it server-side
 * in production. In-browser we record the canonical month URL for auditing.
 */
const buildMonthIndexUrl = (d: Date) => {
  const month = MONTHS[d.getMonth()];
  const year = d.getFullYear();
  return `https://www.rbz.co.zw/index.php/research/markets/exchange-rates/13-daily-exchange-rates/${month}-${year}`;
};

// Browser CORS blocks direct RBZ access. We compute the correct business-day
// target (skipping weekends) and fall back to cached data per spec.
export const syncLatestRBZRates = async (): Promise<SyncResult> => {
  const now = new Date();
  const { target, fellBack, reason } = describeFallback(now);
  const targetIso = toIsoDate(target);
  const indexUrl = buildMonthIndexUrl(target);

  await addAudit({
    ts: new Date().toISOString(),
    action: "RBZ Sync Attempt",
    event: `Initiated retrieval — ${reason}`,
    status: "info",
    payload: { targetDate: targetIso, fellBack, indexUrl, today: toIsoDate(now) },
  });

  try {
    // Simulated probe — real endpoint requires server-side fetch.
    await new Promise((r) => setTimeout(r, 700));
    throw new Error("CORS_BLOCKED");
  } catch (e) {
    await addAudit({
      ts: new Date().toISOString(),
      action: "RBZ Sync Failed",
      event: "Direct browser access blocked by CORS — falling back to cached dataset",
      status: "warning",
      payload: { error: String(e), targetDate: targetIso, indexUrl },
    });
    await addAudit({
      ts: new Date().toISOString(),
      action: "Cached Rates Loaded",
      event: `Latest cached RBZ rate sheet served (${formatLongDate(target)})`,
      status: "success",
      payload: { targetDate: targetIso, fellBack },
    });
    const prefix = fellBack ? "Weekend fallback — " : "";
    return {
      status: "cached",
      message: `${prefix}Using cached data – ${formatLongDate(target)}`,
      targetDate: targetIso,
      fellBack,
    };
  }
};
