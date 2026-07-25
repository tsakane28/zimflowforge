import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, Plus, RotateCcw, Save, Settings as SettingsIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  DEFAULT_SETTINGS,
  type SyncSettings,
  type Window,
  loadSettings,
  resetSettings,
  saveSettings,
} from "@/lib/syncSettings";
import { requestBrowserNotificationPermission } from "@/lib/alerts";

const KNOWN_CURRENCIES = ["USD", "ZAR", "GBP", "EUR", "BWP", "CNY", "JPY", "AUD", "CAD", "CHF"];

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Sync Settings — ZW FX Workbench" },
      { name: "description", content: "Configure RBZ publication-check windows and notification timing." },
      { property: "og:title", content: "Sync Settings — ZW FX Workbench" },
      { property: "og:description", content: "Configure RBZ publication-check windows and notification timing." },
    ],
  }),
  component: SettingsPage,
});

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function SettingsPage() {
  const [s, setS] = useState<SyncSettings>(DEFAULT_SETTINGS);
  const [dirty, setDirty] = useState(false);

  useEffect(() => { setS(loadSettings()); }, []);

  const update = <K extends keyof SyncSettings>(key: K, value: SyncSettings[K]) => {
    setS((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const updateWindow = (i: number, patch: Partial<Window>) => {
    setS((prev) => ({
      ...prev,
      weekdayWindows: prev.weekdayWindows.map((w, idx) => (idx === i ? { ...w, ...patch } : w)),
    }));
    setDirty(true);
  };
  const removeWindow = (i: number) => {
    setS((prev) => ({ ...prev, weekdayWindows: prev.weekdayWindows.filter((_, idx) => idx !== i) }));
    setDirty(true);
  };
  const addWindow = () => {
    setS((prev) => ({
      ...prev,
      weekdayWindows: [...prev.weekdayWindows, { startHour: 8, endHour: 12, intervalMinutes: 15 }],
    }));
    setDirty(true);
  };

  const onSave = () => {
    // Basic validation
    for (const w of s.weekdayWindows) {
      if (w.endHour <= w.startHour) {
        toast.error("Each window's end hour must be after its start hour.");
        return;
      }
      if (w.intervalMinutes < 1) {
        toast.error("Interval must be at least 1 minute.");
        return;
      }
    }
    saveSettings(s);
    setDirty(false);
    toast.success("Sync settings saved. Rescheduling next check…");
  };

  const onReset = () => {
    resetSettings();
    setS(DEFAULT_SETTINGS);
    setDirty(false);
    toast.success("Settings reset to defaults.");
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <header className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-md bg-primary/15 text-primary flex items-center justify-center shrink-0">
          <SettingsIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight">Sync & Notification Settings</h1>
          <p className="text-xs text-muted-foreground">
            Configure when the app polls RBZ for new publications and how you get notified.
            RBZ typically publishes weekdays before noon; weekends are inactive by default.
          </p>
        </div>
      </header>

      {/* Weekday windows */}
      <section className="bg-card border border-border rounded-lg">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Weekday publication windows</h2>
            <p className="text-[11px] text-muted-foreground">
              Time ranges (local) checked in order. First match wins.
            </p>
          </div>
          <button
            onClick={addWindow}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
          >
            <Plus className="h-3.5 w-3.5" /> Add window
          </button>
        </div>
        <div className="p-4 space-y-3">
          {s.weekdayWindows.length === 0 && (
            <p className="text-xs text-muted-foreground">No windows — off-hours interval will apply all day.</p>
          )}
          {s.weekdayWindows.map((w, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-end">
              <Field label="Start" span={4}>
                <HourSelect value={w.startHour} onChange={(v) => updateWindow(i, { startHour: v })} />
              </Field>
              <Field label="End (excl.)" span={4}>
                <HourSelect value={w.endHour} onChange={(v) => updateWindow(i, { endHour: v })} />
              </Field>
              <Field label="Every (min)" span={3}>
                <NumberInput value={w.intervalMinutes} min={1} onChange={(v) => updateWindow(i, { intervalMinutes: v })} />
              </Field>
              <div className="col-span-1 flex justify-end">
                <button
                  onClick={() => removeWindow(i)}
                  className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40"
                  aria-label="Remove window"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}

          <div className="pt-3 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Weekday off-hours interval (min)">
              <NumberInput value={s.weekdayOffHoursMinutes} min={1} onChange={(v) => update("weekdayOffHoursMinutes", v)} />
            </Field>
            <Field label="After today's rate captured (min)">
              <NumberInput value={s.haveTargetMinutes} min={1} onChange={(v) => update("haveTargetMinutes", v)} />
            </Field>
          </div>
        </div>
      </section>

      {/* Weekend + errors */}
      <section className="bg-card border border-border rounded-lg">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">Weekend & error handling</h2>
          <p className="text-[11px] text-muted-foreground">RBZ does not publish on weekends — polling is off by default.</p>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={s.weekendEnabled}
              onChange={(e) => update("weekendEnabled", e.target.checked)}
              className="h-4 w-4"
            />
            Poll on weekends
          </label>
          <Field label="Weekend recheck interval (min)">
            <NumberInput
              value={s.weekendIdleMinutes}
              min={1}
              onChange={(v) => update("weekendIdleMinutes", v)}
              disabled={!s.weekendEnabled}
            />
          </Field>
          <Field label="After sync error, retry in (min)">
            <NumberInput value={s.errorMinutes} min={1} onChange={(v) => update("errorMinutes", v)} />
          </Field>
        </div>
      </section>

      {/* Notifications */}
      <section className="bg-card border border-border rounded-lg">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">Notifications</h2>
          <p className="text-[11px] text-muted-foreground">Toast alerts when a new RBZ PDF is picked up by background sync.</p>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={s.notifyOnNewPublication}
              onChange={(e) => update("notifyOnNewPublication", e.target.checked)}
              className="h-4 w-4"
            />
            Alert on new publications
          </label>
          <Field label="Toast duration (seconds)">
            <NumberInput
              value={s.notifyDurationSeconds}
              min={1}
              onChange={(v) => update("notifyDurationSeconds", v)}
              disabled={!s.notifyOnNewPublication}
            />
          </Field>
        </div>
      </section>

      {/* Alerts */}
      <section className="bg-card border border-border rounded-lg">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" />
          <div>
            <h2 className="text-sm font-semibold">Threshold alerts & digest</h2>
            <p className="text-[11px] text-muted-foreground">
              Watch specific currencies for material moves and get a once-a-day summary.
            </p>
          </div>
        </div>
        <div className="p-4 space-y-4">
          <Field label="Watched currencies (max 5)">
            <div className="flex flex-wrap gap-1.5">
              {KNOWN_CURRENCIES.map((c) => {
                const on = s.watchedCurrencies.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      const next = on
                        ? s.watchedCurrencies.filter((x) => x !== c)
                        : s.watchedCurrencies.length >= 5
                          ? s.watchedCurrencies
                          : [...s.watchedCurrencies, c];
                      update("watchedCurrencies", next);
                    }}
                    className={`px-2 py-1 rounded text-[11px] font-mono border transition-colors ${
                      on
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-border hover:text-foreground"
                    }`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Threshold (%)">
              <NumberInput
                value={s.thresholdPct}
                min={0}
                onChange={(v) => update("thresholdPct", v)}
              />
            </Field>
            <label className="flex items-end gap-2 text-xs pb-2">
              <input
                type="checkbox"
                checked={s.dailyDigest}
                onChange={(e) => update("dailyDigest", e.target.checked)}
                className="h-4 w-4"
              />
              <span>Daily digest (once per business day)</span>
            </label>
            <label className="flex items-end gap-2 text-xs pb-2">
              <input
                type="checkbox"
                checked={s.quietHours}
                onChange={(e) => update("quietHours", e.target.checked)}
                className="h-4 w-4"
              />
              <span>Quiet hours — suppress non-critical toasts outside windows</span>
            </label>
            <label className="flex items-end gap-2 text-xs pb-2">
              <input
                type="checkbox"
                checked={s.browserNotifications}
                onChange={async (e) => {
                  const on = e.target.checked;
                  if (on) {
                    const p = await requestBrowserNotificationPermission();
                    if (p !== "granted") {
                      toast.error("Browser notifications denied by the OS/browser.");
                      return;
                    }
                  }
                  update("browserNotifications", on);
                }}
                className="h-4 w-4"
              />
              <span>Also fire OS notifications when tab is backgrounded</span>
            </label>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Threshold compares the newest imported publication against the previous cached day for
            each watched currency. New-publication alerts always fire — quiet hours only mute
            threshold and digest toasts.
          </p>
        </div>
      </section>

      <div className="flex items-center justify-end gap-2 sticky bottom-0 py-3">
        <button
          onClick={onReset}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-muted"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Reset defaults
        </button>
        <button
          onClick={onSave}
          disabled={!dirty}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-2 text-xs font-medium hover:bg-primary/90 disabled:opacity-60"
        >
          <Save className="h-3.5 w-3.5" /> Save settings
        </button>
      </div>
    </div>
  );
}

function Field({ label, children, span }: { label: string; children: React.ReactNode; span?: number }) {
  return (
    <div className={span ? `col-span-${span}` : ""}>
      <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground mb-1">{label}</div>
      {children}
    </div>
  );
}

function HourSelect({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(parseInt(e.target.value, 10))}
      className="w-full h-9 rounded-md border border-border bg-background px-2 text-sm font-mono"
    >
      {HOURS.map((h) => (
        <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
      ))}
    </select>
  );
}

function NumberInput({
  value, onChange, min, disabled,
}: { value: number; onChange: (v: number) => void; min?: number; disabled?: boolean }) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      disabled={disabled}
      onChange={(e) => {
        const n = parseInt(e.target.value, 10);
        if (!Number.isNaN(n)) onChange(n);
      }}
      className="w-full h-9 rounded-md border border-border bg-background px-2 text-sm font-mono disabled:opacity-60"
    />
  );
}
