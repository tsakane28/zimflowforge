import { useFxStore } from "@/store/useFxStore";
import { Loader2, RefreshCw } from "lucide-react";

export function SyncControls() {
  const status = useFxStore((s) => s.syncStatus);
  const msg = useFxStore((s) => s.syncMessage);
  const runSync = useFxStore((s) => s.runSync);

  const badge = (() => {
    switch (status) {
      case "connected": return { label: "Connected", cls: "bg-success/15 text-success border-success/30" };
      case "syncing":   return { label: "Syncing",   cls: "bg-warning/15 text-warning border-warning/40" };
      case "cached":    return { label: "Cached Data", cls: "bg-info/15 text-info border-info/30" };
      case "manual":    return { label: "Manual Import Required", cls: "bg-destructive/15 text-destructive border-destructive/30" };
      default:          return { label: "Idle",      cls: "bg-muted text-muted-foreground border-border" };
    }
  })();

  return (
    <div className="flex items-center justify-between gap-3 bg-card border border-border rounded-lg px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-mono border ${badge.cls}`}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {badge.label}
        </span>
        <span className="text-xs font-mono text-muted-foreground truncate">{msg}</span>
      </div>
      <button
        onClick={() => runSync()}
        disabled={status === "syncing"}
        className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-2 text-xs font-medium hover:bg-primary/90 disabled:opacity-60"
      >
        {status === "syncing" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        Sync Latest Rates
      </button>
    </div>
  );
}
