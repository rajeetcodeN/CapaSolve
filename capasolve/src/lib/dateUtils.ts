import { SHIFT_1_START, SHIFT_2_END, WORKING_HOURS_PER_DAY } from "@/lib/types";

export const MONTH_NAMES: readonly string[] = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export const MONTH_NAMES_SHORT: readonly string[] = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/**
 * Formats a Date object to YYYY-MM-DD string
 */
export function formatDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Returns localized or English month name for 0-indexed month number
 */
export function getLocalizedMonthName(mo: number): string {
  return MONTH_NAMES[mo] ?? "June";
}

/**
 * Calculates ISO week number (1-53) for a given Date
 */
export function getISOWeekNumber(d: Date): number {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const week1 = new Date(date.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
  );
}

/**
 * Calculates standard week number for a given Date
 */
export function getWeekNumber(d: Date): number {
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
}

/**
 * Counts working hours between two dates mathematically in O(1) constant time
 * Defaults to shift boundaries SHIFT_1_START (06:00) to SHIFT_2_END (20:00)
 */
export function getWorkingHoursBetween(start: Date, end: Date): number {
  if (start >= end) return 0;

  const dStart = new Date(start.getTime());
  const dEnd = new Date(end.getTime());

  // Set to midnight to find the difference in calendar days
  const startDay = new Date(dStart.getFullYear(), dStart.getMonth(), dStart.getDate());
  const endDay = new Date(dEnd.getFullYear(), dEnd.getMonth(), dEnd.getDate());

  const diffDays = Math.round((endDay.getTime() - startDay.getTime()) / 86400000);

  if (diffDays === 0) {
    // Same calendar day: count hours within the working range
    const h1 = Math.max(SHIFT_1_START, Math.min(SHIFT_2_END, dStart.getHours()));
    const h2 = Math.max(SHIFT_1_START, Math.min(SHIFT_2_END, dEnd.getHours()));
    return Math.max(0, h2 - h1);
  } else {
    // Different calendar days
    // 1. Working hours on the first day
    const h1 = Math.max(SHIFT_1_START, Math.min(SHIFT_2_END, dStart.getHours()));
    const firstDayHours = Math.max(0, SHIFT_2_END - h1);

    // 2. Working hours on the last day
    const h2 = Math.max(SHIFT_1_START, Math.min(SHIFT_2_END, dEnd.getHours()));
    const lastDayHours = Math.max(0, h2 - SHIFT_1_START);

    // 3. Working hours for full days in between
    const middleDaysHours = (diffDays - 1) * WORKING_HOURS_PER_DAY;

    return firstDayHours + middleDaysHours + lastDayHours;
  }
}
