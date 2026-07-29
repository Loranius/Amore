import type { LeapDayPolicy } from './types';

export interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function isValidCalendarDate(date: CalendarDate): boolean {
  return Number.isInteger(date.year)
    && Number.isInteger(date.month)
    && Number.isInteger(date.day)
    && date.month >= 1
    && date.month <= 12
    && date.day >= 1
    && date.day <= daysInMonth(date.year, date.month);
}

function parseDateOnly(value: string): CalendarDate | null {
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = { year, month, day };
  return isValidCalendarDate(date) ? date : null;
}

function datePartsInTimeZone(date: Date, timeZone: string): CalendarDate {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  const result = {
    year: Number(values.get('year')),
    month: Number(values.get('month')),
    day: Number(values.get('day')),
  };

  if (!isValidCalendarDate(result)) {
    throw new Error(`Could not derive a calendar date in time zone "${timeZone}".`);
  }
  return result;
}

export function assertValidTimeZone(timeZone: string): void {
  try {
    new Intl.DateTimeFormat('en', { timeZone }).format(new Date(0));
  } catch {
    throw new Error(`Invalid IANA time zone: "${timeZone}".`);
  }
}

export function parseCalendarDate(value: string, timeZone: string): CalendarDate | null {
  const dateOnly = parseDateOnly(value);
  if (dateOnly) return dateOnly;

  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return null;
  return datePartsInTimeZone(instant, timeZone);
}

export function parseEvolutionInstant(value: string): number | null {
  const dateOnly = parseDateOnly(value);
  if (dateOnly) return Date.UTC(dateOnly.year, dateOnly.month - 1, dateOnly.day);

  const epochMs = Date.parse(value);
  return Number.isFinite(epochMs) ? epochMs : null;
}

function compareCalendarDates(left: CalendarDate, right: CalendarDate): number {
  if (left.year !== right.year) return left.year - right.year;
  if (left.month !== right.month) return left.month - right.month;
  return left.day - right.day;
}

function anniversaryInYear(
  relationshipStart: CalendarDate,
  year: number,
  leapDayPolicy: LeapDayPolicy,
): CalendarDate {
  if (relationshipStart.month === 2 && relationshipStart.day === 29 && !isLeapYear(year)) {
    return leapDayPolicy === 'feb-28'
      ? { year, month: 2, day: 28 }
      : { year, month: 3, day: 1 };
  }

  return { year, month: relationshipStart.month, day: relationshipStart.day };
}

/**
 * Returns the number of completed relationship anniversaries at the event date.
 * Events before the official relationship start remain in epoch 0 as origin history.
 */
export function relationshipEpochIndex(
  relationshipStart: CalendarDate,
  eventDate: CalendarDate,
  leapDayPolicy: LeapDayPolicy,
): number {
  let completedYears = eventDate.year - relationshipStart.year;
  if (completedYears <= 0) return 0;

  const anniversary = anniversaryInYear(relationshipStart, eventDate.year, leapDayPolicy);
  if (compareCalendarDates(eventDate, anniversary) < 0) completedYears -= 1;
  return Math.max(0, completedYears);
}
