// ============================================================
// Акцентна картка найближчого плану.
// ------------------------------------------------------------
// Те, заради чого модуль відкривають найчастіше: що буде найближче й
// що для цього ще треба зробити. Тому тут одразу і скільки днів
// лишилось, і готовність, і наступне завдання — щоб не доводилось
// заходити всередину лише щоб це побачити.
// ============================================================
import { Link } from 'react-router-dom';
import { daysLabel } from '@/features/calendar/calendarUtils';
import { pluralUA } from '@/lib/utils';
import { usePlanTasks } from './usePlans';
import { PLAN_CATEGORIES } from './planConstants';
import { daysUntilStart, nextTask, planDateLabel, readiness } from './planModel';
import type { PlanRow } from '@/types';

export function NextPlanCard({ plan }: { plan: PlanRow }) {
  const cat = PLAN_CATEGORIES[plan.category];
  const { data: tasks = [] } = usePlanTasks(plan.id);
  const ready = readiness(tasks);
  const next = nextTask(tasks);
  const days = daysUntilStart(plan);
  const date = planDateLabel(plan);

  return (
    <Link className="plan-next" to={`/plans/${plan.id}`} style={{ borderColor: cat.color }}>
      <span className="plan-next-kicker">Найближче</span>

      <span className="plan-next-head">
        <span className="plan-next-icon" style={{ color: cat.color }}>
          <cat.Icon size={30} />
        </span>
        <span className="plan-next-copy">
          <strong className="plan-next-title">{plan.title}</strong>
          <span className="plan-next-when" style={{ color: cat.color }}>
            {days !== null ? daysLabel(days) : cat.label}
          </span>
          <small className="plan-next-meta">
            {date}
            {plan.location_name && <> · {plan.location_name}</>}
          </small>
        </span>
      </span>

      {ready.total > 0 && (
        <span className="plan-next-progress">
          <span className="plan-next-bar" aria-hidden="true">
            <span style={{ width: `${ready.percent}%`, background: cat.color }} />
          </span>
          <small>
            {ready.done} з {ready.total} {pluralUA(ready.total, ['завдання', 'завдань', 'завдань'])}
            {' · '}готовність {ready.percent}%
          </small>
        </span>
      )}

      {next && (
        <span className="plan-next-task">
          Далі: <b>{next.title}</b>
        </span>
      )}
    </Link>
  );
}
