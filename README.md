# Zimbabwe FX Operations Workbench (Treasury Console)
### Enterprise Treasury Console for RBZ Exchange-Rate Ingestion, Settlement, and Audit
**Version:** 1.0.0 | **Architecture:** Client-Owned, Edge-Proxied Single-Page Application
## 1. Executive Summary & Problem Statement
In the Zimbabwean financial ecosystem, referencing daily foreign exchange rates from the Reserve Bank of Zimbabwe (RBZ) is a mandatory, high-friction task for treasury operations. Finance teams traditionally face a broken workflow: navigating a legacy portal, manually downloading static PDF files, and copying currency rates into Excel sheets. This process is highly vulnerable to manual data entry errors, lacks data provenance, and completely bypasses internal audit trails.
**The Solution:** The **Zimbabwe FX Operations Workbench** transforms this manual chore into an automated, browser-first ecosystem. It acts as an automated ingestion engine that scrapes, parses, and cleans central bank data, pairing it with a multi-currency transaction workbench and a tamper-evident, client-side audit log.
## 2. Technical Stack
The system uses a modern, edge-friendly TypeScript ecosystem engineered for offline-first resilience, zero server-side database maintenance overhead, and strict numeric precision.
| Layer | Technology | Purpose |
|---|---|---|
| **Framework & Engine** | TanStack Start v1 (React 19 + Vite 7) | Fast, file-based routing and Server Functions running on Bun. |
| **State & Fetching** | Zustand + TanStack Query | Centralized frontend state machine and server route caching. |
| **Local Storage** | Typed IndexedDB (src/lib/db.ts) | Persistent offline storage for exchange rates and audit logs. |
| **Parsing Engine** | pdfjs-dist (Browser Worker) | Decoupled client-side extraction of tabular text rows from raw PDFs. |
| **Document Generation** | @react-pdf/renderer | Client-side compilation of transactional settlement reports. |
| **Styling & Motion** | Tailwind CSS v4, shadcn/ui, Framer Motion | Fluid, accessible, enterprise-grade UI styling design layout. |
| **Math Operations** | decimal.js | Prevents JavaScript floating-point drift error (0.1 + 0.2 != 0.3) for financial math. |
| **Edge Compute Deployment** | Cloudflare Workers (nodejs_compat) | Zero-egress serverless hosting and target-site CORS bypassing. |
## 3. System Architecture & Core Pipelines
```
[RBZ Central Bank Site]
         │
         ▼ (Legacy PDF / Missing CORS Headers)
┌────────────────────────────────────────────────────────┐
│               CLOUDFLARE WORKERS LAYER                 │
│  /api/public/rbz/scrape     │ /api/public/rbz/pdf      │
└────────┬───────────────────────────────────────┬───────┘
         │ (Cheerio Scraped Links)               │ (Buffered Binary Stream)
         ▼                                       ▼
┌────────────────────────────────────────────────────────┐
│                   CLIENT BROWSER LAYER                 │
│  ┌───────────────────────┐   ┌──────────────────────┐  │
│  │     rbzSync.ts        ├──►│     pdfParser.ts     │  │
│  │ (Diffs & Orchestration)│   │ (pdfjs-dist Workers) │  │
│  └──────────┬────────────┘   └──────────┬───────────┘  │
│             │                           │              │
│             ▼                           ▼              │
│  ┌──────────────────────────────────────────────────┐  │
│  │        Zustand Client State Machine              │  │
│  │        (Single Source of Truth / useFxStore)     │  │
│  └──────────┬───────────────────────────┬───────────┘  │
│             ▼                           ▼              │
│  ┌───────────────────────┐   ┌──────────────────────┐  │
│  │ IndexedDB Object Store│   │   Shadcn / UI View   │  │
│  │ (Rates + Audit Logs)  │   │  (Dashboard/Console) │  │
│  └───────────────────────┘   └──────────────────────┘  │
└────────────────────────────────────────────────────────┘

```
### Critical Subsystem Architecture
 * **The Cloudflare Worker CORS Bypass Proxy:** The Reserve Bank of Zimbabwe's web server does not send CORS headers, making direct browser-side fetching impossible. The application runs edge server routes (/api/public/rbz/scrape and /api/public/rbz/pdf) to securely transparently proxy elements.
 * **Weekend-Aware Targeting (src/lib/businessDay.ts):** Central banks do not release exchange publications over weekends. The engine uses local date machinery rather than ISO UTC timestamps to bypass timezone boundary drift, falling back to the preceding Friday when tracking weekend records.
 * **Network Stability Mitigation (The Byte-Range Probe):** Rather than calling a standard HEAD network request—which causes the legacy RBZ host to drop connections and return erratic status errors—the backend employs a ranged GET network call (Range: bytes=0-0). This reads only the first initial byte of a remote resource to cleanly prove file availability.
## 4. Daily Synchronization & Data Flow
```
[Page Initialization] ──► [Compute Local Timezone] ──► [Filter Weekends to Friday]
                                                                  │
┌─────────────────────────────────────────────────────────────────┘
▼
[Scrape Monthly Index Page via Server Worker] ──► [Diff Web Array against IndexedDB Cache]
                                                                  │
┌─────────────────────────────────────────────────────────────────┘
▼
[Download New / Missing Items] ──► [Execute Client Worker Extract] ──► [Commit Rows to Storage]
                                                                                  │
                                                                       ┌──────────┴──────────┐
                                                                       ▼                     ▼
                                                             [Append Audit Event]   [Refresh UI View]

```
If an updated official ledger has not yet been released by the RBZ for the targeted business calendar slot, the interface catches the scenario cleanly—pinning the closest chronologically available rate historical node alongside a clear "No PDF Yet" system warning flag.
## 5. Data Models (Client-Owned Storage Schema)
The architecture removes server-side storage, writing structures directly into the user's sandboxed IndexedDB environment.
### RateRecord Schema
```typescript
interface RateRecord {
  id: string;            // Composite unique key (e.g., "2026-06-08_USD")
  date: string;          // Formatted local date identifier (YYYY-MM-DD)
  currency: string;      // Currency code symbol (e.g., "USD", "ZWG", "ZAR")
  bid: Decimal;          // Exact numeric purchase price point
  ask: Decimal;          // Exact numeric sale price point
  mid: Decimal;          // Exact calculated central baseline 
  source: 'RBZ Auto-Sync' | 'Manual PDF Import'; 
  publishedAt: string;   // ISO logging timestamp
}

```
### AuditEntry Schema
```typescript
interface AuditEntry {
  id: string;            // Cryptographically unique identifier (UUIDv4)
  ts: number;            // Unix epoch tracking ms timestamp
  action: string;        // Trigger system name (e.g., "RATE_SCRAPE", "USER_IMPORT")
  event: string;         // Human-scannable process message logging summary
  status: 'info' | 'success' | 'warning' | 'error';
  payload?: Record<string, any>; // Flexible contextual error debug metadata
}

```
## 6. Functional Application Modules
 * **/ (Dashboard System Console):** Renders pinned primary target pairs (USD/ZWG and ZAR), a responsive 7-day trend metric graph built using Recharts, global sync state trigger macros, and an interactive drag-and-drop file zone for direct local manual PDF ingestion fallbacks.
 * **/workbench (Transaction Formulation Environment):** A dedicated multi-currency calculator designed for real-world operations. It processes intermediate financial elements like Intermediated Money Transfer Tax (IMTT), bespoke structural banking processing fees, and effective net margins, utilizing @react-pdf/renderer to build immediate downloadable settlement worksheets.
 * **/data-integrity (Central Cryptographic Audit Log):** Houses deep tabular diagnostic panels showcasing full baseline history, searchable system logs, and data validation tools to guarantee records match official reference benchmarks.
 * **/about (System Blueprint Documentation):** Renders this documentation natively inside the client view layout with an interactive blueprint file download utility.
## 7. Production Edge-Case Mitigations
> ### 💡 Engineering Design Details
>  * **Zero Floating-Point Leakage:** Simple float execution in core JavaScript engine configurations leads to data mutation errors like 19.95 * 100 = 1994.9999999999998. The workbench strictly isolates financial balances and operational fee models inside decimal.js contexts to safeguard corporate compliance limits.
>  * **SSR Hydration Boundaries:** Initializing dynamic dates on a web server creates immediate string mismatch bugs if the server compilation routine crosses a midnight threshold before downloading to the browser runtime. The platform forces safe client-side state initialization, marking target UI wrappers via suppressHydrationWarning placeholders to achieve clean operational alignment.
> 

