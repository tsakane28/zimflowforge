import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

/**
 * GET /api/public/rbz/pdf?url=<rbz pdf url>
 * Streams the requested RBZ exchange-rate PDF back to the browser so the
 * client-side pdf.js parser can read it without CORS issues.
 * Only allows hostnames ending in rbz.co.zw.
 */
export const Route = createFileRoute("/api/public/rbz/pdf")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        try {
          const u = new URL(request.url).searchParams.get("url");
          if (!u) return text("Missing url", 400);
          let target: URL;
          try { target = new URL(u); } catch { return text("Bad url", 400); }
          if (!/(^|\.)rbz\.co\.zw$/i.test(target.hostname)) {
            return text("Host not allowed", 400);
          }
          const r = await fetch(target.toString(), {
            headers: { "User-Agent": "Mozilla/5.0 ZW-FX-Workbench/1.0" },
          });
          if (!r.ok) return text(`Upstream ${r.status}`, 502);
          const buf = await r.arrayBuffer();
          return new Response(buf, {
            status: 200,
            headers: {
              "Content-Type": "application/pdf",
              "Cache-Control": "public, max-age=300",
              ...CORS,
            },
          });
        } catch (e) {
          return text(String((e as Error)?.message ?? e), 502);
        }
      },
    },
  },
});

function text(b: string, status = 200) {
  return new Response(b, { status, headers: { "Content-Type": "text/plain", ...CORS } });
}
