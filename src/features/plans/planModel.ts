// ============================================================
// Чисті функції модуля «Плани».
// ------------------------------------------------------------
// Без React і без Supabase — як planLinkModel поруч. Тут живе
// вся логіка, за якою модуль вирішує, що показати першим, що вважати
// найближчим і як назвати неточну дату. Саме її й покривають тести:
// решта модуля — розкладка навколо цих відповідей.
// ============================================================
import { localDateFromISO } from '@/lib/utils';
import { MONTHS_UA_GENITIVE } from '@/features/_shared/month';
import { PLAN_STATUSES } from './planConstants';
import type { PlanRow, PlanTaskRow } from '@/types';

/** Чи план уже не в роботі (виконаний, відкладений або скасований). */
export function isClosed(plan: PlanRow): boolean {
  return PLAN_STATUSES[plan.status].closed;
}

/**
 * Чи цей план узагалі має що показувати в календарі.
 *
 * Лише точний день і період: «осінь 2026» у сітці місяця не має де
 * стояти, а поставити її на 1 вересня означало б збрехати про дату.
 */
export function showsInCalendar(plan: PlanRow): boolean {
  return plan.start_date !== null
    && (plan.date_precision === 'day' || plan.date_precision === 'range');
}

/** Скільки днів до початку; null коли дати немає. Минуле — від'ємне. */
export function daysUntilStart(plan: PlanRow, today = new Date()): number | null {
  if (!plan.start_date) return null;
  const start = localDateFromISO(plan.start_date);
  const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((start.getTime() - midnight.getTime()) / 86_400_000);
}

/**
 * Чи можна назвати кількість днів до плану, не збрехавши про точність.
 *
 * «Через 1 міс.» під датою «осінь 2026» обіцяє знання, якого немає:
 * 1 вересня там стоїть лише як початок періоду. Тому зворотний відлік
 * показуємо рівно там само, де план потрапляє в календар.
 */
export function hasPreciseDate(plan: PlanRow): boolean {
  return showsInCalendar(plan);
}

/**
 * Найближчий план — той, заради якого відкривають модуль.
 *
 * Береться лише з тих, що в роботі й мають ТОЧНУ дату в майбутньому
 * (або сьогодні). Три відсіювання, кожне зі своєї причини:
 *
 * • без дати — «колись наступного року» не має стояти попереду
 *   сьогоднішнього;
 * • неточна дата — акцентна картка друкує зворотний відлік, а для
 *   сезону його нема звідки взяти чесно;
 * • непідтверджена пропозиція — це ще не спільний план, а питання до
 *   партнера. Вона мусить лишитись у списку, де є кнопка «Підтвердити»,
 *   якої в акцентній картці немає.
 */
export function nextPlan(plans: readonly PlanRow[], today = new Date()): PlanRow | null {
  let best: PlanRow | null = null;
  let bestDays = Infinity;
  for (const plan of plans) {
    if (isClosed(plan) || !plan.confirmed || !hasPreciseDate(plan)) continue;
    const days = daysUntilStart(plan, today);
    if (days === null || days < 0) continue;
    if (days < bestDays) { best = plan; bestDays = days; }
  }
  return best;
}

/**
 * Порядок у списку: спершу найближчі за датою, потім бездатні, потім
 * закриті. Усередині бездатних — новіші зверху.
 *
 * Повертає НОВИЙ масив: сортування на місці зіпсувало б кеш React Query,
 * бо масив із нього віддається за посиланням.
 */
export function sortPlans(plans: readonly PlanRow[], today = new Date()): PlanRow[] {
  const rank = (p: PlanRow): number => (isClosed(p) ? 2 : p.start_date ? 0 : 1);
  return [...plans].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    if (ra === 0) {
      const da = daysUntilStart(a, today)!;
      const db = daysUntilStart(b, today)!;
      // Минулі (від'ємні) лишаються серед датованих, але в кінці своєї
      // групи: прострочений план не має ховатись, він потребує уваги.
      if (da >= 0 !== db >= 0) return da >= 0 ? -1 : 1;
      if (da !== db) return da - db;
    }
    return b.created_at.localeCompare(a.created_at);
  });
}

export interface PlanReadiness {
  total: number;
  done: number;
  /** 0…100, ціле. Без завдань — 0, а не 100. */
  percent: number;
}

/**
 * Готовність плану за завданнями.
 *
 * План без завдань — 0%, а не 100%: порожній список означає «підготовку
 * ще не почали», а не «все зроблено». Протилежна відповідь показувала б
 * щойно створену ідею повністю готовою.
 */
export function readiness(tasks: readonly PlanTaskRow[]): PlanReadiness {
  const total = tasks.length;
  const done = tasks.filter((t) => t.done).length;
  return { total, done, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}

/** Перше невиконане завдання за порядком — «що далі». */
export function nextTask(tasks: readonly PlanTaskRow[]): PlanTaskRow | null {
  const open = [...tasks]
    .filter((t) => !t.done)
    .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
  return open[0] ?? null;
}

const SEASONS = ['зима', 'весна', 'літо', 'осінь'] as const;

/** Сезон за місяцем початку: грудень-лютий — зима, і так далі. */
function seasonOf(month: number): string {
  return SEASONS[Math.floor(((month + 1) % 12) / 3)]!;
}

/**
 * Підпис дати під її точністю.
 *
 * `start_date` завжди зберігає початок періоду, тому один рядок у базі
 * читається шістьма різними способами — і саме це робить неточні дати
 * сортовними нарівні з точними.
 */
export function planDateLabel(plan: PlanRow): string | null {
  if (!plan.start_date) return null;
  const d = localDateFromISO(plan.start_date);
  const month = MONTHS_UA_GENITIVE[d.getMonth()] ?? '';
  switch (plan.date_precision) {
    case 'day':
      return `${d.getDate()} ${month} ${d.getFullYear()}`;
    case 'range': {
      if (!plan.end_date) return `${d.getDate()} ${month} ${d.getFullYear()}`;
      const e = localDateFromISO(plan.end_date);
      // «12–14 серпня» — місяць один раз, коли він спільний.
      if (e.getMonth() === d.getMonth() && e.getFullYear() === d.getFullYear()) {
        return `${d.getDate()}–${e.getDate()} ${month} ${d.getFullYear()}`;
      }
      const em = MONTHS_UA_GENITIVE[e.getMonth()] ?? '';
      return `${d.getDate()} ${month} – ${e.getDate()} ${em} ${e.getFullYear()}`;
    }
    case 'month':
      return `${month} ${d.getFullYear()}`;
    case 'season':
      return `${seasonOf(d.getMonth())} ${d.getFullYear()}`;
    case 'year':
      return String(d.getFullYear());
    case 'none':
      return null;
  }
}
