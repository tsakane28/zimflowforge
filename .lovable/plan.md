# Add Project Documentation + Info Page

## Goal
Document the entire system (technology stack, architecture, RBZ scraping flow, data model, etc.) and surface it inside the app via a new **Info** button in the top nav, opening an `/about` route that also offers a downloadable PDF README.

## Deliverables

### 1. Written documentation (Markdown source of truth)
Create `docs/PROJECT_README.md` covering:
- **Overview** — what the Zimbabwe FX Operations Workbench does
- **Technology stack**
  - Frontend: React 19, TanStack Start v1, TanStack Router (file-based), TanStack Query, Zustand, Tailwind v4, shadcn/ui, Framer Motion, Recharts
  - Backend runtime: Cloudflare Workers (TanStack Start server routes + server functions)
  - Storage: IndexedDB (Dexie-style wrapper in `src/lib/db.ts`) for rates + audit log
  - PDF parsing: `pdfjs-dist` in the browser
  - Build: Vite 7, Bun
- **System architecture**
  - Client store (`useFxStore`) — initialization, seed data, auto-sync
  - Weekend-aware business-day logic (`businessDay.ts`)
  - RBZ scraper proxy routes (`/api/public/rbz/scrape`, `/api/public/rbz/pdf`) — why a server proxy is needed (CORS), ranged-GET probe trick
  - Sync pipeline (`rbzSync.ts`) — scrape index → dedupe vs IndexedDB → fetch PDFs → parse → persist + audit
  - Manual PDF upload fallback
  - Dashboard rendering + USD/ZAR priority sort
- **Data model** — RateRecord, AuditEntry shapes
- **Operational notes** — timezone handling (`toIsoDate` local-date fix), fallback when RBZ has no PDF for target date
- **Project structure** — key folders
- **How to extend** — adding a new currency, changing fallback rules

### 2. PDF generation
Generate `public/project-readme.pdf` from the Markdown so it can be served as a static download via `<a href="/project-readme.pdf" download>`. Build script (`scripts/build-readme-pdf.mjs`) using a lightweight markdown→PDF approach (e.g. `md-to-pdf` or jsPDF with sectioned content). Run once and commit the PDF; no runtime generation needed.

### 3. New `/about` route
- `src/routes/about.tsx` — full About / How-it-was-built page rendering the same content as the Markdown (sectioned with cards, table of contents)
- Distinct `head()` metadata (title, description, og:title/description)
- Prominent **Download README (PDF)** button linking to `/project-readme.pdf`
- "View on GitHub"-style external link omitted unless user provides URL

### 4. Info button in the menu
- Edit `src/components/AppShell.tsx` nav to add an **Info** entry (lucide `Info` icon) routing to `/about`
- Works in desktop nav and mobile menu

## Files to add
- `docs/PROJECT_README.md`
- `public/project-readme.pdf` (generated artifact)
- `scripts/build-readme-pdf.mjs`
- `src/routes/about.tsx`

## Files to edit
- `src/components/AppShell.tsx` (add Info nav item)

## Open question
Do you want the PDF auto-regenerated on each build (add to `package.json` build script), or is a one-time committed PDF fine? Default: one-time committed PDF, regenerated manually with `bun run scripts/build-readme-pdf.mjs` when docs change.