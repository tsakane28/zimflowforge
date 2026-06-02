import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useFxStore } from "@/store/useFxStore";
import { ChevronDown, ChevronRight, Download, Search } from "lucide-react";

export const Route = createFileRoute("/data-integrity")({
  head: () => ({
    meta: [
      { title: "Data Integrity Center — ZW FX Workbench" },
      { name: "description", content: "Historical rate persistence, audit log, and raw payload inspection for the FX workbench." },
    ],
  }),
  component: DataIntegrity,
});

function DataIntegrity() {
  const rates = useFxStore((s) => s.rates);
  const audit = useFxStore((s) => s.audit);

  const [q, setQ] = useState("");
  const [ccyFilter, setCcyFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState<"date" | "currency">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const currencies = useMemo(() => Array.from(new Set(rates.map((r) => r.currency))).sort(), [rates]);

  const filteredRates = useMemo(() => {
    let list = rates.filter((r) => {
      if (ccyFilter !== "ALL" && r.currency !== ccyFilter) return false;
      if (q) {
        const s = `${r.date} ${r.currency} ${r.source}`.toLowerCase();
        if (!s.includes(q.toLowerCase())) return false;
      }
      return true;
    });
    list = [...list].sort((a, b) => {
      const av = a[sortBy] as string;
      const bv = b[sortBy] as string;
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    return list;
  }, [rates, q, ccyFilter, sortBy, sortDir]);

  const exportCsv = () => {
    const headers = ["Date", "Currency", "Bid", "Ask", "Mid", "Source", "ImportMethod", "Status"];
    const rows = filteredRates.map((r) => [r.date, r.currency, r.bid, r.ask, r.mid, r.source, r.importMethod, r.status].join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fx-history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleSort = (col: "date" | "currency") => {
    if (sortBy === col) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("asc"); }
  };

  return (
    <div className="p-6 max-w-[1600px] space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Data Integrity Center</h1>
        <p className="text-xs text-muted-foreground">
          Persisted RBZ rate history, audit trail, and raw payload inspection.
        </p>
      </div>

      {/* HISTORY */}
      <section className="bg-card border border-border rounded-lg">
        <div className="px-5 py-3 border-b border-border flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Historical Rate Records</div>
            <div className="text-sm font-semibold">{filteredRates.length} records</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search…"
                className="pl-7 pr-3 py-1.5 text-xs bg-surface border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <select
              value={ccyFilter}
              onChange={(e) => setCcyFilter(e.target.value)}
              className="px-2 py-1.5 text-xs bg-surface border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="ALL">All currencies</option>
              {currencies.map((c) => <option key={c}>{c}</option>)}
            </select>
            <button onClick={exportCsv} className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium hover:bg-primary/90">
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
          </div>
        </div>

        <div className="overflow-auto max-h-[420px]">
          <table className="w-full text-xs">
            <thead className="bg-muted/60 text-muted-foreground uppercase tracking-wider text-[10px] sticky top-0">
              <tr>
                <Th onClick={() => toggleSort("date")} active={sortBy === "date"} dir={sortDir}>Date</Th>
                <Th onClick={() => toggleSort("currency")} active={sortBy === "currency"} dir={sortDir}>Currency</Th>
                <Th align="right">Bid</Th>
                <Th align="right">Ask</Th>
                <Th align="right">Mid</Th>
                <Th>Source</Th>
                <Th>Method</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {filteredRates.map((r, i) => (
                <tr key={i} className="border-t border-border hover:bg-muted/30">
                  <td className="px-3 py-2 font-mono">{r.date}</td>
                  <td className="px-3 py-2 font-semibold">{r.currency}</td>
                  <td className="px-3 py-2 font-mono text-right">{r.bid.toFixed(4)}</td>
                  <td className="px-3 py-2 font-mono text-right">{r.ask.toFixed(4)}</td>
                  <td className="px-3 py-2 font-mono text-right">{r.mid.toFixed(4)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.source}</td>
                  <td className="px-3 py-2 text-muted-foreground uppercase text-[10px]">{r.importMethod}</td>
                  <td className="px-3 py-2">
                    <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-success/15 text-success border border-success/30">
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredRates.length === 0 && (
                <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">No records match the filter</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* AUDIT */}
      <section className="bg-card border border-border rounded-lg">
        <div className="px-5 py-3 border-b border-border">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Audit &amp; Compliance Log</div>
          <div className="text-sm font-semibold">{audit.length} events</div>
        </div>
        <div className="divide-y divide-border max-h-[420px] overflow-auto">
          {audit.map((a) => <AuditRow key={a.id} entry={a} />)}
          {audit.length === 0 && (
            <div className="text-center py-8 text-xs text-muted-foreground">No audit events recorded yet.</div>
          )}
        </div>
      </section>
    </div>
  );
}

function Th({ children, align, onClick, active, dir }: { children: React.ReactNode; align?: "right"; onClick?: () => void; active?: boolean; dir?: "asc" | "desc" }) {
  return (
    <th
      onClick={onClick}
      className={`px-3 py-2 font-medium ${align === "right" ? "text-right" : "text-left"} ${onClick ? "cursor-pointer select-none hover:text-foreground" : ""} ${active ? "text-foreground" : ""}`}
    >
      {children}{active && (dir === "asc" ? " ↑" : " ↓")}
    </th>
  );
}

function AuditRow({ entry }: { entry: import("@/lib/db").AuditEntry }) {
  const [open, setOpen] = useState(false);
  const tone = {
    success: "text-success bg-success/10 border-success/30",
    info: "text-info bg-info/10 border-info/30",
    warning: "text-warning bg-warning/10 border-warning/30",
    error: "text-destructive bg-destructive/10 border-destructive/30",
  }[entry.status];
  return (
    <div className="px-5 py-3">
      <button onClick={() => setOpen(!open)} className="w-full flex items-start gap-3 text-left">
        {open ? <ChevronDown className="h-4 w-4 mt-0.5 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 mt-0.5 text-muted-foreground" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border uppercase ${tone}`}>{entry.status}</span>
            <span className="text-sm font-semibold">{entry.action}</span>
            <span className="text-[10px] font-mono text-muted-foreground ml-auto">
              {new Date(entry.ts).toLocaleString()}
            </span>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">{entry.event}</div>
        </div>
      </button>
      {open && entry.payload != null && (
        <pre className="mt-3 ml-7 p-3 bg-muted text-[11px] font-mono text-foreground rounded border border-border overflow-auto max-h-64">
{JSON.stringify(entry.payload, null, 2)}
        </pre>
      )}
    </div>
  );
}
