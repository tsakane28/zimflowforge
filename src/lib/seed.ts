import { addAudit, addRates, getAllRates, type RateRecord } from "./db";
import { mostRecentBusinessDay, previousBusinessDay, toIsoDate, isWeekend } from "./businessDay";

const LATEST = mostRecentBusinessDay(new Date());
const PREV = previousBusinessDay(LATEST);
const TODAY = toIsoDate(LATEST);
const YDAY = toIsoDate(PREV);

const seedRows: RateRecord[] = [
  // Latest available publication
  { date: TODAY, currency: "USD", bid: 26.2171, ask: 27.5615, mid: 26.8893, source: "Seed Data", importMethod: "seed", status: "ok", publishedAt: TODAY },
  { date: TODAY, currency: "GBP", bid: 33.3012, ask: 37.1143, mid: 35.2078, source: "Seed Data", importMethod: "seed", status: "ok", publishedAt: TODAY },
  { date: TODAY, currency: "ZAR", bid: 0.5899,  ask: 0.6205,  mid: 0.6052,  source: "Seed Data", importMethod: "seed", status: "ok", publishedAt: TODAY },
  { date: TODAY, currency: "EUR", bid: 28.4112, ask: 29.7544, mid: 29.0828, source: "Seed Data", importMethod: "seed", status: "ok", publishedAt: TODAY },
  { date: TODAY, currency: "BWP", bid: 1.9412,  ask: 2.0388,  mid: 1.9900,  source: "Seed Data", importMethod: "seed", status: "ok", publishedAt: TODAY },
  // Previous business day
  { date: YDAY, currency: "USD", bid: 25.8011, ask: 27.0801, mid: 26.4406, source: "Seed Data", importMethod: "seed", status: "ok", publishedAt: YDAY },
  { date: YDAY, currency: "GBP", bid: 32.9012, ask: 36.7012, mid: 34.8012, source: "Seed Data", importMethod: "seed", status: "ok", publishedAt: YDAY },
  { date: YDAY, currency: "ZAR", bid: 0.5811,  ask: 0.6115,  mid: 0.5963,  source: "Seed Data", importMethod: "seed", status: "ok", publishedAt: YDAY },
  { date: YDAY, currency: "EUR", bid: 28.1102, ask: 29.4302, mid: 28.7702, source: "Seed Data", importMethod: "seed", status: "ok", publishedAt: YDAY },
  { date: YDAY, currency: "BWP", bid: 1.9201,  ask: 2.0188,  mid: 1.9695,  source: "Seed Data", importMethod: "seed", status: "ok", publishedAt: YDAY },
];

// Generate a 14-business-day backfill for charts (skips weekends, matches RBZ).
const backfill = (() => {
  const rows: RateRecord[] = [];
  const base: Record<string, number> = { USD: 26.4, GBP: 34.8, ZAR: 0.596, EUR: 28.6, BWP: 1.96 };
  let cursor = new Date(LATEST);
  // step back to the day before PREV
  cursor.setDate(cursor.getDate() - 2);
  let added = 0;
  let i = 2;
  while (added < 12) {
    if (!isWeekend(cursor)) {
      const date = toIsoDate(cursor);
      for (const ccy of Object.keys(base)) {
        const drift = (Math.sin(i * (ccy.length + 1)) * 0.015) + (i * -0.0008);
        const mid = +(base[ccy] * (1 + drift)).toFixed(4);
        const bid = +(mid * 0.975).toFixed(4);
        const ask = +(mid * 1.025).toFixed(4);
        rows.push({ date, currency: ccy, bid, ask, mid, source: "Seed Data", importMethod: "seed", status: "ok", publishedAt: date });
      }
      added++;
      i++;
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return rows;
})();

export const ensureSeed = async () => {
  const existing = await getAllRates();
  if (existing.length > 0) return false;
  await addRates([...backfill, ...seedRows]);
  await addAudit({
    ts: new Date().toISOString(),
    action: "Seed Data Loaded",
    event: `Initial RBZ rate dataset bootstrapped — latest publication ${TODAY}`,
    status: "info",
    payload: { count: backfill.length + seedRows.length, latest: TODAY },
  });
  return true;
};
