import * as pdfjsLib from "pdfjs-dist";
// @ts-ignore - vite worker import
import workerSrc from "pdfjs-dist/build/pdf.worker.mjs?url";
import type { RateRecord } from "./db";

if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
}

const TARGET_CCYS = ["USD", "GBP", "ZAR", "EUR", "BWP"];

export interface ParsedSheet {
  publicationDate: string;
  rows: RateRecord[];
  rawText: string;
}

export const parseRbzPdf = async (file: File): Promise<ParsedSheet> => {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const p = await pdf.getPage(i);
    const content = await p.getTextContent();
    fullText += content.items.map((it: any) => it.str).join(" ") + "\n";
  }

  // Try to find a date like "02 June 2026" or "2026-06-02"
  const dateMatch =
    fullText.match(/(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})/i) ||
    fullText.match(/(\d{4}-\d{2}-\d{2})/);
  const publicationDate = dateMatch ? normalizeDate(dateMatch[1]) : new Date().toISOString().slice(0, 10);

  const rows: RateRecord[] = [];
  for (const ccy of TARGET_CCYS) {
    // Look for currency code followed by 3-6 numeric values
    const re = new RegExp(`${ccy}[^0-9-]*([0-9]+\\.[0-9]+)[^0-9-]+([0-9]+\\.[0-9]+)[^0-9-]+([0-9]+\\.[0-9]+)`, "i");
    const m = fullText.match(re);
    if (m) {
      const bid = parseFloat(m[1]);
      const ask = parseFloat(m[2]);
      const mid = parseFloat(m[3]);
      rows.push({
        date: publicationDate,
        currency: ccy,
        bid, ask, mid,
        source: "RBZ PDF Upload",
        importMethod: "pdf",
        status: "ok",
        publishedAt: publicationDate,
      });
    }
  }

  return { publicationDate, rows, rawText: fullText.slice(0, 4000) };
};

const normalizeDate = (s: string) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
};
