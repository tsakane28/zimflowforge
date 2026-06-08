import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Download, FileText, Info, Loader2 } from "lucide-react";
import { pdf } from "@react-pdf/renderer";
import { toast } from "sonner";
import {
  DOC_SECTIONS,
  PROJECT_TAGLINE,
  PROJECT_TITLE,
  PROJECT_VERSION,
} from "@/lib/projectDocs";
import { ProjectReadmePdf } from "@/components/ProjectReadmePdf";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About & Documentation — ZW FX Workbench" },
      {
        name: "description",
        content:
          "Technology stack, architecture, and operational notes for the Zimbabwe FX Operations Workbench. Download the full README as PDF.",
      },
      { property: "og:title", content: "About & Documentation — ZW FX Workbench" },
      {
        property: "og:description",
        content: "How the Zimbabwe FX Operations Workbench was built — full technology stack and architecture notes.",
      },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    try {
      setDownloading(true);
      const blob = await pdf(<ProjectReadmePdf />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "ZW-FX-Workbench-README.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("README downloaded");
    } catch (e) {
      toast.error("Could not generate PDF", { description: String((e as Error).message) });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 lg:py-10 max-w-5xl mx-auto">
      <header className="border-b border-border pb-6 mb-8">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          <Info className="h-3 w-3" />
          Project Documentation
        </div>
        <h1 className="text-2xl sm:text-3xl font-semibold mt-2 text-foreground">{PROJECT_TITLE}</h1>
        <p className="mt-2 text-sm sm:text-base text-muted-foreground max-w-3xl">{PROJECT_TAGLINE}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
            v{PROJECT_VERSION}
          </span>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {downloading ? "Generating PDF…" : "Download README (PDF)"}
          </button>
          <a
            href="#stack"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            <FileText className="h-4 w-4" />
            Jump to tech stack
          </a>
        </div>
      </header>

      {/* Table of contents */}
      <nav className="mb-10 rounded-lg border border-border bg-surface/40 p-4">
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">
          Table of Contents
        </div>
        <ol className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
          {DOC_SECTIONS.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="text-foreground hover:text-primary transition-colors">
                {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <article className="space-y-10">
        {DOC_SECTIONS.map((s) => (
          <section key={s.id} id={s.id} className="scroll-mt-20">
            <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-3">{s.title}</h2>
            <div className="space-y-3 text-sm sm:text-[15px] leading-relaxed text-muted-foreground">
              {s.body.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
            {s.bullets && s.bullets.length > 0 && (
              <ul className="mt-4 space-y-2 text-sm sm:text-[15px]">
                {s.bullets.map((b, i) => (
                  <li key={i} className="flex gap-3 text-foreground/90">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </article>

      <footer className="mt-16 border-t border-border pt-6 text-xs text-muted-foreground">
        Documentation generated from <code className="font-mono">src/lib/projectDocs.ts</code> — the
        PDF and this page share the same source of truth.
      </footer>
    </div>
  );
}
