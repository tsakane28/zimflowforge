// Alerting helpers: threshold detection, browser notifications, daily-digest state.
// All state is client-side (localStorage / IndexedDB audit); no server dependency.

import { toast } from "sonner";
import { addAudit, type RateRecord } from "@/lib/db";
import { isInsideActiveWindow, loadSettings, type SyncSettings } from "@/lib/syncSettings";

const DIGEST_KEY = "fx.lastDigestDate.v1";

export const getLastDigestDate = (): string | null => {
  if (typeof window === "undefined") return null;
  try { return window.localStorage.getItem(DIGEST_KEY); } catch { return null; }
};

export const setLastDigestDate = (iso: string) => {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(DIGEST_KEY, iso); } catch { /* ignore */ }
};

export const requestBrowserNotificationPermission = async (): Promise<NotificationPermission> => {
  if (typeof window === "undefined" || !("Notification" in window)) return "denied";
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Notification.permission;
  }
  try { return await Notification.requestPermission(); } catch { return "denied"; }
};

/** Fire an OS notification when the tab is hidden and the user opted in. */
export const fireBrowserNotification = (title: string, body: string, url?: string) => {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  if (document.visibilityState === "visible") return; // toast is enough when visible
  try {
    const n = new Notification(title, { body, tag: "fx-workbench" });
    if (url) {
      n.onclick = () => {
        window.focus();
        window.open(url, "_blank", "noopener,noreferrer");
        n.close();
      };
    }
  } catch { /* ignore quota / denied */ }
};

export interface Mover {
  currency: string;
  from: number;
  to: number;
  deltaPct: number;
  fromDate: string;
  toDate: string;
}

/** Compute movers for the watched currencies between latest and previous-cached dates. */
export const computeMovers = (rates: RateRecord[], s: SyncSettings): Mover[] => {
  const dates = Array.from(new Set(rates.map((r) => r.date))).sort();
  if (dates.length < 2) return [];
  const latest = dates[dates.length - 1];
  const prev = dates[dates.length - 2];
  const out: Mover[] = [];
  for (const ccy of s.watchedCurrencies) {
    const a = rates.find((r) => r.date === prev && r.currency === ccy);
    const b = rates.find((r) => r.date === latest && r.currency === ccy);
    if (!a || !b || a.mid <= 0) continue;
    const deltaPct = ((b.mid - a.mid) / a.mid) * 100;
    out.push({ currency: ccy, from: a.mid, to: b.mid, deltaPct, fromDate: prev, toDate: latest });
  }
  return out;
};

const isBusinessDay = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`);
  const w = d.getDay();
  return w !== 0 && w !== 6;
};

/**
 * Fire threshold + digest alerts after a sync. Idempotent per business day for the digest.
 * Non-critical alerts respect quiet hours; publication alerts remain in the caller.
 */
export const fireAlerts = async (opts: {
  rates: RateRecord[];
  targetIso: string;
  newPubCount: number;
  haveTarget: boolean;
}) => {
  const s = loadSettings();
  const quiet = s.quietHours && !isInsideActiveWindow(s);

  // Threshold alerts — always evaluate; audit-logged, toast-suppressed in quiet hours.
  const movers = computeMovers(opts.rates, s).filter(
    (m) => Math.abs(m.deltaPct) >= s.thresholdPct,
  );
  for (const m of movers) {
    const sign = m.deltaPct >= 0 ? "▲" : "▼";
    const title = `${m.currency}/ZWG ${sign} ${m.deltaPct.toFixed(2)}%`;
    const body = `${m.from.toFixed(4)} → ${m.to.toFixed(4)} (${m.fromDate} → ${m.toDate})`;
    await addAudit({
      ts: new Date().toISOString(),
      action: "Alert Fired",
      event: `Threshold breach: ${title}`,
      status: m.deltaPct >= 0 ? "success" : "warning",
      payload: m,
    });
    if (!quiet) {
      toast(title, { description: body, duration: Math.max(1, s.notifyDurationSeconds) * 1000 });
    }
    if (s.browserNotifications) fireBrowserNotification(title, body);
  }

  // Daily digest — once per business day, only when we have the target rate.
  if (
    s.dailyDigest &&
    opts.haveTarget &&
    isBusinessDay(opts.targetIso) &&
    getLastDigestDate() !== opts.targetIso
  ) {
    const rowCount = opts.rates.filter((r) => r.date === opts.targetIso).length;
    const top = movers.slice().sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct))[0];
    const desc = top
      ? `${rowCount} pairs published · Top mover ${top.currency} ${top.deltaPct >= 0 ? "+" : ""}${top.deltaPct.toFixed(2)}%`
      : `${rowCount} pairs published`;
    if (!quiet) {
      toast.success(`Daily digest — ${opts.targetIso}`, {
        description: desc,
        duration: Math.max(1, s.notifyDurationSeconds) * 1000,
      });
    }
    if (s.browserNotifications) fireBrowserNotification(`RBZ daily digest — ${opts.targetIso}`, desc);
    setLastDigestDate(opts.targetIso);
    await addAudit({
      ts: new Date().toISOString(),
      action: "Alert Fired",
      event: `Daily digest ${opts.targetIso}`,
      status: "info",
      payload: { targetIso: opts.targetIso, rowCount, movers },
    });
  }
};
