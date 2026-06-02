import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

interface Props {
  pair: string;
  bid: number;
  ask: number;
  mid: number;
  previousMid?: number;
  asOf: string;
}

export function RateCard({ pair, bid, ask, mid, previousMid, asOf }: Props) {
  const delta = previousMid ? ((mid - previousMid) / previousMid) * 100 : 0;
  const dir = delta > 0.0001 ? "up" : delta < -0.0001 ? "down" : "flat";
  const Icon = dir === "up" ? ArrowUpRight : dir === "down" ? ArrowDownRight : Minus;
  const tone =
    dir === "up"
      ? "text-success bg-success/10 border-success/30"
      : dir === "down"
        ? "text-destructive bg-destructive/10 border-destructive/30"
        : "text-muted-foreground bg-muted border-border";

  return (
    <div className="bg-card border border-border rounded-lg p-5 flex flex-col gap-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Currency Pair</div>
          <div className="text-lg font-semibold tracking-tight">{pair}</div>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono border",
            tone,
          )}
        >
          <Icon className="h-3 w-3" />
          {delta >= 0 ? "+" : ""}
          {delta.toFixed(2)}%
        </span>
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Mid Rate</div>
        <div className="font-mono text-4xl font-semibold text-foreground leading-none mt-1">
          {mid.toFixed(4)}
        </div>
        {previousMid != null && (
          <div className="text-[11px] font-mono text-muted-foreground mt-1">
            Prev <span className="text-foreground">{previousMid.toFixed(4)}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 pt-3 border-t border-border">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Bid</div>
          <div className="font-mono text-base text-foreground">{bid.toFixed(4)}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Ask</div>
          <div className="font-mono text-base text-foreground">{ask.toFixed(4)}</div>
        </div>
      </div>

      <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground">
        Pub. {asOf}
      </div>
    </div>
  );
}
