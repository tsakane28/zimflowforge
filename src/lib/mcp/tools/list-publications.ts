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

const isWeekend = (y: number, m: number, d: number) => {
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return wd === 0 || wd === 6;
};

export default defineTool({
  name: "list_rbz_publications",
  title: "List RBZ rate publications",
  description:
    "List every Reserve Bank of Zimbabwe daily exchange-rate PDF published in a given month, by probing the deterministic RBZ URL pattern for each weekday. Returns the ISO date and direct PDF URL for each publication found.",
  inputSchema: {
    year: z
      .number()
      .int()
      .min(2020)
      .max(2100)
      .describe("Four-digit year, e.g. 2026."),
    month: z
      .number()
      .int()
      .min(1)
      .max(12)
      .describe("Month number (1-12)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async ({ year, month }) => {
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const probes = await Promise.all(
      Array.from({ length: daysInMonth }, (_, i) => i + 1)
        .filter((d) => !isWeekend(year, month, d))
        .map(async (day) => {
          const pdfUrl = buildPdfUrl(year, month, day);
          const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const ac = new AbortController();
          const to = setTimeout(() => ac.abort(), 8_000);
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
    const entries = probes
      .filter((e): e is { date: string; url: string } => !!e)
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      content: [
        {
          type: "text",
          text:
            entries.length === 0
              ? `No RBZ publications found for ${year}-${String(month).padStart(2, "0")}.`
              : entries.map((e) => `${e.date}  ${e.url}`).join("\n"),
        },
      ],
      structuredContent: { year, month, count: entries.length, entries },
    };
  },
});
