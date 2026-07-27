// ============================================================
// UTILS — дрібні спільні хелпери
// ============================================================
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Об'єднання класів Tailwind із коректним вирішенням конфліктів. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Локальна дата у форматі 'YYYY-MM-DD' (без зсуву в UTC, як робив старий код). */
export function todayISO(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Українська форма числівника: [1, 2–4, 5+].
 *
 * `pluralUA(3, ['місто', 'міста', 'міст'])` → 'міста'.
 *
 * Наївне `n === 1 ? 'місто' : 'міст'` дає «3 міст» і «2 днів» — тобто
 * зламану мову там, де пара читає власні дані. Правило: закінчення 11–14
 * завжди беруть третю форму, інакше вирішує остання цифра.
 */
export function pluralUA(n: number, forms: readonly [string, string, string]): string {
  const abs = Math.abs(Math.trunc(n));
  const lastTwo = abs % 100;
  if (lastTwo >= 11 && lastTwo <= 14) return forms[2];
  const last = abs % 10;
  if (last === 1) return forms[0];
  if (last >= 2 && last <= 4) return forms[1];
  return forms[2];
}

/** 'YYYY-MM' поточного місяця — ключ для schedule / photoCalendar. */
export function monthKey(d: Date = new Date()): string {
  return todayISO(d).slice(0, 7);
}

/**
 * 'YYYY-MM-DD' → локальна опівніч. Зворотний бік `todayISO`.
 *
 * Навіщо окремо від `new Date(iso)`: рядок із самою датою специфікація
 * велить розбирати як UTC, а всі `getDate()/getMonth()` читають локально.
 * У від'ємних зсувах це стабільно дає день назад — виміряно на
 * `'2022-05-22'`: «22 травня» в Києві, «21 травня» в Нью-Йорку й
 * Лос-Анджелесі. Дата події в календарі — календарний факт, а не мить у
 * часі, тож розбирати її треба локально.
 *
 * Значення поза 'YYYY-MM-DD' (порожнє, timestamp із часом) віддаються
 * штатному конструктору: там або вже є зона, або дата й так недійсна.
 */
export function localDateFromISO(iso: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return new Date(iso);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}
