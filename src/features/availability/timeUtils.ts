// 15-minute increment time options "HH:MM"
export const TIME_OPTIONS: string[] = (() => {
  const out: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 15, 30, 45]) {
      out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return out;
})();

export const DAYS_FULL = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
export const DAYS_SHORT = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function normalizeHHMM(t: string): string {
  return t.length >= 5 ? t.slice(0, 5) : t;
}

export function rangesOverlap(
  ranges: { start_time: string; end_time: string }[]
): boolean {
  const sorted = [...ranges].sort(
    (a, b) => toMinutes(normalizeHHMM(a.start_time)) - toMinutes(normalizeHHMM(b.start_time))
  );
  for (let i = 1; i < sorted.length; i++) {
    if (
      toMinutes(normalizeHHMM(sorted[i].start_time)) <
      toMinutes(normalizeHHMM(sorted[i - 1].end_time))
    ) {
      return true;
    }
  }
  return false;
}

// Common timezone list
export const TIMEZONES: string[] = (() => {
  // @ts-ignore - supportedValuesOf may not be typed in older TS lib
  const supported: string[] | undefined = (Intl as any).supportedValuesOf?.("timeZone");
  return supported && supported.length > 0
    ? supported
    : [
        "UTC",
        "America/Los_Angeles",
        "America/Denver",
        "America/Chicago",
        "America/New_York",
        "Europe/London",
        "Europe/Berlin",
        "Europe/Paris",
        "Asia/Dubai",
        "Asia/Kolkata",
        "Asia/Singapore",
        "Asia/Tokyo",
        "Australia/Sydney",
      ];
})();
