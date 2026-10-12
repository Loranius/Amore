// ============================================================
// Три стани плану й смуга тижня (ADR-0256).
// ------------------------------------------------------------
// У базі статусів сім: idea, planning, preparing, ready, done, postponed,
// cancelled. Пара розрізняла з них три — «ще задум», «вже з датою»,
// «прожили», — а решта були перемикачем, який ніхто не крутив і який
// займав цілий блок на сторінці плану.
//
// Базу не чіпаємо: стан ВИВОДИТЬСЯ з того, що вже записано.
//
//   done                       → «Прожито»
//   cancelled                  → прихований (у базі лишається)
//   postponed                  → «Задум», навіть якщо дата лишилась:
//                                 відкладене повертається в колоду
//   решта з датою              → «Заплановано»
//   решта без дати             → «Задум»
//
// Стан «Заплановано» ставиться сам — від появи дати, а не від кнопки.
// ============================================================
import { byCodePoint } from '@/engine/ordering';
import { ymd } from '@/features/_shared/month';
import { dayInMonth } from '@/features/calendar/calendarMonth';
import { planOccupiesDate } from '@/features/calendar/calendarPlans';
import { daysUntilStart } from './planModel';
import type { EventRow, PlanRow } from '@/types';

export type PlanStage = 'idea' | 'scheduled' | 'lived' | 'hidden';

export const PLAN_STAGE_LABEL: Record<Exclude<PlanStage, 'hidden'>, string> = {
  idea: 'Задум',
  scheduled: 'Заплановано',
  lived: 'Прожито',
};

export function planStage(plan: PlanRow): PlanStage {
  if (plan.status === 'done') return 'lived';
  if (plan.status === 'cancelled') return 'hidden';
  if (plan.status === 'postponed') return 'idea';
  return plan.start_date === null ? 'idea' : 'scheduled';
}

/** Задуми для каруселі — найдавніший попереду (див. `ideaQueue`). */
export function stageIdeas(plans: readonly PlanRow[]): PlanRow[] {
  return plans
    .filter((plan) => planStage(plan) === 'idea')
    .sort((left, right) => byCodePoint(left.created_at, right.created_at) || left.id - right.id);
}

/**
 * Заплановане — за датою початку: те, що вже триває (від'ємний відлік),
 * стоїть першим, потім найближче.
 */
export function stageScheduled(plans: readonly PlanRow[], today = new Date()): PlanRow[] {
  return plans
    .filter((plan) => planStage(plan) === 'scheduled')
    .sort((left, right) => {
      const a = daysUntilStart(left, today) ?? Infinity;
      const b = daysUntilStart(right, today) ?? Infinity;
      return a - b || left.id - right.id;
    });
}

/** Прожите — найсвіжіше за датою зверху; без дати — за часом запису. */
export function stageLived(plans: readonly PlanRow[]): PlanRow[] {
  return plans
    .filter((plan) => planStage(plan) === 'lived')
    .sort((left, right) => (
      byCodePoint(right.start_date ?? right.created_at, left.start_date ?? left.created_at)
      || right.id - left.id
    ));
}

export interface WeekDay {
  iso: string;
  day: number;
  /** 0 — понеділок. */
  weekday: number;
  isToday: boolean;
  hasPlan: boolean;
  hasEvent: boolean;
}

export const WEEKDAYS_SHORT = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'нд'] as const;

/**
 * Сім днів тижня, у якому лежить `today`, з понеділка.
 *
 * Крапка плану — лише для запланованого (не прихованого й не відкладеного):
 * смуга каже «що в нас цього тижня», а не «що колись мало бути».
 */
export function weekDays(
  plans: readonly PlanRow[],
  events: readonly EventRow[],
  today = new Date(),
): WeekDay[] {
  const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const offset = (midnight.getDay() + 6) % 7;
  const monday = new Date(midnight.getFullYear(), midnight.getMonth(), midnight.getDate() - offset);
  const live = plans.filter((plan) => {
    const stage = planStage(plan);
    return stage === 'scheduled' || stage === 'lived';
  });

  return Array.from({ length: 7 }, (_, weekday) => {
    const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + weekday);
    const yr = date.getFullYear();
    const mo = date.getMonth() + 1;
    const day = date.getDate();
    const iso = ymd(yr, mo, day);
    return {
      iso,
      day,
      weekday,
      isToday: weekday === offset,
      hasPlan: live.some((plan) => planOccupiesDate(plan, iso)),
      hasEvent: events.some((event) => dayInMonth(event, yr, mo) === day),
    };
  });
}
