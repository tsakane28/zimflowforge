import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

const MONTHS_LOWER = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

const buildPdfUrl = (y: number, m: number, d: number) => {
  const monthCap = MONTHS_LOWER[m - 1].replace(/^./, (c) => c.toUpperCase());
  const monthUpper = MONTHS_LOWER[m - 1].toUpperCase();
  return `https://www.rbz.co.zw/documents/Exchange_Rates/${y}/${monthCap}/RATES_${d}_${monthUpper}_${y}.pdf`;
};

const isWeekendUTC = (y: number, m: number, d: number) => {
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return wd === 0 || wd === 6;
};

async function pdfExists(url: string): Promise<boolean> {
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), 8_000);
  try {
    const r = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 ZW-FX-Workbench/1.0",
        Range: "bytes=0-0",
      },
      signal: ac.signal,
    });
    if (r.status === 200 || r.status === 206) {
      try { await r.arrayBuffer(); } catch { /* ignore */ }
      return true;
    }
  } catch { /* ignore network error or timeout */ }
  finally { clearTimeout(to); }
  return false;
}

export default defineTool({
  name: "get_latest_rbz_publication",
  title: "Get latest RBZ rate publication",
  description:
    "Find the most recent Reserve Bank of Zimbabwe daily exchange-rate PDF that has been published on or before an optional target date. Skips weekends automatically (RBZ does not publish on Saturdays or Sundays) and walks back up to 10 weekdays to find the newest available PDF. Returns the ISO date and direct PDF URL.",
  inputSchema: {
    on_or_before: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .describe(
        "Optional ISO date (YYYY-MM-DD). Defaults to today (UTC). The search starts from this date and walks backwards to the most recent weekday with a published PDF.",
      ),
  },
  annotations: { readOnlyHint: true, idempotentHint: false, openWorldHint: true },
  handler: async ({ on_or_before }) => {
    const start = on_or_before ? new Date(`${on_or_before}T00:00:00Z`) : new Date();
    const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));

    for (let i = 0; i < 10; i++) {
      const y = cursor.getUTCFullYear();
      const m = cursor.getUTCMonth() + 1;
      const d = cursor.getUTCDate();
      if (!isWeekendUTC(y, m, d)) {
        const url = buildPdfUrl(y, m, d);
        if (await pdfExists(url)) {
          const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          return {
            content: [{ type: "text", text: `Latest RBZ publication: ${iso}\n${url}` }],
            structuredContent: { date: iso, url, checked_back_days: i },
          };
        }
      }
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }

    return {
      content: [
        {
          type: "text",
          text: `No RBZ publication found within 10 weekdays on or before ${on_or_before ?? "today"}.`,
        },
      ],
      isError: true,
    };
  },
});
