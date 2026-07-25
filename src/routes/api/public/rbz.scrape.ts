import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const MONTHS_LOWER = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "X-Content-Type-Options": "nosniff",
} as const;

const TIMEOUT_MS = 8_000;
const RATE_LIMIT = 30;         // requests
const RATE_WINDOW_MS = 60_000; // per minute
const rateLog = new Map<string, number[]>();

const querySchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

const buildPdfUrl = (y: number, m: number, d: number) => {
  const monthCap = MONTHS_LOWER[m - 1].replace(/^./, (c) => c.toUpperCase());
  const monthUpper = MONTHS_LOWER[m - 1].toUpperCase();
  return `https://www.rbz.co.zw/documents/Exchange_Rates/${y}/${monthCap}/RATES_${d}_${monthUpper}_${y}.pdf`;
};

const isWeekend = (y: number, m: number, d: number) => {
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return wd === 0 || wd === 6;
};

const clientKey = (request: Request) =>
  request.headers.get("cf-connecting-ip") ||
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
  "anon";

const rateLimited = (key: string): boolean => {
  const now = Date.now();
  const arr = (rateLog.get(key) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (arr.length >= RATE_LIMIT) { rateLog.set(key, arr); return true; }
  arr.push(now);
  rateLog.set(key, arr);
  // Opportunistic cleanup so the map doesn't grow unbounded.
  if (rateLog.size > 500) {
    for (const [k, v] of rateLog) if (v.length === 0 || now - v[v.length - 1] > RATE_WINDOW_MS) rateLog.delete(k);
  }
  return false;
};

/**
 * GET /api/public/rbz/scrape?year=2026&month=6
 * Discovers RBZ daily exchange-rate PDFs by probing the deterministic URL
 * pattern (RATES_<day>_<MONTH>_<year>.pdf) for every weekday in the month
 * and returning the ones that respond 200.
 *
 * Security: Zod-validated params, per-IP rate limit (30/min), per-probe timeout.
 */
export const Route = createFileRoute("/api/public/rbz/scrape")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        try {
          if (rateLimited(clientKey(request))) {
            return json({ error: "Rate limit exceeded" }, 429);
          }
          const url = new URL(request.url);
          const now = new Date();
          const parsed = querySchema.safeParse({
            year: url.searchParams.get("year") || String(now.getUTCFullYear()),
            month: url.searchParams.get("month") || String(now.getUTCMonth() + 1),
          });
          if (!parsed.success) return json({ error: "Invalid year/month" }, 400);
          const { year, month } = parsed.data;
          const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

          const probes = await Promise.all(
            Array.from({ length: daysInMonth }, (_, i) => i + 1)
              .filter((d) => !isWeekend(year, month, d))
              .map(async (day) => {
                const pdfUrl = buildPdfUrl(year, month, day);
                const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const ac = new AbortController();
                const to = setTimeout(() => ac.abort(), TIMEOUT_MS);
                try {
                  const r = await fetch(pdfUrl, {
                    method: "GET",
                    headers: {
                      "User-Agent": "Mozilla/5.0 ZW-FX-Workbench/1.0",
                      Range: "bytes=0-0",
                    },
                    signal: ac.signal,
                  });
                  if (r.status === 200 || r.status === 206) {
                    try { await r.arrayBuffer(); } catch { /* ignore */ }
                    return { date: iso, url: pdfUrl };
                  }
                } catch { /* network error or timeout — treat as missing */ }
                finally { clearTimeout(to); }
                return null;
              }),
          );
          const entries = probes.filter((e): e is { date: string; url: string } => !!e)
            .sort((a, b) => a.date.localeCompare(b.date));

          return json({
            month,
            year,
            entries,
            checkedAt: new Date().toISOString(),
          });
        } catch (e) {
          return json({ error: String((e as Error)?.message ?? e) }, 502);
        }
      },
    },
  },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}
