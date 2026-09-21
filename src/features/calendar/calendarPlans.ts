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
// `lastDayOf` жив тут приватним, і через це «коли план скінчиться» знав
// календар, а модуль «Плани» — ні; на цьому й виросла вада з червоним
// «81 дн. тому» (ADR-0201). Відповідь тепер одна, у моделі планів.
import { lastDayOf, showsInCalendar } from '@/features/plans/planModel';
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
    const end = lastDayOf(plan) ?? start;
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



/** Чи план уже закритий — для приглушеного вигляду рядка в сітці. */
export function planMuted(plan: PlanRow): boolean {
  return PLAN_STATUSES[plan.status].closed;
}

// `planYearTotal` і `plansByMonth` жили тут для річного огляду календаря. Огляд
// пішов разом зі сторінкою, коли календар став вкладкою «Планів», — і функції
// пішли за ним, щоб не лишитись кодом без викликача.
