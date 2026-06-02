import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { RateRecord } from "@/lib/db";

interface Props {
  rates: RateRecord[];
  currency: string;
  color: string;
}

export function TrendChart({ rates, currency, color }: Props) {
  const data = useMemo(() => {
    return rates
      .filter((r) => r.currency === currency)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((r) => ({ date: r.date.slice(5), mid: r.mid }));
  }, [rates, currency]);

  return (
    <div className="h-44">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="2 2" vertical={false} />
          <XAxis dataKey="date" stroke="var(--color-muted-foreground)" tick={{ fontSize: 10, fontFamily: "var(--font-mono)" }} tickLine={false} axisLine={false} />
          <YAxis stroke="var(--color-muted-foreground)" tick={{ fontSize: 10, fontFamily: "var(--font-mono)" }} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
          <Tooltip
            contentStyle={{
              background: "var(--color-card)",
              border: "1px solid var(--color-border)",
              borderRadius: 6,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
            }}
            labelStyle={{ color: "var(--color-muted-foreground)" }}
          />
          <Line type="monotone" dataKey="mid" stroke={color} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
