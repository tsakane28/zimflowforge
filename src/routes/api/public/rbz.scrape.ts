import { createFileRoute } from "@tanstack/react-router";

const MONTHS_LOWER = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

const buildPdfUrl = (y: number, m: number, d: number) => {
  const monthCap = MONTHS_LOWER[m - 1].replace(/^./, (c) => c.toUpperCase());
  const monthUpper = MONTHS_LOWER[m - 1].toUpperCase();
  return `https://www.rbz.co.zw/documents/Exchange_Rates/${y}/${monthCap}/RATES_${d}_${monthUpper}_${y}.pdf`;
};

const isWeekend = (y: number, m: number, d: number) => {
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return wd === 0 || wd === 6;
};

/**
 * GET /api/public/rbz/scrape?year=2026&month=6
 * Discovers RBZ daily exchange-rate PDFs by probing the deterministic URL
 * pattern (RATES_<day>_<MONTH>_<year>.pdf) for every weekday in the month
 * and returning the ones that respond 200.
 */
export const Route = createFileRoute("/api/public/rbz/scrape")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const now = new Date();
          const year = parseInt(url.searchParams.get("year") || String(now.getUTCFullYear()), 10);
          const month = parseInt(url.searchParams.get("month") || String(now.getUTCMonth() + 1), 10);
          if (!year || !month || month < 1 || month > 12) {
            return json({ error: "Invalid year/month" }, 400);
          }
          const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

          // Probe weekdays in parallel; weekends never publish.
          const probes = await Promise.all(
            Array.from({ length: daysInMonth }, (_, i) => i + 1)
              .filter((d) => !isWeekend(year, month, d))
              .map(async (day) => {
                const pdfUrl = buildPdfUrl(year, month, day);
                try {
                  const r = await fetch(pdfUrl, {
                    method: "HEAD",
                    headers: { "User-Agent": "Mozilla/5.0 ZW-FX-Workbench/1.0" },
                  });
                  if (r.ok) {
                    const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                    return { date: iso, url: pdfUrl };
                  }
                } catch { /* ignore */ }
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
