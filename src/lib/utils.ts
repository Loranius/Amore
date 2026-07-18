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

/** 'YYYY-MM' поточного місяця — ключ для schedule / photoCalendar. */
export function monthKey(d: Date = new Date()): string {
  return todayISO(d).slice(0, 7);
}
