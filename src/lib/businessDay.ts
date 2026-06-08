// RBZ publishes interbank rates on weekdays only (Mon–Fri).
// On weekends (and before publication), the most-recent business day is used.

export const isWeekend = (d: Date) => {
  const day = d.getDay(); // 0 Sun, 6 Sat
  return day === 0 || day === 6;
};

/** Returns the most recent weekday (Mon-Fri) on or before the given date. */
export const mostRecentBusinessDay = (from: Date = new Date()): Date => {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  while (isWeekend(d)) d.setDate(d.getDate() - 1);
  return d;
};

export const previousBusinessDay = (from: Date): Date => {
  const d = new Date(from);
  d.setDate(d.getDate() - 1);
  return mostRecentBusinessDay(d);
};

// Use LOCAL date components so the ISO date matches the user's calendar day
// (toISOString() would shift to UTC and can land on the previous/next day).
export const toIsoDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const formatLongDate = (d: Date) =>
  d.toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

/** Describe the weekend-fallback decision for audit/UI messages. */
export const describeFallback = (now: Date = new Date()) => {
  const target = mostRecentBusinessDay(now);
  const fellBack = isWeekend(now);
  return {
    target,
    fellBack,
    reason: fellBack
      ? `Today is ${now.toLocaleDateString("en-GB", { weekday: "long" })} — RBZ does not publish on weekends. Falling back to ${formatLongDate(target)}.`
      : `Targeting ${formatLongDate(target)} publication.`,
  };
};
