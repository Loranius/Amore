// ============================================================
// Розкладка планів по місяцю й по року.
// ------------------------------------------------------------
// Плани переїхали з `events` у власну таблицю, і календар мусить читати
// їх звідти — інакше «Вікенд у Карпатах 14 серпня» просто зник би з
// сітки, хоч у модулі «Плани» він на місці.
//
// Окремий файл, а не гілка в `calendarMonth.ts`: у подій і планів різні
// питання про дату. Подія має ОДИН день і буває щорічною; план має
// період і точність, і саме через це його не можна прогнати через
// `dayInMonth`. Спільного коду тут не було б — була б купа `if`.
// ============================================================
import { localDateFromISO } from '@/lib/utils';
import { daysInMonth } from '@/features/_shared/month';
import { PLAN_STATUSES } from '@/features/plans/planConstants';
import { showsInCalendar } from '@/features/plans/planModel';
import type { PlanRow } from '@/types';

/**
 * Чи цьому плану місце в сітці.
 *
 * Крім точності дати (`showsInCalendar` — лише день і період) відсіюємо
 * скасовані й відкладені: у них дата вже не означає нічого. Виконані
 * ЛИШАЮТЬСЯ — вони таки відбулись того дня, і в минулому місяці мають
 * стояти рівно так само, як минула подія.
 */
export function planShowsInGrid(plan: PlanRow): boolean {
  if (!showsInCalendar(plan)) return false;
  return plan.status !== 'cancelled' && plan.status !== 'postponed';
}

/** Останній день плану: для періоду — `end_date`, інакше сам початок. */
function lastDayOf(plan: PlanRow): Date {
  const start = localDateFromISO(plan.start_date!);
  if (plan.date_precision !== 'range' || !plan.end_date) return start;
  const end = localDateFromISO(plan.end_date);
  // Зіпсований діапазон (кінець раніше початку) читаємо як один день, а
  // не як порожній: план не має тихо зникати з календаря через це.
  return Number.isNaN(end.getTime()) || end.getTime() < start.getTime() ? start : end;
}

/**
 * День місяця → плани цього дня.
 *
 * Період займає КОЖЕН свій день, а не лише перший: «12–14 серпня» має
 * бути видно всі три дні, інакше 13-те виглядає вільним. Дні за межами
 * переглядуваного місяця відрізаються, тож похід 30 серпня — 2 вересня
 * у серпні займає два дні й у вересні ще два.
 *
 * Порядок усередині дня сталий (за id) — з тієї ж причини, що і в
 * `eventsByDay`: щоб крапки не переставлялись між перемальовуваннями.
 */
export function plansByDay(
  plans: readonly PlanRow[],
  yr: number,
  mo: number,
): Map<number, PlanRow[]> {
  const out = new Map<number, PlanRow[]>();
  const total = daysInMonth(yr, mo);
  const monthStart = new Date(yr, mo - 1, 1);
  const monthEnd = new Date(yr, mo - 1, total);

  for (const plan of plans) {
    if (!planShowsInGrid(plan)) continue;
    const start = localDateFromISO(plan.start_date!);
    if (Number.isNaN(start.getTime())) continue;
    const end = lastDayOf(plan);
    if (end.getTime() < monthStart.getTime() || start.getTime() > monthEnd.getTime()) continue;

    const from = start.getTime() < monthStart.getTime() ? 1 : start.getDate();
    const to = end.getTime() > monthEnd.getTime() ? total : end.getDate();
    for (let day = from; day <= to; day++) {
      const bucket = out.get(day);
      if (bucket) bucket.push(plan);
      else out.set(day, [plan]);
    }
  }
  for (const list of out.values()) list.sort((a, b) => a.id - b.id);
  return out;
}

/**
 * Скільки РІЗНИХ планів припадає на кожен місяць року (12 чисел, з січня).
 *
 * План рахується один раз на місяць, навіть якщо займає в ньому тиждень:
 * у річному огляді число означає «скільки в нас справ», а не «скільки
 * зайнято днів».
 */
export function plansByMonth(plans: readonly PlanRow[], yr: number): number[] {
  return Array.from({ length: 12 }, (_, i) => {
    const byDay = plansByDay(plans, yr, i + 1);
    const ids = new Set<number>();
    for (const list of byDay.values()) for (const p of list) ids.add(p.id);
    return ids.size;
  });
}

/**
 * Скільки РІЗНИХ планів у році — для підпису річного огляду.
 *
 * Не сума `plansByMonth`: похід 30 грудня — 2 січня стоїть у двох
 * місяцях, але план у пари один.
 */
export function planYearTotal(plans: readonly PlanRow[], yr: number): number {
  const ids = new Set<number>();
  for (let mo = 1; mo <= 12; mo++) {
    for (const list of plansByDay(plans, yr, mo).values()) {
      for (const p of list) ids.add(p.id);
    }
  }
  return ids.size;
}

/** Чи план уже закритий — для приглушеного вигляду рядка в сітці. */
export function planMuted(plan: PlanRow): boolean {
  return PLAN_STATUSES[plan.status].closed;
}
