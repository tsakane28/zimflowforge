import { useCallback, useState } from "react";
import { Upload, FileCheck2, Loader2 } from "lucide-react";
import { useFxStore } from "@/store/useFxStore";
import { toast } from "sonner";

export function PdfDropzone() {
  const importPdf = useFxStore((s) => s.importPdf);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<string | null>(null);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || !files[0]) return;
    const f = files[0];
    if (!f.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Only PDF files are accepted");
      return;
    }
    setBusy(true);
    try {
      const res = await importPdf(f);
      if (res.count === 0) {
        toast.warning("No currency rows recognized", {
          description: "The PDF was parsed but the expected RBZ layout was not detected.",
        });
      } else {
        toast.success(`${res.count} currencies imported`, { description: `Publication date: ${res.date}` });
        setLast(`${f.name} • ${res.count} rows • ${res.date}`);
      }
    } catch {
      toast.error("Failed to parse PDF");
    } finally {
      setBusy(false);
    }
  }, [importPdf]);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
      className={`relative rounded-lg border-2 border-dashed p-6 transition-colors ${
        dragging ? "border-accent bg-accent/5" : "border-border bg-muted/40"
      }`}
    >
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-md bg-primary text-primary-foreground flex items-center justify-center">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-foreground">
            Drag &amp; Drop RBZ Daily Exchange Rate PDF
          </div>
          <div className="text-xs text-muted-foreground">
            Parses publication date and extracts USD, GBP, ZAR, EUR, BWP rate rows.
          </div>
          {last && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-success font-mono">
              <FileCheck2 className="h-3.5 w-3.5" />
              {last}
            </div>
          )}
        </div>
        <label className="cursor-pointer rounded-md border border-border bg-surface px-3 py-2 text-xs font-medium hover:bg-muted">
          Browse file
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </label>
      </div>
    </div>
  );
}
