// Single source of truth for the About / README content.
// Consumed by /about route and the downloadable PDF.

export interface DocSection {
  id: string;
  title: string;
  body: string[]; // paragraphs
  bullets?: string[];
}

export const PROJECT_TITLE = "Zimbabwe FX Operations Workbench";
export const PROJECT_TAGLINE =
  "Enterprise treasury console for RBZ exchange-rate ingestion, settlement, and audit.";
export const PROJECT_VERSION = "1.0.0";

export const DOC_SECTIONS: DocSection[] = [
  {
    id: "overview",
    title: "1. Overview",
    body: [
      "The Zimbabwe FX Operations Workbench is a browser-first treasury console that automates the ingestion of the Reserve Bank of Zimbabwe (RBZ) daily exchange-rate PDF, performs multi-currency settlement calculations (IMTT, bank fees, effective rate), and keeps a tamper-evident audit trail of every action.",
      "It is designed to run as a single-page application with a thin Cloudflare Worker backend used only to proxy the RBZ website (which does not expose CORS headers) and to host static assets.",
    ],
  },
  {
    id: "stack",
    title: "2. Technology Stack",
    body: [
      "The project is built on a modern, edge-friendly TypeScript stack with zero server-side database — all rate history is persisted in the user's browser via IndexedDB.",
    ],
    bullets: [
      "Framework: TanStack Start v1 (React 19 + Vite 7) running on Cloudflare Workers",
      "Routing: TanStack Router with file-based routes under src/routes/",
      "State: Zustand store (src/store/useFxStore.ts) for rates, audit, and sync status",
      "Data fetching: TanStack Query + native fetch for server functions and proxy routes",
      "Storage: IndexedDB via a typed wrapper in src/lib/db.ts (rates + audit log)",
      "PDF parsing: pdfjs-dist (browser worker) in src/lib/pdfParser.ts",
      "PDF generation: @react-pdf/renderer for settlement reports and this README",
      "UI: Tailwind CSS v4, shadcn/ui primitives, lucide-react icons, Framer Motion",
      "Charts: Recharts for the 7-day trend visualisation",
      "Numerics: decimal.js for IMTT and rate calculations (avoids float drift)",
      "Build / runtime: Bun, Vite 7, Cloudflare Workers (nodejs_compat)",
    ],
  },
  {
    id: "architecture",
    title: "3. System Architecture",
    body: [
      "The app boots from src/routes/__root.tsx, which mounts the AppShell and the Zustand store. On first load, useFxStore.init() seeds IndexedDB if empty, computes the weekend-aware target date, and immediately fires a background sync against the RBZ website.",
      "All network calls to RBZ are proxied through two server routes — /api/public/rbz/scrape and /api/public/rbz/pdf — because rbz.co.zw does not send CORS headers and the browser would otherwise be blocked.",
    ],
    bullets: [
      "src/lib/businessDay.ts — Weekend-aware date logic. If today is Saturday/Sunday, target falls back to the most recent Friday. Uses LOCAL date components (not ISO UTC) to prevent timezone drift.",
      "src/routes/api/public/rbz.scrape.ts — Server route that fetches the RBZ monthly index page, parses anchors with cheerio, and returns a list of {date, url} entries. Uses ranged GET (Range: bytes=0-0) instead of HEAD to probe existence — RBZ's host does not return 200 on HEAD reliably.",
      "src/routes/api/public/rbz.pdf.ts — Server route that streams a specific RBZ PDF back to the browser, bypassing CORS.",
      "src/lib/rbzSync.ts — Orchestrates the sync: scrape → dedupe against IndexedDB → download new PDFs → parse → persist rows → write audit entries.",
      "src/lib/pdfParser.ts — Extracts currency rows from RBZ PDFs using pdfjs-dist. Manual upload uses the same parser for fallback.",
      "src/store/useFxStore.ts — Single source of truth for the UI. Exposes init, runSync, importPdf, refreshRates, refreshAudit.",
    ],
  },
  {
    id: "flow",
    title: "4. Daily Sync Flow",
    body: [
      "On every page load the app performs the following sequence so the user always sees the freshest available rate without manual intervention:",
    ],
    bullets: [
      "Compute today's date in the user's local timezone.",
      "If weekend, fall back to the most recent Friday (RBZ does not publish on Sat/Sun).",
      "Call /api/public/rbz/scrape?year=YYYY&month=MM to list all PDFs published that month.",
      "Diff against IndexedDB; download only PDFs whose date is not already cached.",
      "Parse each new PDF and persist its rows tagged with source = 'RBZ Auto-Sync'.",
      "Write a structured audit entry for every step (started, scraped, imported, failed).",
      "Update the dashboard. USD/ZWG and ZAR are pinned to the top of the rate grid.",
      "If RBZ has not yet published for the target date, the UI shows the latest available rate with a 'no PDF yet' badge.",
    ],
  },
  {
    id: "data-model",
    title: "5. Data Model",
    body: [
      "All persistent data lives in two IndexedDB object stores. There is no server-side database — the app is fully client-owned.",
    ],
    bullets: [
      "RateRecord: { id, date, currency, bid, ask, mid, source, publishedAt }",
      "AuditEntry: { id, ts, action, event, status (info|success|warning|error), payload? }",
      "Seed data ships in src/lib/seed.ts for offline-first first-run experience.",
    ],
  },
  {
    id: "modules",
    title: "6. Functional Modules",
    body: ["The application is organised into three top-level routes, each backed by its own page component:"],
    bullets: [
      "/ — Dashboard: live rate cards (USD, ZAR pinned), 7-day trend chart, sync controls, manual PDF dropzone.",
      "/workbench — Transaction Workbench: multi-currency settlement calculator with IMTT, bank fees, and downloadable PDF settlement report.",
      "/data-integrity — Data Integrity Center: full history table, audit log viewer, and rate reconciliation tooling.",
      "/about — This documentation page with downloadable README PDF.",
    ],
  },
  {
    id: "operations",
    title: "7. Operational Notes",
    body: [
      "A few non-obvious decisions worth knowing if you maintain or extend this project:",
    ],
    bullets: [
      "Timezone: toIsoDate() uses getFullYear/getMonth/getDate (NOT toISOString) so date keys reflect the user's local day, never UTC.",
      "Probe: scrape uses Range: bytes=0-0 instead of HEAD because RBZ returns inconsistent status codes for HEAD.",
      "SSR hydration: targetDate is initialised to '' on the server and populated in init() on the client; the date span uses suppressHydrationWarning to avoid mismatch warnings when SSR and client cross a midnight boundary.",
      "Currency priority: the dashboard sort places USD then ZAR first, then alphabetises the rest.",
      "Audit: every sync, import, and failure is recorded — the Data Integrity Center exposes the full timeline.",
    ],
  },
  {
    id: "extending",
    title: "8. Extending the System",
    body: [
      "Common modifications and where to make them:",
    ],
    bullets: [
      "Add a currency: extend the CURRENCIES array in src/routes/workbench.tsx and ensure src/lib/pdfParser.ts recognises the symbol.",
      "Change fallback rules: edit describeFallback() in src/lib/businessDay.ts.",
      "Add a new audit action: call addAudit({ ts, action, event, status, payload }) from anywhere — the Data Integrity Center will display it automatically.",
      "Swap PDF source: replace the scrape and pdf proxy routes; the rest of the pipeline is source-agnostic.",
    ],
  },
];
