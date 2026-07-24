// User-configurable publication-check windows and notification timing.
// Persisted to localStorage; safe to read on the server (returns defaults).

export interface Window {
  /** 0-23 inclusive */
  startHour: number;
  /** 0-23 inclusive; endHour is exclusive (e.g. 12 = up to 11:59) */
  endHour: number;
  /** Poll interval in minutes while inside this window and target not found */
  intervalMinutes: number;
}

export interface SyncSettings {
  /** Weekdays (Mon-Fri): active publication windows. Evaluated in order. */
  weekdayWindows: Window[];
  /** Off-hours weekday poll interval (minutes) when no window matches. */
  weekdayOffHoursMinutes: number;
  /** Weekend polling. If disabled, weekends recheck at weekendIdleMinutes. */
  weekendEnabled: boolean;
  weekendIdleMinutes: number;
  /** Poll interval once today's target rate is captured. */
  haveTargetMinutes: number;
  /** Backoff after a sync error. */
  errorMinutes: number;
  /** Show a toast when a new publication is imported by a background sync. */
  notifyOnNewPublication: boolean;
  /** Toast duration in seconds. */
  notifyDurationSeconds: number;
}

export const DEFAULT_SETTINGS: SyncSettings = {
  // User's stated norm: RBZ publishes weekdays, usually before noon.
  weekdayWindows: [
    { startHour: 8, endHour: 12, intervalMinutes: 5 },   // publication window
    { startHour: 12, endHour: 15, intervalMinutes: 15 }, // late-morning catch-up
    { startHour: 15, endHour: 18, intervalMinutes: 30 }, // afternoon watch
  ],
  weekdayOffHoursMinutes: 60,
  weekendEnabled: false,
  weekendIdleMinutes: 4 * 60,
  haveTargetMinutes: 60,
  errorMinutes: 10,
  notifyOnNewPublication: true,
  notifyDurationSeconds: 15,
};

const KEY = "fx.syncSettings.v1";

export const loadSettings = (): SyncSettings => {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<SyncSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
};

export const saveSettings = (s: SyncSettings) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new CustomEvent("fx:sync-settings-changed"));
};

export const resetSettings = () => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
  window.dispatchEvent(new CustomEvent("fx:sync-settings-changed"));
};

const fmtHour = (h: number) => `${String(h).padStart(2, "0")}:00`;
export const describeWindow = (w: Window) =>
  `${fmtHour(w.startHour)}–${fmtHour(w.endHour)} · every ${w.intervalMinutes} min`;
