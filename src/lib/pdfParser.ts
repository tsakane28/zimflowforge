import type { RateRecord } from "./db";

const TARGET_CCYS = ["USD", "GBP", "ZAR", "EUR", "BWP"];

export interface ParsedSheet {
  publicationDate: string;
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

  const dateMatch =
    fullText.match(/(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})/i) ||
    fullText.match(/(\d{4}-\d{2}-\d{2})/);
  const publicationDate = dateMatch ? normalizeDate(dateMatch[1]) : new Date().toISOString().slice(0, 10);

  const rows: RateRecord[] = [];
  for (const ccy of TARGET_CCYS) {
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
