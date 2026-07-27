import type { AppUser } from '@/types';
import type { MarksMap } from './useSchedule';

export type DayStatus = 'both-off' | 'lena-off' | 'dima-off' | 'none';

export function dayStatus(
  lena: AppUser | undefined,
  dima: AppUser | undefined,
  marks: MarksMap,
  date: string,
): DayStatus {
  const lenaOff = !!lena && marks[lena.id]?.[date] === 'Х';
  const dimaOff = !!dima && marks[dima.id]?.[date] === 'Х';
  if (lenaOff && dimaOff) return 'both-off';
  if (lenaOff) return 'lena-off';
  if (dimaOff) return 'dima-off';
  return 'none';
}

export function fmtLongDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString('uk-UA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function countdownLabel(date: string, today: string): string {
  const target = new Date(`${date}T12:00:00`).getTime();
  const current = new Date(`${today}T12:00:00`).getTime();
  const days = Math.max(0, Math.round((target - current) / 86_400_000));
  if (days === 0) return 'Сьогодні';
  if (days === 1) return 'Завтра';
  return `Через ${days} дн.`;
}

export function statusText(status: DayStatus): string {
  if (status === 'both-off') return 'Ви обоє вільні';
  if (status === 'lena-off') return 'Лєна вільна, Діма працює';
  if (status === 'dima-off') return 'Діма вільний, Лєна працює';
  return 'Спільного вихідного немає';
}

export function fmtDatePlanDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'long',
    weekday: 'short',
  });
}
