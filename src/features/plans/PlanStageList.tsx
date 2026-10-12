// ============================================================
// Список планів першого екрана (ADR-0256).
// ------------------------------------------------------------
// Замість великої картки одного плану й трьох рядків-кнопок —
// один список за датою: дата стовпчиком, назва, коли, значок типу. Рядок
// веде на сторінку плану цілком. Той самий рядок показує й прожите.
// ============================================================
import { Link } from 'react-router-dom';
import { MONTHS_UA_GENITIVE } from '@/features/_shared/month';
import { localDateFromISO } from '@/lib/utils';
import { CalendarIcon } from '@/components/icons/UiIcon';
import { PLAN_CATEGORIES } from './planConstants';
import { hasPreciseDate, planCountdown, planDateLabel } from './planModel';
import type { PlanRow } from '@/types';

function whenLine(plan: PlanRow, lived: boolean): string {
  const date = planDateLabel(plan);
  if (lived) return date ?? 'без дати';
  const countdown = planCountdown(plan);
  if (countdown?.phase === 'running') {
    const end = plan.end_date ? planDateLabel({ ...plan, start_date: plan.end_date, date_precision: 'day' }) : null;
    return end ? `триває · до ${end}` : 'триває';
  }
  if (countdown) return countdown.label;
  return date ?? 'без дати';
}

function DateMark({ plan }: { plan: PlanRow }) {
  if (!plan.start_date || !hasPreciseDate(plan)) {
    return <span className="pf-row-when" aria-hidden="true"><CalendarIcon size={18} /></span>;
  }
  const d = localDateFromISO(plan.start_date);
  return (
    <span className="pf-row-when" aria-hidden="true">
      <b>{d.getDate()}</b>
      <i>{(MONTHS_UA_GENITIVE[d.getMonth()] ?? '').slice(0, 3)}</i>
    </span>
  );
}

export function PlanStageList({ plans, lived = false, onConfirm }: {
  plans: readonly PlanRow[];
  lived?: boolean;
  /** Лише для запропонованого й ще не підтвердженого плану. */
  onConfirm?: (id: number) => void;
}) {
  return (
    <ul className="pf-list" data-lived={lived ? 'true' : undefined}>
      {plans.map((plan) => {
        const cat = PLAN_CATEGORIES[plan.category];
        const when = whenLine(plan, lived);
        const running = !lived && planCountdown(plan)?.phase === 'running';
        return (
          <li key={plan.id} className="pf-row" style={{ '--plan-color': cat.color } as React.CSSProperties}>
            <Link className="pf-row-open" to={`/plans/${plan.id}`} aria-label={`${plan.title}, ${when}`} />
            <DateMark plan={plan} />
            <span className="pf-row-text">
              <b>{plan.title}</b>
              <small data-live={running ? 'true' : undefined}>{when}</small>
            </span>
            {!plan.confirmed && onConfirm ? (
              <button type="button" className="pf-row-confirm" onClick={() => onConfirm(plan.id)}>
                Підтвердити
              </button>
            ) : (
              <span className="pf-row-cat" aria-hidden="true" title={cat.label}><cat.Icon size={16} /></span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
