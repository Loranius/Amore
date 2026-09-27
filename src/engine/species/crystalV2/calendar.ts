// ============================================================
// Роки стосунків — чиста арифметика дат, без `Date` (ADR-0217).
// ------------------------------------------------------------
// `Date` залежить від часового поясу пристрою, а модель — ні. Дні рахуються
// алгоритмом «days from civil» (Howard Hinnant), тим самим числом, що дає
// `date.toordinal()` у Python-двійнику з точністю до сталого зсуву.
// 29 лютого в невисокосний рік стає 28-м (`feb-28`).
// ============================================================

export const DAYS_PER_YEAR = 365.2425;

export interface CivilDay {
  year: number;
  month: number;
  day: number;
}

export function parseDay(text: string): CivilDay {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (!match) throw new Error(`crystalV2: not an ISO date: ${text}`);
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

/** Номер дня від 1970-01-01. */
export function dayNumber({ year, month, day }: CivilDay): number {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function anniversary(start: CivilDay, k: number): CivilDay {
  const year = start.year + k;
  if (start.month === 2 && start.day === 29 && !isLeap(year)) return { year, month: 2, day: 28 };
  return { year, month: start.month, day: start.day };
}

export function daysBetween(a: CivilDay, b: CivilDay): number {
  return dayNumber(b) - dayNumber(a);
}

/** Номер року стосунків, у який припала дата. До початку — рік 0. */
export function yearIndex(start: CivilDay, day: CivilDay): number {
  const at = dayNumber(day);
  if (at < dayNumber(start)) return 0;
  let k = day.year - start.year;
  while (k > 0 && dayNumber(anniversary(start, k)) > at) k -= 1;
  while (dayNumber(anniversary(start, k + 1)) <= at) k += 1;
  return k;
}

export function yearsSince(start: CivilDay, day: CivilDay): number {
  return Math.max(0, daysBetween(start, day)) / DAYS_PER_YEAR;
}
