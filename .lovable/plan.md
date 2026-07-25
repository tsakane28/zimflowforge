# Improvement Pass — Mobile Polish, Alerts, Security

Scope: 3/5 (meaningful upgrade, no architectural rewrite). Three tracks in one pass.

---

## 1. Visual polish & mobile UX

Current pain points on 360px width:
- Header rows in `AppShell`, dashboard, and `SyncControls` use bare `flex flex-wrap` — long status text pushes buttons off-screen.
- `RateCard` grid uses fixed min-widths that cause horizontal scroll on small phones.
- Trend chart legend and workbench split-screen do not collapse below `sm`.
- `SettlementReport` and audit-log JSON viewer overflow horizontally.

Fixes:
- Rework header rows using the `grid-cols-[minmax(0,1fr)_auto]` + `min-w-0` / `shrink-0` / `truncate` pattern for `AppShell` top bar, dashboard hero, and `SyncControls`.
- Convert the currency grid to `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` with tabular-nums numeric alignment.
- Stack the workbench calculator vertically below `md`; make the settlement summary a sticky bottom sheet on mobile.
- Make the audit-log JSON viewer wrap with `break-all` inside a scroll container.
- Tighten sidebar drawer: full-height, safe-area padding, focus trap while open, close on route change.
- Add empty/loading skeletons for the rate grid and trend chart so the first paint doesn't jump.

## 2. Alerts & automation

Extend the existing toast/notification pipeline:
- **Threshold alerts**: in Settings, let the user pick 1–3 watched currencies (default USD, ZAR) and a % move threshold. On each sync, compare the newest rate to the previous day's; fire a toast + persistent audit entry when the move exceeds the threshold.
- **Daily digest**: at the first successful sync of a business day, show a one-shot "Daily digest" toast summarising target date, # of new rows, and top mover, with an "Open dashboard" action.
- **Browser notifications**: opt-in toggle in Settings that requests `Notification.permission` and mirrors new-publication + threshold toasts as OS notifications (so background tabs still alert). Falls back silently when denied.
- **Quiet hours**: reuse the existing publication-window settings — suppress non-critical toasts outside configured hours; new-publication alerts always fire.
- **Audit surfacing**: every alert writes a structured `AuditEntry` (`action: "Alert Fired"`) so users have a record.

## 3. Security hardening

The app is client-only (IndexedDB, no auth, no Cloud). Security work focuses on the two server routes and the MCP surface, plus client-side hygiene:

- **`/api/public/rbz/pdf` proxy**:
  - Tighten host allowlist to exact `www.rbz.co.zw` (drop the loose `.rbz.co.zw` suffix regex to avoid subdomain smuggling).
  - Enforce `pathname` starts with `/documents/Exchange_Rates/` and ends with `.pdf`.
  - Cap upstream response size (e.g. 10 MB) and enforce a 15 s fetch timeout via `AbortController`.
  - Validate upstream `Content-Type` is `application/pdf` before returning.
  - Add `X-Content-Type-Options: nosniff`, `Content-Disposition: inline`, and drop `Access-Control-Allow-Origin: *` in favour of an app-origin allowlist (still permissive for the MCP use case if needed).
- **`/api/public/rbz/scrape`**:
  - Validate `year`/`month` with Zod (year 2020–2100, month 1–12) instead of ad-hoc `parseInt`.
  - Add a per-IP in-memory rate limit (e.g. 30 req/min) to prevent using our worker as a probe amplifier.
  - Add the same 15 s abort + narrower CORS headers.
- **MCP tools** (`list-publications`, `get-latest-publication`): apply the same size/timeout limits on `fetch`, and reject any `on_or_before` outside a sane window.
- **Client-side**:
  - Add Zod validation at the boundary of `parseRbzPdf` output before writing to IndexedDB (defensive against malformed PDFs).
  - Sanitise the audit-log JSON viewer — currently renders via `JSON.stringify` which is safe, but confirm no `dangerouslySetInnerHTML` slipped in and add `rel="noopener noreferrer"` to every external link (PDF toast action already does this — audit the About page and settings page).
  - Add a strict `<meta http-equiv="Content-Security-Policy">` in `__root.tsx` head allowing only self, `www.rbz.co.zw` for images/objects, and inline styles (needed by Tailwind runtime). Document the trade-offs.
- **Docs**: update the About page + README PDF with a short "Security & data handling" section explaining that all data stays in the browser (IndexedDB), no telemetry, no auth, and what the proxy does.

## Technical notes

- No backend/database changes; no new dependencies required (Zod is already installed).
- Settings schema in `src/lib/syncSettings.ts` gains `watchedCurrencies`, `thresholdPct`, `browserNotifications`, `dailyDigest` fields with backwards-compatible defaults.
- Rate limiter for scrape route uses a module-scoped `Map<string, number[]>` — acceptable for a single-worker deployment; documented as best-effort.
- CSP will be added in report-only mode first (via meta) to avoid breaking the preview; can promote to enforced after one QA pass.

## Out of scope

- Real authentication / multi-user (app has no accounts).
- Server-side persistence of alerts (would require Lovable Cloud — not requested).
- Data-depth analytics like cross-rate calculator or drill-down pages (deferred).
