import type { RateRecord } from "./db";

// Known currency codes published by the RBZ daily exchange-rate sheet.
// Compound entries (ZMW/ZMK, MZN/MET) are matched by their leading token.
const CURRENCY_CODES = [
  "USD", "ZAR", "GBP", "JPY", "ZMW", "ZMK", "BWP", "CHF", "MWK", "AUD",
  "SDR", "MZN", "MET", "NOK", "SEK", "CAD", "EUR", "CNY", "INR", "NZD",
  "DKK", "XAU", "AFN", "THB", "ETB", "SZL", "MUR", "MYR", "LSL", "CYP",
  "EGP", "BRL", "TZS", "RUB", "KES", "DEM", "ESP", "ITL", "FRF", "HKD",
  "ARS", "XAF",
];

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

export interface ParsedSheet {
  publicationDate: string; // ISO yyyy-mm-dd
  publicationLabel: string; // Original human-readable label
  rows: RateRecord[];
  rawText: string;
}

let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;
const loadPdfJs = async () => {
  if (typeof window === "undefined") {
    throw new Error("PDF parsing is only available in the browser");
  }
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjsLib = await import("pdfjs-dist");
      const workerSrc = (await import("pdfjs-dist/build/pdf.worker.mjs?url")).default;
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
      return pdfjsLib;
    })();
  }
  return pdfjsPromise;
};

export const parseRbzPdf = async (file: File): Promise<ParsedSheet> => {
  const pdfjsLib = await loadPdfJs();
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;

  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const p = await pdf.getPage(i);
    const content = await p.getTextContent();
    fullText += content.items.map((it: any) => it.str).join(" ") + "\n";
  }

  const { iso, label } = extractPublicationDate(fullText);
  const rows = extractRateRows(fullText, iso);

  return { publicationDate: iso, publicationLabel: label, rows, rawText: fullText.slice(0, 4000) };
};

function extractPublicationDate(text: string): { iso: string; label: string } {
  // Patterns: "Friday, June 5, 2026" | "5 June 2026" | "2026-06-05"
  const monthAlt = MONTHS.join("|");
  const mMonthDay = new RegExp(`(${monthAlt})\\s+(\\d{1,2}),?\\s+(\\d{4})`, "i");
  const mDayMonth = new RegExp(`(\\d{1,2})\\s+(${monthAlt})\\s+(\\d{4})`, "i");
  const mIso = /(\d{4})-(\d{2})-(\d{2})/;

  let y = 0, mo = 0, d = 0;
  let label = "";
  let match: RegExpMatchArray | null;

  if ((match = text.match(mMonthDay))) {
    mo = MONTHS.indexOf(match[1].toLowerCase()) + 1;
    d = parseInt(match[2], 10);
    y = parseInt(match[3], 10);
    label = `${match[1]} ${d}, ${y}`;
  } else if ((match = text.match(mDayMonth))) {
    d = parseInt(match[1], 10);
    mo = MONTHS.indexOf(match[2].toLowerCase()) + 1;
    y = parseInt(match[3], 10);
    label = `${d} ${match[2]} ${y}`;
  } else if ((match = text.match(mIso))) {
    y = +match[1]; mo = +match[2]; d = +match[3];
    label = match[0];
  } else {
    const now = new Date();
    y = now.getUTCFullYear(); mo = now.getUTCMonth() + 1; d = now.getUTCDate();
    label = now.toDateString();
  }

  const iso = `${y.toString().padStart(4, "0")}-${mo.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
  return { iso, label };
}

function extractRateRows(text: string, publicationDate: string): RateRecord[] {
  // Tokenize: split on whitespace, keep currency codes and numeric tokens.
  const tokens = text.split(/\s+/).filter(Boolean);
  const rows: RateRecord[] = [];
  const seen = new Set<string>();

  const isNumber = (t: string) => /^-?[\d,]+(?:\.\d+)?$/.test(t);
  const toNum = (t: string) => parseFloat(t.replace(/,/g, ""));

  for (let i = 0; i < tokens.length; i++) {
    const raw = tokens[i];
    // Match codes like "USD", "ZMW/ZMK", "MZN/MET"
    const baseCode = raw.split("/")[0]?.toUpperCase();
    if (!baseCode || !CURRENCY_CODES.includes(baseCode)) continue;
    if (seen.has(baseCode)) continue;

    // Collect the next 6 numeric tokens (skipping the "*" indices marker).
    const nums: number[] = [];
    let j = i + 1;
    while (j < tokens.length && nums.length < 6) {
      const t = tokens[j];
      if (t === "*") { j++; continue; }
      // Stop if we hit another currency code (malformed row)
      const nextBase = t.split("/")[0]?.toUpperCase();
      if (CURRENCY_CODES.includes(nextBase) && !isNumber(t)) break;
      if (isNumber(t)) {
        nums.push(toNum(t));
        j++;
      } else {
        // unknown token — skip
        j++;
      }
    }

    if (nums.length < 6) continue;
    // Layout: [usdBid, usdAsk, usdMid, zwgBid, zwgAsk, zwgMid]
    const [, , , zwgBid, zwgAsk, zwgMid] = nums;
    if (!isFinite(zwgMid) || zwgMid <= 0) continue;

    rows.push({
      date: publicationDate,
      currency: baseCode === "ZMW" ? "ZMW" : baseCode === "MZN" ? "MZN" : baseCode,
      bid: zwgBid,
      ask: zwgAsk,
      mid: zwgMid,
      source: "RBZ PDF Upload",
      importMethod: "pdf",
      status: "ok",
      publishedAt: publicationDate,
    });
    seen.add(baseCode);
  }

  return rows;
}
