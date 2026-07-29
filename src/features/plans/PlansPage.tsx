// ============================================================
// «Плани» — огляд спільних задумів.
// ------------------------------------------------------------
// Тут живе лише те, що пара хоче зробити разом: побачення, подорожі,
// поїздки, місця й активності. Річниці, дні народження та інші календарні
// події належать календарю й не змішуються з підготовкою планів.
// ============================================================
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusIcon } from '@/components/icons/UiIcon';
import { pluralUA } from '@/lib/utils';
import { AddPlanModal } from './AddPlanModal';
import { NextPlanCard } from './NextPlanCard';
import { PlanCard } from './PlanCard';
import { usePlanMutations, usePlans } from './usePlans';
import { isClosed, nextPlan, sortPlans } from './planModel';
import './plans.css';
import './plansOverview.css';

const LIST_PREVIEW = 6;

export function PlansPage() {
  const navigate = useNavigate();
  const {
    data: plans = [],
    isPending,
    isError,
    isFetching,
    refetch,
  } = usePlans();
  const { addPlan, confirmPlan } = usePlanMutations();

  const [adding, setAdding] = useState(false);
  const [createdPlanId, setCreatedPlanId] = useState<number | null>(null);
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const [showAllIdeas, setShowAllIdeas] = useState(false);
  const [closedOpen, setClosedOpen] = useState(false);

  const sorted = useMemo(() => sortPlans(plans), [plans]);
  const nearest = useMemo(() => nextPlan(plans), [plans]);
  const active = useMemo(() => sorted.filter((plan) => !isClosed(plan)), [sorted]);
  const upcoming = useMemo(
    () => active.filter((plan) => plan.start_date !== null && plan.id !== nearest?.id),
    [active, nearest?.id],
  );
  const ideas = useMemo(
    () => active.filter((plan) => plan.start_date === null),
    [active],
  );
  const closed = useMemo(() => sorted.filter(isClosed), [sorted]);

  const visibleUpcoming = showAllUpcoming ? upcoming : upcoming.slice(0, LIST_PREVIEW);
  const visibleIdeas = showAllIdeas ? ideas : ideas.slice(0, LIST_PREVIEW);

  const openAdd = () => {
    addPlan.reset();
    setCreatedPlanId(null);
    setAdding(true);
  };

  const closeAdd = () => {
    if (addPlan.isPending) return;
    setAdding(false);
    setCreatedPlanId(null);
  };

  return (
    <section className="plans plans-overview">
      <header className="plans-overview-hero">
        <div>
          <span className="plans-overview-eyebrow">Разом попереду</span>
          <h1>Плани</h1>
          <p>Зберігайте спільні ідеї, обирайте дату й поступово готуйтеся — без календарних свят і зайвої бюрократії.</p>
        </div>
        <button type="button" className="btn plans-overview-add" onClick={openAdd}>
          <PlusIcon size={16} /> Додати
        </button>
      </header>

      {isPending ? (
        <PlansOverviewSkeleton />
      ) : isError ? (
        <div className="empty-state plans-error" role="alert">
          <p>Не вдалося завантажити плани.</p>
          <button type="button" className="btn" disabled={isFetching} onClick={() => void refetch()}>
            {isFetching ? 'Пробую…' : 'Спробувати ще'}
          </button>
        </div>
      ) : plans.length === 0 ? (
        <section className="plans-overview-empty">
          <span aria-hidden="true">✦</span>
          <h2>Що зробимо разом?</h2>
          <p>Почніть із короткої ідеї. Дату, місце, бюджет і кроки можна додати пізніше.</p>
          <button type="button" className="btn" onClick={openAdd}>Додати перший план</button>
        </section>
      ) : (
        <>
          {nearest && (
            <section className="plans-overview-nearest" aria-labelledby="plans-nearest-title">
              <header className="plans-overview-section-head plans-overview-section-head--quiet">
                <div>
                  <span>Найближче</span>
                  <h2 id="plans-nearest-title">Наступний спільний план</h2>
                </div>
              </header>
              <NextPlanCard plan={nearest} />
            </section>
          )}

          {upcoming.length > 0 && (
            <PlanSection
              id="plans-upcoming-title"
              title="Попереду"
              copy="Плани, для яких уже визначили хоча б приблизний час."
              count={upcoming.length}
              plans={visibleUpcoming}
              onConfirm={(id) => confirmPlan.mutate(id)}
              moreLabel={showAllUpcoming ? 'Показати менше' : `Показати ще ${upcoming.length - visibleUpcoming.length}`}
              showMore={upcoming.length > LIST_PREVIEW}
              onMore={() => setShowAllUpcoming((value) => !value)}
            />
          )}

          {ideas.length > 0 && (
            <PlanSection
              id="plans-ideas-title"
              title="Ідеї без дати"
              copy="Те, що хочеться зробити разом, але ще не обов’язково планувати зараз."
              count={ideas.length}
              plans={visibleIdeas}
              onConfirm={(id) => confirmPlan.mutate(id)}
              moreLabel={showAllIdeas ? 'Показати менше' : `Показати ще ${ideas.length - visibleIdeas.length}`}
              showMore={ideas.length > LIST_PREVIEW}
              onMore={() => setShowAllIdeas((value) => !value)}
            />
          )}

          {closed.length > 0 && (
            <details
              className="plans-overview-closed"
              open={closedOpen}
              onToggle={(event) => setClosedOpen(event.currentTarget.open)}
            >
              <summary>
                <span>
                  <small>Не потребують уваги зараз</small>
                  <strong>Виконані, відкладені й скасовані</strong>
                </span>
                <b>{closed.length}</b>
              </summary>
              {closedOpen && (
                <div className="plan-list plans-overview-closed-list">
                  {closed.map((plan) => <PlanCard key={plan.id} plan={plan} />)}
                </div>
              )}
            </details>
          )}
        </>
      )}

      {adding && (
        <AddPlanModal
          busy={addPlan.isPending}
          createdPlanId={createdPlanId}
          onClose={closeAdd}
          onSubmit={(input) => addPlan.mutate(input, {
            onSuccess: (plan) => setCreatedPlanId(plan.id),
          })}
          onContinue={(id) => {
            setAdding(false);
            setCreatedPlanId(null);
            navigate(`/plans/${id}`);
          }}
        />
      )}
    </section>
  );
}

function PlanSection({
  id,
  title,
  copy,
  count,
  plans,
  onConfirm,
  showMore,
  moreLabel,
  onMore,
}: {
  id: string;
  title: string;
  copy: string;
  count: number;
  plans: ReturnType<typeof sortPlans>;
  onConfirm: (id: number) => void;
  showMore: boolean;
  moreLabel: string;
  onMore: () => void;
}) {
  return (
    <section className="plans-overview-section" aria-labelledby={id}>
      <header className="plans-overview-section-head">
        <div>
          <h2 id={id}>{title}</h2>
          <p>{copy}</p>
        </div>
        <span>{count} {pluralUA(count, ['план', 'плани', 'планів'])}</span>
      </header>
      <div className="plan-list">
        {plans.map((plan) => <PlanCard key={plan.id} plan={plan} onConfirm={onConfirm} />)}
      </div>
      {showMore && (
        <button type="button" className="plans-overview-more" onClick={onMore}>{moreLabel}</button>
      )}
    </section>
  );
}

function PlansOverviewSkeleton() {
  return (
    <div className="plans-overview-skeleton" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  );
}
