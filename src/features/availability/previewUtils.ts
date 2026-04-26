import { normalizeHHMM, toMinutes } from "./timeUtils";

export type Range = { start_time: string; end_time: string };
export type WeeklySlotLike = { day_of_week: number; start_time: string; end_time: string };
export type OverrideLike = {
  date: string; // YYYY-MM-DD
  is_unavailable: boolean;
  start_time: string | null;
  end_time: string | null;
};

export function ymd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function getMonthMatrix(year: number, month: number): Date[][] {
  // Sunday-first 6x7 grid
  const first = new Date(year, month, 1);
  const startDow = first.getDay();
  const start = new Date(year, month, 1 - startDow);
  const weeks: Date[][] = [];
  for (let w = 0; w < 6; w++) {
    const row: Date[] = [];
    for (let d = 0; d < 7; d++) {
      row.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + d));
    }
    weeks.push(row);
  }
  return weeks;
}

export function getRangesForDate(
  date: Date,
  weekly: WeeklySlotLike[],
  overrides: OverrideLike[]
): Range[] {
  const key = ymd(date);
  const dayOverrides = overrides.filter((o) => o.date === key);
  if (dayOverrides.length > 0) {
    if (dayOverrides.some((o) => o.is_unavailable)) return [];
    return dayOverrides
      .filter((o) => o.start_time && o.end_time)
      .map((o) => ({
        start_time: normalizeHHMM(o.start_time as string),
        end_time: normalizeHHMM(o.end_time as string),
      }));
  }
  const dow = date.getDay();
  return weekly
    .filter((s) => s.day_of_week === dow)
    .map((s) => ({
      start_time: normalizeHHMM(s.start_time),
      end_time: normalizeHHMM(s.end_time),
    }));
}

export function sliceIntoSlots(ranges: Range[], stepMinutes = 30): string[] {
  const out: string[] = [];
  for (const r of ranges) {
    const start = toMinutes(r.start_time);
    const end = toMinutes(r.end_time);
    for (let t = start; t + stepMinutes <= end; t += stepMinutes) {
      const h = Math.floor(t / 60);
      const m = t % 60;
      out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return Array.from(new Set(out)).sort();
}

export function formatSlotLabel(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

export function hasAnyAvailability(
  date: Date,
  weekly: WeeklySlotLike[],
  overrides: OverrideLike[]
): boolean {
  return getRangesForDate(date, weekly, overrides).length > 0;
}
