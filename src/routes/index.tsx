import { createFileRoute } from "@tanstack/react-router";
import { useFxStore } from "@/store/useFxStore";
import { useMemo } from "react";
import { RateCard } from "@/components/RateCard";
import { PdfDropzone } from "@/components/PdfDropzone";
import { SyncControls } from "@/components/SyncControls";
import { TrendChart } from "@/components/TrendChart";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Treasury Dashboard — ZW FX Workbench" },
      { name: "description", content: "Live RBZ exchange-rate intelligence with sync controls, PDF parsing, and FX trend analytics." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const rates = useFxStore((s) => s.rates);
  const targetDate = useFxStore((s) => s.targetDate);
  const fellBack = useFxStore((s) => s.fellBack);

  const { today, yday, latestDate, displayDate, isExact } = useMemo(() => {
    const dates = Array.from(new Set(rates.map((r) => r.date))).sort();
    const latest = dates[dates.length - 1] ?? "";
    // Prefer the target (today / Friday-fallback) date; otherwise show latest cached.
    const display = dates.includes(targetDate) ? targetDate : latest;
    const prevDate = dates[dates.indexOf(display) - 1] ?? "";
    return {
      today: rates.filter((r) => r.date === display),
      yday: rates.filter((r) => r.date === prevDate),
      latestDate: latest,
      displayDate: display,
      isExact: display === targetDate,
    };
  }, [rates, targetDate]);


  const pickPrev = (ccy: string) => yday.find((r) => r.currency === ccy)?.mid;

  const trendPairs = [
    { ccy: "USD", color: "var(--color-accent)" },
    { ccy: "GBP", color: "oklch(0.55 0.16 150)" },
    { ccy: "ZAR", color: "oklch(0.72 0.16 75)" },
  ];

  // Analytics
  const stats = (ccy: string) => {
    const series = rates.filter((r) => r.currency === ccy).sort((a, b) => a.date.localeCompare(b.date));
    if (series.length < 2) return null;
    const last = series[series.length - 1].mid;
    const prev = series[series.length - 2].mid;
    const weekAgo = series[Math.max(0, series.length - 8)].mid;
    const high = Math.max(...series.map((s) => s.mid));
    const low = Math.min(...series.map((s) => s.mid));
    const avg = series.reduce((a, s) => a + s.mid, 0) / series.length;
    return {
      daily: ((last - prev) / prev) * 100,
      weekly: ((last - weekAgo) / weekAgo) * 100,
      high, low, avg,
    };
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px]">
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Rate Intelligence</h1>
            <p className="text-xs text-muted-foreground">
              RBZ daily exchange-rate publication ingestion &amp; treasury dashboards.
            </p>
          </div>
          <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
            Publication&nbsp;<span className="text-foreground">{latestDate || "—"}</span>
          </div>
        </div>
        <SyncControls />
        <PdfDropzone />
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-2">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Currency Pairs — Latest Publication
          </div>
          <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground">
            {today.length} pairs
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {today
            .slice()
            .sort((a, b) => a.currency.localeCompare(b.currency))
            .map((r) => (
              <RateCard
                key={r.currency}
                pair={`${r.currency}/ZWG`}
                bid={r.bid}
                ask={r.ask}
                mid={r.mid}
                previousMid={pickPrev(r.currency)}
                asOf={r.date}
              />
            ))}
        </div>
      </section>

      <section>
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">FX Trend Analytics — 14d</div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {trendPairs.map((p) => {
            const s = stats(p.ccy);
            return (
              <div key={p.ccy} className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-baseline justify-between mb-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{p.ccy}/ZWG Trend</div>
                    <div className="text-sm font-semibold">Mid-rate movement</div>
                  </div>
                  {s && (
                    <div className={`text-xs font-mono ${s.daily >= 0 ? "text-success" : "text-destructive"}`}>
                      {s.daily >= 0 ? "+" : ""}{s.daily.toFixed(2)}%
                    </div>
                  )}
                </div>
                <TrendChart rates={rates} currency={p.ccy} color={p.color} />
                {s && (
                  <div className="grid grid-cols-4 gap-2 pt-3 mt-3 border-t border-border text-center">
                    <Stat label="Daily" value={`${s.daily >= 0 ? "+" : ""}${s.daily.toFixed(2)}%`} />
                    <Stat label="Weekly" value={`${s.weekly >= 0 ? "+" : ""}${s.weekly.toFixed(2)}%`} />
                    <Stat label="High" value={s.high.toFixed(4)} />
                    <Stat label="Low" value={s.low.toFixed(4)} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="font-mono text-xs text-foreground">{value}</div>
    </div>
  );
}
