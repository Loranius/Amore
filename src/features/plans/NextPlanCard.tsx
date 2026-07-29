// ============================================================
// Акцентний віджет найближчого плану.
// ------------------------------------------------------------
// На оглядовому екрані це головна точка уваги: фото або категорійна
// ілюстрація, короткий зміст і зрозумілий час до події. Детальна підготовка
// лишається всередині плану, щоб віджет не перетворювався на звіт.
// ============================================================
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { CalendarIcon, ChevronRightIcon } from '@/components/icons/UiIcon';
import { daysLabel } from '@/features/calendar/calendarUtils';
import { pluralUA } from '@/lib/utils';
import { usePlanTasks } from './usePlans';
import { PLAN_CATEGORIES } from './planConstants';
import { daysUntilStart, planDateLabel, readiness } from './planModel';
import type { PlanRow } from '@/types';

export function NextPlanCard({ plan }: { plan: PlanRow }) {
  const category = PLAN_CATEGORIES[plan.category];
  const { data: tasks = [] } = usePlanTasks(plan.id);
  const ready = readiness(tasks);
  const days = daysUntilStart(plan);
  const date = planDateLabel(plan);
  const description = plan.description?.trim() || null;

  return (
    <Link
      className={`plans-featured-card${plan.cover_url ? ' plans-featured-card--photo' : ''}`}
      to={`/plans/${plan.id}`}
      style={{ '--plan-accent': category.color } as CSSProperties}
    >
      <span className="plans-featured-media" aria-hidden={!plan.cover_url}>
        {plan.cover_url ? (
          <img
            src={plan.cover_url}
            alt=""
            decoding="async"
            fetchPriority="high"
          />
        ) : (
          <span className="plans-featured-media-fallback">
            <category.Icon size={38} />
          </span>
        )}
      </span>

      <span className="plans-featured-copy">
        <span className="plans-featured-category">
          <category.Icon size={14} />
          {category.label}
        </span>

        <strong className="plans-featured-title">{plan.title}</strong>
        {description && <span className="plans-featured-description">{description}</span>}

        <span className="plans-featured-meta">
          {days !== null && <b>{daysLabel(days)}</b>}
          {date && (
            <span>
              <CalendarIcon size={15} />
              {date}
            </span>
          )}
          {plan.location_name && <span>{plan.location_name}</span>}
        </span>

        {ready.total > 0 && (
          <span className="plans-featured-progress">
            <span aria-hidden="true">
              <i style={{ width: `${ready.percent}%` }} />
            </span>
            <small>
              {ready.done} з {ready.total} {pluralUA(ready.total, ['кроку', 'кроків', 'кроків'])} готово
            </small>
          </span>
        )}
      </span>

      <span className="plans-featured-open" aria-hidden="true">
        <ChevronRightIcon size={21} />
      </span>
    </Link>
  );
}
