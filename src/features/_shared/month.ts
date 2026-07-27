// ============================================================
// Місячна сітка — спільні утиліти (schedule + photo-calendar)
// ------------------------------------------------------------
// Дати рахуються ЛОКАЛЬНО (не через toISOString/UTC): інакше вночі
// до 02:00–03:00 «сьогодні» визначалось як учора (баг старого коду).
// Тиждень починається з понеділка.
// ============================================================
/** Називний — для заголовків місяця: «Липень 2026». */
export const MONTHS_UA = [
  'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
  'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень',
] as const;

/** Родовий — для дат із числом: «14 липня 2026». Обидва списки тут, бо
 *  інакше кожен модуль заводить свою копію (календар уже мав власну). */
export const MONTHS_UA_GENITIVE = [
  'січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
  'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня',
] as const;

export const DAYS_UA = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'НД'] as const;

/**
 * 'YYYY-MM-DD' → «14 липня 2026». Без року — «14 липня».
 *
 * Розбір ЛОКАЛЬНИЙ (див. localDateFromISO): дата тут календарний факт,
 * а не мить у часі, і `new Date('2026-07-14').getDate()` у від'ємних
 * зонах віддав би 13.
 *
 * Порожній чи несправний рядок дає порожній підпис, а не «Invalid Date»
 * посеред картки місця.
 */
export function formatDateUA(iso: string, opts: { year?: boolean } = {}): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return '';
  const [, y, m, d] = match;
  const month = MONTHS_UA_GENITIVE[Number(m) - 1];
  if (!month) return '';
  const day = Number(d);
  if (day < 1 || day > daysInMonth(Number(y), Number(m))) return '';
  return opts.year === false ? `${day} ${month}` : `${day} ${month} ${y}`;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' з (рік, місяць 1–12, день). */
export const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

/** Локальна сьогоднішня дата 'YYYY-MM-DD'. */
export function todayLocal(): string {
  const d = new Date();
  return ymd(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/** Ключ місяця 'YYYY-MM' для query-ключів. */
export const monthKeyOf = (yr: number, mo: number) => `${yr}-${pad(mo)}`;

export function daysInMonth(yr: number, mo: number): number {
  return new Date(yr, mo, 0).getDate();
}

/** Зсув першого дня місяця у ПН-першій сітці (ПН=0…НД=6). */
export function firstMondayOffset(yr: number, mo: number): number {
  const dow = new Date(yr, mo - 1, 1).getDay(); // 0=Нд
  return dow === 0 ? 6 : dow - 1;
}

/** Діапазон дат місяця для запиту .gte/.lte. */
export function monthRange(yr: number, mo: number): { from: string; to: string } {
  return { from: ymd(yr, mo, 1), to: ymd(yr, mo, daysInMonth(yr, mo)) };
}

/** {рік, місяць} поточного місяця (для ініціалізації стану). */
export function currentYearMonth(): { yr: number; mo: number } {
  const now = new Date();
  return { yr: now.getFullYear(), mo: now.getMonth() + 1 };
}

/** Крок по місяцях зі зміною року на межах. */
export function stepMonth(yr: number, mo: number, delta: number): { yr: number; mo: number } {
  let m = mo + delta;
  let y = yr;
  if (m > 12) { m = 1; y++; }
  if (m < 1) { m = 12; y--; }
  return { yr: y, mo: m };
}
