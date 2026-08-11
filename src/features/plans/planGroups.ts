import { isClosed, sortPlans } from './planModel';
import type { PlanRow } from '@/types';

// ============================================================
// Три купки планів під календарем.
// ------------------------------------------------------------
// Об'єднаний модуль показує плани плитками одразу під місяцем, і питання, на
// яке відповідає ця розкладка, — не «які плани є», а «що з ними робити»:
//
//   найближчі — має дату, ще попереду;
//   ідеї      — задум без дати, і саме тому окремо: планувати нічого;
//   завершені — тихий низ, у який заглядають рідко.
//
// Чиста функція, бо групування — це рішення, а не оформлення: у переліку
// «найближчих» не має бути завершеного плану навіть тоді, коли його дата
// попереду, і навпаки — ідея без дати не має тонути серед майбутніх.
// ============================================================

export interface PlanGroups {
  upcoming: PlanRow[];
  ideas: PlanRow[];
  closed: PlanRow[];
}

export function groupPlans(plans: readonly PlanRow[], today = new Date()): PlanGroups {
  const sorted = sortPlans(plans, today);
  const upcoming: PlanRow[] = [];
  const ideas: PlanRow[] = [];
  const closed: PlanRow[] = [];

  for (const plan of sorted) {
    // Завершене — завжди завершене. Дата тут нічого не вирішує: план,
    // виконаний наперед, лишається виконаним.
    if (isClosed(plan)) closed.push(plan);
    else if (plan.start_date === null) ideas.push(plan);
    else upcoming.push(plan);
  }

  return { upcoming, ideas, closed };
}
