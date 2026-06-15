# Zimbabwe FX Operations Workbench

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Version](https://img.shields.io/badge/Version-1.0.0-success.svg)](./package.json)
[![Node](https://img.shields.io/badge/Node-20%2B-brightgreen.svg)]()
[![Bun](https://img.shields.io/badge/Bun-1.0%2B-orange.svg)]()

**Enterprise Treasury Console for RBZ Exchange-Rate Ingestion, Settlement, and Audit**

A modern, offline-first single-page application that automates daily foreign exchange rate ingestion from the Reserve Bank of Zimbabwe (RBZ), enabling treasury teams to perform real-time settlement calculations and comprehensive auditing—all within the browser.

---

## 📋 Table of Contents

- [Executive Summary](#-executive-summary)
- [Quick Start](#-quick-start)
- [Technical Stack](#-technical-stack)
- [System Architecture](#-system-architecture)
- [API Reference](#-api-reference)
- [Data Models](#-data-models)
- [Application Routes](#-application-routes)
- [Deployment](#-deployment)
- [Troubleshooting](#-troubleshooting)
- [License](#-license)

---

## 🎯 Executive Summary

### The Problem

In Zimbabwe's financial ecosystem, treasury operations require daily reference to RBZ-published foreign exchange rates—a **mandatory but time-consuming manual task**. Finance teams currently:

- Navigate to RBZ website and download PDFs
- Parse rate tables by hand or spreadsheet import
- Reconcile rates across multiple sources
- Maintain audit trails through disconnected spreadsheets

This creates **operational friction, audit gaps, and data accuracy risks**.

### The Solution

The **Zimbabwe FX Operations Workbench** transforms this workflow into a **zero-friction, audited, browser-native ecosystem**. It:

✅ **Automates** daily RBZ PDF scraping and rate extraction  
✅ **Operates Offline** — all data persists in IndexedDB; works without internet  
✅ **Prevents Errors** — decimal.js eliminates floating-point drift in financial calculations  
✅ **Audits Everything** — every rate sync, import, and calculation is logged and searchable  
✅ **No Backend** — client-owned storage; zero server maintenance  

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20+ or **Bun** 1.0+
- **Git**
- Modern browser (Chrome, Firefox, Safari, Edge)

### Installation

```bash
# Clone the repository
git clone https://github.com/tsakane28/zimflowforge.git
cd zimflowforge

# Install dependencies
npm install
# or with Bun
bun install
```

### Development Server

```bash
npm run dev
# or with Bun
bun run dev
```

The application will be available at `http://localhost:5173`

### Building for Production

```bash
npm run build
# or
bun run build
```

### Preview Production Build

```bash
npm run preview
```

---

## 🛠️ Technical Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Framework & Engine** | TanStack Start v1 (React 19 + Vite 7) | File-based routing with Server Functions on Bun runtime |
| **State Management** | Zustand + TanStack Query | Centralized client state machine with server route caching |
| **Local Storage** | Typed IndexedDB (`src/lib/db.ts`) | Persistent offline storage for rates, audit logs, and calculations |
| **PDF Parsing** | pdfjs-dist (Browser Worker) | Client-side extraction of tabular rate data from RBZ PDFs |
| **Document Generation** | @react-pdf/renderer | Browser-compiled settlement reports and audit exports |
| **UI & Styling** | Tailwind CSS v4, shadcn/ui, Framer Motion | Accessible, responsive, enterprise-grade interface |
| **Financial Math** | decimal.js | Prevents JavaScript floating-point errors (0.1 + 0.2 ≠ 0.3) |
| **Edge Deployment** | Cloudflare Workers (`nodejs_compat`) | Zero-egress serverless; CORS proxy for RBZ legacy site |

---

## 🏗️ System Architecture

### Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                   RBZ CENTRAL BANK SITE                      │
│                  (Legacy PDF + No CORS)                      │
└───────────────────────┬──────────────────────────────────────┘
                        │
        ┌───────────────┴───────────────┐
        │                               │
        ▼                               ▼
┌─────────────────────────┐   ┌──────────────────────────┐
│  CLOUDFLARE WORKERS     │   │  CLOUDFLARE WORKERS      │
│  /api/rbz/scrape        │   │  /api/rbz/pdf            │
│  (Link index)           │   │  (Binary proxy)          │
└──────────┬──────────────┘   └────────────┬─────────────┘
           │                              │
           └──────────────┬───────────────┘
                         ▼
        ┌─────────────────────────────────────┐
        │   BROWSER CLIENT (React SPA)        │
        │  ┌────────────────────────────────┐ │
        │  │    rbzSync.ts (Orchestrator)   │ │
        │  └────────────┬───────────────────┘ │
        │               │                     │
        │  ┌────────────▼───────────────────┐ │
        │  │   pdfParser.ts (PDF Worker)    │ │
        │  └────────────��───────────────────┘ │
        │               │                     │
        │  ┌────────────▼───────────────────┐ │
        │  │  Zustand State (useFxStore)   │ │
        │  └────────────┬───────────────────┘ │
        │               │                     │
        │  ┌────────────▼──────┐ ┌──────────┐ │
        │  │ IndexedDB Storage │ │ UI Views │ │
        │  │ (Rates + Audit)   │ │ (Render) │ │
        │  └───────────────────┘ └──────────┘ │
        └─────────────────────────────────────┘
```

### Critical Subsystems

#### 1. **Cloudflare Worker CORS Bypass Proxy**
The RBZ website does not send CORS headers, blocking direct browser requests. The Workers layer acts as a transparent proxy:

- Scrapes the RBZ monthly index page using Cheerio
- Streams binary PDF buffers to the browser with correct MIME types
- No rate limiting or caching; each request is fresh

#### 2. **Business Day Awareness** (`src/lib/businessDay.ts`)
Central banks don't publish rates on weekends. The engine:

- Uses local device timezone (not UTC) to identify the current business day
- Targets Friday's rates when querying on weekends
- Prevents "no data available" errors from user confusion

#### 3. **Network Resilience** (Byte-Range Probe)
The legacy RBZ server is flaky. Instead of standard `HEAD` requests (which cause timeouts), the system:

- Issues byte-range requests (`Range: bytes=0-1`) to check file availability
- Gracefully degrades to cached data if the network fails
- Retries with exponential backoff

---

## 📡 API Reference

All endpoints run on **Cloudflare Workers**. Base URL depends on deployment (see [Deployment](#-deployment)).

### `GET /api/public/rbz/scrape`

Fetches the RBZ monthly publication index and returns available PDF links.

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `month` | string (YYYY-MM) | Yes | Target month (e.g., `2026-06`) |

**Response (200 OK):**

```json
{
  "success": true,
  "month": "2026-06",
  "publications": [
    {
      "date": "2026-06-15",
      "url": "https://rbz.co.zw/rates/2026-06-15.pdf",
      "isWeekend": false
    },
    {
      "date": "2026-06-12",
      "url": "https://rbz.co.zw/rates/2026-06-12.pdf",
      "isWeekend": false
    }
  ],
  "timestamp": "2026-06-15T10:30:00Z"
}
```

**Error Response (500 Internal Server Error):**

```json
{
  "success": false,
  "error": "Failed to scrape RBZ index page",
  "details": "Connection timeout"
}
```

---

### `GET /api/public/rbz/pdf`

Proxies RBZ PDF files to the browser, bypassing CORS restrictions.

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string (URL-encoded) | Yes | Full URL of RBZ PDF |

**Response (200 OK):**

- Binary PDF stream (Content-Type: `application/pdf`)

**Error Response (400 Bad Request):**

```json
{
  "success": false,
  "error": "Missing or invalid 'url' parameter"
}
```

**Error Response (504 Gateway Timeout):**

```json
{
  "success": false,
  "error": "RBZ server not responding",
  "retryAfterSeconds": 60
}
```

---

## 📊 Data Models

### RateRecord

Represents a single FX rate for a currency on a specific date.

```typescript
interface RateRecord {
  // Unique identifier: "{YYYY-MM-DD}_{CURRENCY}"
  id: string;

  // Date in local timezone (YYYY-MM-DD format)
  date: string;

  // Currency code (e.g., "USD", "ZWG", "ZAR")
  currency: string;

  // Bid price (purchase rate) — decimal to prevent float errors
  bid: Decimal;

  // Ask price (sale rate) — decimal to prevent float errors
  ask: Decimal;

  // Calculated midpoint = (bid + ask) / 2
  mid: Decimal;

  // Source of rate: auto-scraped or manually uploaded
  source: "RBZ Auto-Sync" | "Manual PDF Import";

  // ISO 8601 timestamp when rate was ingested
  publishedAt: string;
}
```

### AuditEntry

Logs every system action for compliance and debugging.

```typescript
interface AuditEntry {
  // Cryptographic unique identifier (UUIDv4)
  id: string;

  // Unix timestamp in milliseconds
  ts: number;

  // Action name (e.g., "RATE_SCRAPE", "USER_IMPORT", "SETTLEMENT_CALC")
  action: string;

  // Human-readable summary (e.g., "Downloaded 45 rates for Jun 2026")
  event: string;

  // Log level
  status: "info" | "success" | "warning" | "error";

  // Optional context (error stacks, affected records, etc.)
  payload?: Record<string, any>;
}
```

---

## 📑 Application Routes

| Route | Module | Purpose |
|-------|--------|---------|
| `/` | Dashboard | Primary UI: rate pairs (USD/ZWG, ZAR), 7-day trend graph, sync controls |
| `/workbench` | Transaction Formulation | Multi-currency calculator for real-world settlement scenarios |
| `/data-integrity` | Audit Log | Searchable, filterable audit trail and data validation tools |
| `/about` | Documentation | This README rendered inline + blueprint file download |

---

## 🚀 Deployment

### Local Development

```bash
bun run dev
```

Starts the Vite dev server on `http://localhost:5173`.

### Cloudflare Workers Deployment

The application uses **Cloudflare Workers** for the `/api/rbz/*` endpoints. Deploy the Worker code (typically in `wrangler.toml` + `src/worker/` directory):

```bash
# Install Wrangler CLI
npm install -g @cloudflare/wrangler

# Deploy to Cloudflare
wrangler publish
```

**Environment Variables** (set in Cloudflare Workers dashboard or `.env`):

```env
# Optional: Override RBZ scrape URL (defaults to rbz.co.zw)
RBZ_BASE_URL=https://rbz.co.zw

# Optional: Set request timeout in seconds (default: 30)
REQUEST_TIMEOUT_SEC=30
```

### Production SPA Deployment

The compiled React app (`dist/`) can be deployed to any static host:

```bash
# Build production bundle
npm run build

# Deploy `dist/` folder to:
# - Vercel, Netlify, Cloudflare Pages, AWS S3, or any CDN
```

**Recommended Platforms:**

- **Cloudflare Pages** — zero-config, integrates with Workers
- **Vercel** — seamless React tooling
- **Netlify** — easy CI/CD with GitHub integration

---

## ⚠️ Troubleshooting

### "No rates available for this date"

**Cause:** The RBZ hasn't published rates yet (before ~10 AM SAST), or the system is querying a weekend/holiday.

**Solution:**
- Wait for the next business day
- Check the RBZ website manually to confirm publication
- Manually import rates via the **Workbench** module

### "Failed to fetch from RBZ"

**Cause:** Network timeout or RBZ server is down.

**Solution:**
- Check your internet connection
- Verify RBZ website is accessible (https://rbz.co.zw)
- Wait 1–2 minutes and retry
- Check the **Data Integrity** module for error logs with retry details

### "PDF parsing failed"

**Cause:** RBZ changed PDF format or table structure.

**Solution:**
- Check the **Data Integrity** module for parsing error details
- Manually verify the PDF can be opened in your browser
- File an issue on GitHub with the PDF URL and error stack

### IndexedDB quota exceeded

**Cause:** Browser's local storage limit reached (typically 50 MB).

**Solution:**
- Delete old audit entries via **Data Integrity** → "Purge Logs" button
- Export rates to CSV for archival
- Clear browser cache for this site (Settings → Storage → Clear site data)

### SSR Hydration Mismatch

**Cause:** Server timezone differs from client, causing date string mismatches.

**Solution:**
- Ensure server runtime (Bun) is configured to UTC
- Set `TZ=Africa/Harare` environment variable on server
- Rebuild and restart dev server

---

## 🧪 Testing

Run the linter and formatter:

```bash
npm run lint
npm run format
```

Run unit tests (if configured):

```bash
npm run test
```

---

## 📝 License

This project is licensed under the **MIT License**. See [`LICENSE`](./LICENSE) for details.

**You are free to:**
- ✅ Use for personal and commercial purposes
- ✅ Modify and distribute
- ✅ Include in proprietary software

**You must:**
- ⚠️ Include the original license and copyright notice

---

## 🤝 Contributing

Contributions are welcome! Please open an issue or pull request on GitHub.

---

## 📞 Support

For issues, questions, or feature requests:

- 📧 **Email:** [Your contact info]
- 🐛 **GitHub Issues:** [zimflowforge/issues](https://github.com/tsakane28/zimflowforge/issues)
- 📚 **Documentation:** See `/about` route in the app

---

**Made with ❤️ for Zimbabwe's financial ecosystem**
