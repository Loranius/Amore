// ============================================================
// «Плани» — головний екран модуля.
// ------------------------------------------------------------
// Відповідає на питання «що ми хочемо зробити разом». Досі це питання
// не мало свого місця: плани були вкладкою всередині календаря, а
// побачення — окремим списком у «Графіку».
//
// Порядок секцій — за тим, як їх читають: спершу найближче (заради
// нього й відкривають), потім те, над чим працюють, потім ідеї без
// дати, і аж наприкінці завершене.
// ============================================================
import { useMemo, useState } from 'react';
import { TabBar } from '@/components/ui/TabBar';
import { PlusIcon } from '@/components/icons/UiIcon';
import { usePlanMutations, usePlans } from './usePlans';
import { isClosed, nextPlan, sortPlans } from './planModel';
import { PlanCard } from './PlanCard';
import { NextPlanCard } from './NextPlanCard';
import { AddPlanModal } from './AddPlanModal';
import './plans.css';
import type { PlanRow } from '@/types';

type Filter = 'all' | 'idea' | 'preparing' | 'soon' | 'closed';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Усі' },
  { value: 'idea', label: 'Ідеї' },
  { value: 'preparing', label: 'У підготовці' },
  { value: 'soon', label: 'Найближчі' },
  { value: 'closed', label: 'Завершені' },
];

/**
 * «Ідея» — це і статус, і стан «дати ще немає». Тому фільтр дивиться на
 * обидва: план зі статусом «Плануємо», але без дати, для читача теж
 * ідея, і ховати його від вкладки «Ідеї» означало б втратити.
 */
function matches(plan: PlanRow, filter: Filter): boolean {
  switch (filter) {
    case 'all': return true;
    case 'idea': return !isClosed(plan) && (plan.status === 'idea' || plan.start_date === null);
    case 'preparing': return plan.status === 'preparing' || plan.status === 'ready';
    case 'soon': return !isClosed(plan) && plan.start_date !== null;
    case 'closed': return isClosed(plan);
  }
}

export function PlansPage() {
  const { data: plans = [], isPending, isError, refetch, isFetching } = usePlans();
  const { addPlan, confirmPlan } = usePlanMutations();
  const [filter, setFilter] = useState<Filter>('all');
  const [adding, setAdding] = useState(false);

  const sorted = useMemo(() => sortPlans(plans), [plans]);
  const soonest = useMemo(() => nextPlan(plans), [plans]);
  const counts = useMemo(() => {
    const c = {} as Record<Filter, number>;
    for (const f of FILTERS) c[f.value] = plans.filter((p) => matches(p, f.value)).length;
    return c;
  }, [plans]);

  // Найближчий уже стоїть акцентною карткою — у списку він не
  // повторюється. Та сама вада була в банері «найближчої події».
  const visible = sorted.filter((p) => matches(p, filter) && p.id !== soonest?.id);

  return (
    <section className="plans">
      <header className="plans-head">
        <div>
          <h1>Плани</h1>
          <p className="plans-sub">Що ми хочемо зробити разом</p>
        </div>
        <button type="button" className="btn" onClick={() => setAdding(true)}>
          <PlusIcon size={15} /> План
        </button>
      </header>

      {isPending ? (
        <p className="empty-state">Завантаження…</p>
      ) : isError ? (
        <div className="empty-state plans-error" role="alert">
          <p>Не вдалося завантажити плани.</p>
          <button type="button" className="btn" onClick={() => void refetch()} disabled={isFetching}>
            {isFetching ? 'Пробую…' : 'Спробувати ще'}
          </button>
        </div>
      ) : plans.length === 0 ? (
        <p className="empty-state">
          Планів ще немає. Натисни «+ План» і запиши першу спільну ідею.
        </p>
      ) : (
        <>
          {soonest && filter !== 'closed' && <NextPlanCard plan={soonest} />}

          <TabBar<Filter>
            variant="scroll"
            value={filter}
            onChange={setFilter}
            items={FILTERS.map((f) => ({ value: f.value, label: f.label, count: counts[f.value] }))}
          />

          {visible.length === 0 ? (
            <p className="empty-state">
              {filter === 'all' ? 'Більше планів немає.' : 'У цій добірці поки порожньо.'}
            </p>
          ) : (
            <div className="plan-list">
              {visible.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  onConfirm={(id) => confirmPlan.mutate(id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {adding && (
        <AddPlanModal
          busy={addPlan.isPending}
          onClose={() => setAdding(false)}
          onSubmit={(input) => addPlan.mutate(input)}
        />
      )}
    </section>
  );
}
