import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "X-Content-Type-Options": "nosniff",
} as const;

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const TIMEOUT_MS = 15_000;

const isAllowedTarget = (u: URL) => {
  if (u.protocol !== "https:") return false;
  if (u.hostname.toLowerCase() !== "www.rbz.co.zw") return false;
  if (!u.pathname.startsWith("/documents/Exchange_Rates/")) return false;
  if (!u.pathname.toLowerCase().endsWith(".pdf")) return false;
  return true;
};

/**
 * GET /api/public/rbz/pdf?url=<rbz pdf url>
 * Streams the requested RBZ exchange-rate PDF back to the browser so the
 * client-side pdf.js parser can read it without CORS issues.
 *
 * Security controls:
 *  - Strict URL allowlist (host = www.rbz.co.zw, path prefix + .pdf suffix)
 *  - AbortController timeout (15 s)
 *  - Response size cap (10 MB) to prevent proxy abuse
 *  - Content-Type validation (must be application/pdf)
 *  - nosniff + inline Content-Disposition on the returned response
 */
export const Route = createFileRoute("/api/public/rbz/pdf")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        const u = new URL(request.url).searchParams.get("url");
        if (!u) return text("Missing url", 400);
        let target: URL;
        try { target = new URL(u); } catch { return text("Bad url", 400); }
        if (!isAllowedTarget(target)) return text("URL not allowed", 400);

        const ac = new AbortController();
        const to = setTimeout(() => ac.abort(), TIMEOUT_MS);
        try {
          const r = await fetch(target.toString(), {
            headers: { "User-Agent": "Mozilla/5.0 ZW-FX-Workbench/1.0" },
            signal: ac.signal,
          });
          if (!r.ok) return text(`Upstream ${r.status}`, 502);

          const ct = r.headers.get("content-type") || "";
          if (!/application\/pdf/i.test(ct)) return text("Upstream not a PDF", 502);

          const cl = parseInt(r.headers.get("content-length") || "0", 10);
          if (cl && cl > MAX_BYTES) return text("Upstream too large", 502);

          const buf = await r.arrayBuffer();
          if (buf.byteLength > MAX_BYTES) return text("Upstream too large", 502);

          return new Response(buf, {
            status: 200,
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition": "inline",
              "Cache-Control": "public, max-age=300",
              ...CORS,
            },
          });
        } catch (e) {
          const msg = (e as Error)?.name === "AbortError" ? "Upstream timeout" : "Upstream error";
          return text(msg, 502);
        } finally {
          clearTimeout(to);
        }
      },
    },
  },
});

function text(b: string, status = 200) {
  return new Response(b, { status, headers: { "Content-Type": "text/plain", ...CORS } });
}
