import { createFileRoute } from "@tanstack/react-router";

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

const PARENT = "https://www.rbz.co.zw/index.php/research/markets/exchange-rates/13-daily-exchange-rates";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

/**
 * GET /api/public/rbz/scrape?year=2026&month=6
 * Returns { month, year, entries: [{ date, url }] } for every PDF currently
 * linked in the RBZ daily-exchange-rates index for that month.
 */
export const Route = createFileRoute("/api/public/rbz/scrape")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const now = new Date();
          const year = parseInt(url.searchParams.get("year") || String(now.getFullYear()), 10);
          const month = parseInt(url.searchParams.get("month") || String(now.getMonth() + 1), 10);
          if (!year || !month || month < 1 || month > 12) {
            return json({ error: "Invalid year/month" }, 400);
          }
          const monthName = MONTHS[month - 1];

          // 1) Find the month-specific slug from the parent index.
          const parentHtml = await fetchText(PARENT);
          const slugRegex = new RegExp(
            `href=\"([^\"]*?/13-daily-exchange-rates/\\d+-${monthName}-${year})\"`,
            "i",
          );
          const slugMatch = parentHtml.match(slugRegex);
          const monthUrl = slugMatch
            ? absolutize(slugMatch[1])
            : `${PARENT}/${monthName}-${year}`; // best-effort fallback

          // 2) Fetch the month page and extract all RATES_*.pdf links.
          const monthHtml = await fetchText(monthUrl);
          const pdfRegex = new RegExp(
            `https?://[^\"'\\s]*?/Exchange_Rates/${year}/[A-Za-z]+/RATES_(\\d{1,2})_[A-Z]+_${year}\\.pdf`,
            "gi",
          );
          const seen = new Set<string>();
          const entries: { date: string; url: string }[] = [];
          let m: RegExpExecArray | null;
          while ((m = pdfRegex.exec(monthHtml)) !== null) {
            const day = parseInt(m[1], 10);
            if (!day || day < 1 || day > 31) continue;
            const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            if (seen.has(iso)) continue;
            seen.add(iso);
            entries.push({ date: iso, url: m[0] });
          }
          entries.sort((a, b) => a.date.localeCompare(b.date));

          return json({ month, year, monthUrl, entries });
        } catch (e) {
          return json({ error: String((e as Error)?.message ?? e) }, 502);
        }
      },
    },
  },
});

async function fetchText(u: string) {
  const r = await fetch(u, {
    headers: { "User-Agent": "Mozilla/5.0 ZW-FX-Workbench/1.0" },
  });
  if (!r.ok) throw new Error(`Upstream ${u} returned ${r.status}`);
  return r.text();
}

function absolutize(href: string) {
  if (href.startsWith("http")) return href;
  if (href.startsWith("/")) return `https://www.rbz.co.zw${href}`;
  return `https://www.rbz.co.zw/${href}`;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}
