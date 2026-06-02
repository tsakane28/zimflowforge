import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import Decimal from "decimal.js";
import { useFxStore } from "@/store/useFxStore";
import {
  calculateBankFees,
  calculateConversion,
  calculateEffectiveRate,
  calculateIMTT,
  calculateNetSettlement,
  fmtMoney,
  fmtRate,
  type FeeConfig,
  type RateType,
} from "@/lib/calculations";
import { addAudit } from "@/lib/db";
import { Download, FileText } from "lucide-react";
import { toast } from "sonner";
import { pdf } from "@react-pdf/renderer";
import { SettlementReport } from "@/components/SettlementReport";

export const Route = createFileRoute("/workbench")({
  head: () => ({
    meta: [
      { title: "Transaction Workbench — ZW FX Workbench" },
      { name: "description", content: "Multi-currency settlement calculator with IMTT, bank charges, and effective rate computation." },
    ],
  }),
  component: Workbench,
});

const CURRENCIES = ["USD", "GBP", "ZAR", "EUR", "BWP", "ZWG"];
const TXN_TYPES = ["Remittance", "Invoice Settlement", "Interbank Transfer", "Treasury Conversion"];

function Workbench() {
  const rates = useFxStore((s) => s.rates);
  const refreshAudit = useFxStore((s) => s.refreshAudit);

  const [txnType, setTxnType] = useState(TXN_TYPES[0]);
  const [source, setSource] = useState("USD");
  const [target, setTarget] = useState("ZWG");
  const [amount, setAmount] = useState("1000");
  const [rateType, setRateType] = useState<RateType>("Mid");
  const [notes, setNotes] = useState("");
  const [cfg, setCfg] = useState<FeeConfig>({
    applyImtt: true,
    imttRate: 2,
    applyBankFees: true,
    feeModel: "PercentageWithMin",
    flatFee: 5,
    percentFee: 1,
    minFee: 5,
  });

  const latestDate = useMemo(() => {
    const dates = Array.from(new Set(rates.map((r) => r.date))).sort();
    return dates[dates.length - 1] ?? "";
  }, [rates]);

  const rateUsed = useMemo(() => {
    if (source === target) return new Decimal(1);
    // Convert via ZWG. We need rate that maps source -> target.
    const findRow = (ccy: string) => rates.find((r) => r.date === latestDate && r.currency === ccy);
    const get = (ccy: string) => {
      const row = findRow(ccy);
      if (!row) return null;
      const v = rateType === "Mid" ? row.mid : rateType === "Bid" ? row.bid : row.ask;
      return new Decimal(v);
    };
    if (source === "ZWG") {
      const t = get(target);
      return t ? new Decimal(1).div(t) : new Decimal(0);
    }
    if (target === "ZWG") {
      return get(source) ?? new Decimal(0);
    }
    const s = get(source);
    const t = get(target);
    if (!s || !t || t.eq(0)) return new Decimal(0);
    return s.div(t);
  }, [rates, latestDate, source, target, rateType]);

  const gross = new Decimal(amount || 0);
  const converted = calculateConversion(amount, rateUsed.toString());
  const bankFees = calculateBankFees(converted, cfg);
  const imtt = calculateIMTT(converted, cfg.imttRate, cfg.applyImtt);
  const totalDeductions = bankFees.plus(imtt);
  const net = calculateNetSettlement(converted, bankFees, imtt);
  const effectiveRate = calculateEffectiveRate(gross, net);

  const exportPdf = async () => {
    const ref = `TRZ-${Date.now().toString(36).toUpperCase()}`;
    const doc = (
      <SettlementReport
        reference={ref}
        timestamp={new Date().toISOString()}
        txnType={txnType}
        source={source}
        target={target}
        gross={gross.toString()}
        rateUsed={rateUsed.toString()}
        converted={converted.toString()}
        bankFees={bankFees.toString()}
        imtt={imtt.toString()}
        net={net.toString()}
        effectiveRate={effectiveRate.toString()}
        publicationDate={latestDate}
        notes={notes}
        rateType={rateType}
      />
    );
    const blob = await pdf(doc).toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${ref}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    await addAudit({
      ts: new Date().toISOString(),
      action: "Workflow Summary Exported",
      event: `Generated treasury settlement confirmation ${ref}`,
      status: "success",
      payload: {
        reference: ref, txnType, source, target,
        gross: gross.toString(), net: net.toString(),
        effectiveRate: effectiveRate.toString(),
      },
    });
    await refreshAudit();
    toast.success("Workflow summary exported", { description: ref });
  };

  return (
    <div className="p-6 max-w-[1600px]">
      <div className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight">Transaction Workbench</h1>
        <p className="text-xs text-muted-foreground">
          Compute net settlement with live RBZ rates, bank charges, and IMTT.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* LEFT */}
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-4">
            Transaction Inputs
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Transaction Type" full>
              <Select value={txnType} onChange={setTxnType} options={TXN_TYPES} />
            </Field>

            <Field label="Source Currency">
              <Select value={source} onChange={setSource} options={CURRENCIES} />
            </Field>
            <Field label="Target Currency">
              <Select value={target} onChange={setTarget} options={CURRENCIES} />
            </Field>

            <Field label="Amount" full>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full font-mono bg-surface border border-input rounded-md px-3 py-2 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="0.00"
              />
            </Field>

            <Field label="Rate Type" full>
              <div className="flex gap-1 rounded-md bg-muted p-1">
                {(["Mid", "Bid", "Ask"] as RateType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setRateType(t)}
                    className={`flex-1 py-1.5 text-xs rounded ${rateType === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </Field>

            <Toggle
              label="Apply IMTT"
              hint={`${cfg.imttRate}% intermediated money transfer tax`}
              value={cfg.applyImtt}
              onChange={(v) => setCfg({ ...cfg, applyImtt: v })}
            />
            <Toggle
              label="Apply Bank Charges"
              hint="Includes flat or percentage fee"
              value={cfg.applyBankFees}
              onChange={(v) => setCfg({ ...cfg, applyBankFees: v })}
            />

            <Field label="Bank Fee Model" full>
              <Select
                value={cfg.feeModel}
                onChange={(v) => setCfg({ ...cfg, feeModel: v as FeeConfig["feeModel"] })}
                options={["Flat", "Percentage", "PercentageWithMin"]}
                labels={{
                  Flat: "Flat Fee",
                  Percentage: "Percentage Fee",
                  PercentageWithMin: "Percentage with Min Threshold",
                }}
              />
            </Field>

            {cfg.feeModel === "Flat" && (
              <Field label="Flat Fee" full>
                <NumberInput value={cfg.flatFee} onChange={(v) => setCfg({ ...cfg, flatFee: v })} prefix="$" />
              </Field>
            )}
            {cfg.feeModel === "Percentage" && (
              <Field label="Percentage" full>
                <NumberInput value={cfg.percentFee} onChange={(v) => setCfg({ ...cfg, percentFee: v })} suffix="%" />
              </Field>
            )}
            {cfg.feeModel === "PercentageWithMin" && (
              <>
                <Field label="Percentage">
                  <NumberInput value={cfg.percentFee} onChange={(v) => setCfg({ ...cfg, percentFee: v })} suffix="%" />
                </Field>
                <Field label="Min Threshold">
                  <NumberInput value={cfg.minFee} onChange={(v) => setCfg({ ...cfg, minFee: v })} prefix="$" />
                </Field>
              </>
            )}

            <Field label="IMTT Rate" full>
              <NumberInput value={cfg.imttRate} onChange={(v) => setCfg({ ...cfg, imttRate: v })} suffix="%" />
            </Field>

            <Field label="Reference Notes" full>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Optional payment reference, invoice #, beneficiary…"
                className="w-full bg-surface border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </Field>
          </div>
        </div>

        {/* RIGHT */}
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-lg p-5">
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-4 flex items-center justify-between">
              <span>Settlement Ledger</span>
              <span className="font-mono">Pub. {latestDate || "—"}</span>
            </div>
            <LedgerRow label="Gross Amount" value={fmtMoney(gross, source)} />
            <LedgerRow label={`Exchange Rate (${rateType})`} value={`${source}/${target}  ${fmtRate(rateUsed)}`} />
            <LedgerRow label="Converted Amount" value={fmtMoney(converted, target)} />
            <LedgerRow label={`Bank Charges${cfg.applyBankFees ? "" : " (off)"}`} value={`− ${fmtMoney(bankFees, target)}`} negative={bankFees.gt(0)} />
            <LedgerRow label={`IMTT${cfg.applyImtt ? ` (${cfg.imttRate}%)` : " (off)"}`} value={`− ${fmtMoney(imtt, target)}`} negative={imtt.gt(0)} />
            <LedgerRow label="Total Deductions" value={`− ${fmtMoney(totalDeductions, target)}`} negative={totalDeductions.gt(0)} bold />
            <LedgerRow label="Effective Exchange Rate" value={fmtRate(effectiveRate)} bold />
          </div>

          <div className="bg-navy text-navy-foreground rounded-lg p-6 border border-navy">
            <div className="text-[10px] uppercase tracking-[0.22em] text-navy-foreground/60 mb-2">
              Net Receiver Settlement Amount
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-navy-foreground/60">
                {target}
              </span>
              <span className="font-mono text-5xl font-semibold tracking-tight">
                {fmtMoney(net)}
              </span>
            </div>
            <div className="text-xs text-navy-foreground/60 mt-3 font-mono">
              {txnType} • Gross {fmtMoney(gross, source)} • Effective {fmtRate(effectiveRate)}
            </div>
          </div>

          <button
            onClick={exportPdf}
            className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-accent text-accent-foreground px-4 py-3 text-sm font-medium hover:opacity-90"
          >
            <FileText className="h-4 w-4" />
            Export Workflow Summary
            <Download className="h-4 w-4 ml-1" />
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={full ? "col-span-2" : "col-span-1"}>
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1.5">{label}</div>
      {children}
    </div>
  );
}

function Select({ value, onChange, options, labels }: { value: string; onChange: (v: string) => void; options: string[]; labels?: Record<string, string> }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-surface border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
    >
      {options.map((o) => <option key={o} value={o}>{labels?.[o] ?? o}</option>)}
    </select>
  );
}

function NumberInput({ value, onChange, prefix, suffix }: { value: number; onChange: (v: number) => void; prefix?: string; suffix?: string }) {
  return (
    <div className="flex items-center bg-surface border border-input rounded-md px-3 focus-within:ring-2 focus-within:ring-ring">
      {prefix && <span className="text-xs font-mono text-muted-foreground mr-1">{prefix}</span>}
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="flex-1 bg-transparent py-2 font-mono text-sm focus:outline-none"
      />
      {suffix && <span className="text-xs font-mono text-muted-foreground ml-1">{suffix}</span>}
    </div>
  );
}

function Toggle({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="col-span-1 flex items-start justify-between gap-3 bg-muted/40 border border-border rounded-md px-3 py-2">
      <div className="min-w-0">
        <div className="text-xs font-medium">{label}</div>
        {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`shrink-0 relative w-9 h-5 rounded-full transition ${value ? "bg-success" : "bg-border"}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${value ? "left-4" : "left-0.5"}`} />
      </button>
    </div>
  );
}

function LedgerRow({ label, value, negative, bold }: { label: string; value: string; negative?: boolean; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-2 border-b border-border last:border-0 text-sm ${bold ? "font-semibold" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono ${negative ? "text-destructive" : "text-foreground"}`}>{value}</span>
    </div>
  );
}
