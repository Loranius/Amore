import { Link } from 'react-router-dom';
import { ChevronRightIcon } from '@/components/icons/UiIcon';
import { PlanCrystalEdge } from './PlanCrystalEdge';
import { daysLabel } from '@/features/calendar/calendarUtils';
import { PLAN_CATEGORIES, PLAN_STATUSES } from './planConstants';
import { daysUntilStart, hasPreciseDate, isClosed, planDateLabel } from './planModel';
import type { PlanRow } from '@/types';

// ============================================================
// План плиткою — під календарем, у два стовпці.
// ------------------------------------------------------------
// Не заміна `PlanCard`, а її вужчий вигляд: та сама картка на півширини
// екрана перетворилась би на стовпчик із двох слів. Тому тут лишається рівно
// те, за чим план упізнають з першого погляду, — категорія кольором, назва,
// коли, — а решта живе на сторінці плану, куди плитка й веде.
//
// Одне не скоротилось: підтвердження. Запропонований план, який другий
// партнер ще не підтвердив, вимагає відповіді, і сховати її «до сторінки»
// означало б, що відповідь не дадуть ніколи.
//
// У правому верхньому кутку нічого немає — там був кристал або пісочний
// годинник, і власник прибрав їх: «іконка кристалів чи пісочного годинника на
// планах в правому верхньому кутку — не додавай їх». Замість них у нижньому
// кутку стоїть стрілка з референсу: вона каже, що картка кудись веде, а не
// малює статус вдруге.
// ============================================================

export function PlanTile({ plan, onConfirm }: {
  plan: PlanRow;
  /** Показується лише для запропонованого й ще не підтвердженого плану. */
  onConfirm?: (id: number) => void;
}) {
  const cat = PLAN_CATEGORIES[plan.category];
  const status = PLAN_STATUSES[plan.status];
  const date = planDateLabel(plan);
  const closed = isClosed(plan);
  // Відлік лише для точної дати, і лише поки план у роботі: у виконаного
  // «−9 днів» означало б докір за те, що вже зроблено.
  const days = hasPreciseDate(plan) ? daysUntilStart(plan) : null;
  const overdue = !closed && days !== null && days < 0;

  return (
    <article
      className={`pm-tile${closed ? ' pm-tile--closed' : ''}`}
      style={{ '--plan-color': cat.color } as React.CSSProperties}
    >
      <PlanCrystalEdge />

      <Link className="pm-tile-open" to={`/plans/${plan.id}`} aria-label={`Відкрити «${plan.title}»`} />

      <span className="pm-tile-cat">
        <cat.Icon size={12} /> {cat.label}
      </span>
      <p className="pm-tile-title">{plan.title}</p>

      <span className="pm-tile-meta">
        {date ?? <span className="pm-tile-someday">колись</span>}
        {days !== null && !closed && (
          <span className={overdue ? 'pm-tile-overdue' : 'pm-tile-when'}>{daysLabel(days)}</span>
        )}
        {closed && <span className="pm-tile-status"><status.Icon size={11} /> {status.label}</span>}
      </span>

      {!plan.confirmed && onConfirm && (
        <button type="button" className="pm-tile-confirm" onClick={() => onConfirm(plan.id)}>
          Підтвердити
        </button>
      )}

      <span className="pm-tile-go" aria-hidden="true"><ChevronRightIcon size={15} /></span>
    </article>
  );
}
