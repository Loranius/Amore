// ============================================================
// «Плани» — огляд спільних задумів.
// ------------------------------------------------------------
// Головний екран відповідає лише на три питання: що найближче, які три
// плани йдуть далі та які ідеї ще не мають дати. Повні списки відкриваються
// окремим bottom sheet і не перевантажують мобільний екран.
// ============================================================
import { useMemo, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CalendarIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CloseIcon,
  PlusIcon,
} from '@/components/icons/UiIcon';
import { pluralUA } from '@/lib/utils';
import { AddPlanModal } from './AddPlanModal';
import { NextPlanCard } from './NextPlanCard';
import { PlanCard } from './PlanCard';
import { PLAN_CATEGORIES } from './planConstants';
import { usePlanMutations, usePlans } from './usePlans';
import { isClosed, nextPlan, planDateLabel, sortPlans } from './planModel';
import './plans.css';
import './plansOverview.css';
import type { PlanRow } from '@/types';

const UPCOMING_PREVIEW = 3;
const IDEAS_PREVIEW = 3;

type OverviewSheet = 'upcoming' | 'ideas' | null;

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
  const [closedOpen, setClosedOpen] = useState(false);
  const [sheet, setSheet] = useState<OverviewSheet>(null);

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

  const visibleUpcoming = upcoming.slice(0, UPCOMING_PREVIEW);
  const visibleIdeas = ideas.slice(0, IDEAS_PREVIEW);

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
        <div className="plans-overview-hero-copy">
          <span className="plans-overview-eyebrow">Разом попереду</span>
          <h1>Плани</h1>
          <p>Зберігайте спільні ідеї, обирайте дату й поступово перетворюйте їх на справжні моменти.</p>
        </div>
        <button type="button" className="btn plans-overview-add" onClick={openAdd}>
          <PlusIcon size={18} />
          <span>Додати</span>
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
              <header className="plans-widget-heading plans-widget-heading--nearest">
                <h2 id="plans-nearest-title">Найближче</h2>
              </header>
              <NextPlanCard plan={nearest} />
            </section>
          )}

          {upcoming.length > 0 && (
            <section className="plans-overview-section" aria-labelledby="plans-upcoming-title">
              <header className="plans-widget-heading">
                <div>
                  <h2 id="plans-upcoming-title">Попереду</h2>
                  <p>Три найближчі плани після головного.</p>
                </div>
                {upcoming.length > UPCOMING_PREVIEW ? (
                  <button type="button" className="plans-widget-all" onClick={() => setSheet('upcoming')}>
                    Усі плани <ChevronRightIcon size={15} />
                  </button>
                ) : (
                  <span className="plans-widget-count">
                    {upcoming.length} {pluralUA(upcoming.length, ['план', 'плани', 'планів'])}
                  </span>
                )}
              </header>

              <div className="plans-upcoming-grid">
                {visibleUpcoming.map((plan) => <UpcomingPlanTile key={plan.id} plan={plan} />)}
              </div>
            </section>
          )}

          <section className="plans-overview-section plans-overview-ideas" aria-labelledby="plans-ideas-title">
            <header className="plans-widget-heading plans-widget-heading--ideas">
              <div>
                <h2 id="plans-ideas-title">Ідеї без дати</h2>
                <p>Легкі задуми, які ще не треба планувати детально.</p>
              </div>
              {ideas.length > IDEAS_PREVIEW && (
                <button type="button" className="plans-widget-all" onClick={() => setSheet('ideas')}>
                  Усі ідеї <ChevronRightIcon size={15} />
                </button>
              )}
            </header>

            <div className="plans-idea-rail">
              {visibleIdeas.map((plan) => <IdeaChip key={plan.id} plan={plan} />)}
              <button type="button" className="plans-idea-chip plans-idea-chip--add" onClick={openAdd}>
                <PlusIcon size={19} />
                <span>Додати ідею</span>
              </button>
            </div>
          </section>

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
                <span className="plans-overview-closed-tail">
                  <b>{closed.length}</b>
                  <ChevronDownIcon size={18} />
                </span>
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

      {sheet && (
        <PlansOverviewSheet
          kind={sheet}
          plans={sheet === 'upcoming' ? upcoming : ideas}
          onClose={() => setSheet(null)}
          onConfirm={(id) => confirmPlan.mutate(id)}
        />
      )}
    </section>
  );
}

function UpcomingPlanTile({ plan }: { plan: PlanRow }) {
  const category = PLAN_CATEGORIES[plan.category];
  const date = planDateLabel(plan);
  const style = { '--plan-accent': category.color } as CSSProperties;

  return (
    <article className="plans-upcoming-tile" style={style}>
      <Link className="plans-upcoming-tile-open" to={`/plans/${plan.id}`} aria-label={`Відкрити план «${plan.title}»`} />
      <span className={`plans-upcoming-media${plan.cover_url ? ' plans-upcoming-media--photo' : ''}`} aria-hidden={!plan.cover_url}>
        {plan.cover_url ? (
          <img src={plan.cover_url} alt="" loading="lazy" decoding="async" fetchPriority="low" />
        ) : (
          <category.Icon size={30} />
        )}
      </span>
      <span className="plans-upcoming-category">
        <category.Icon size={12} />
        {category.label}
      </span>
      <strong>{plan.title}</strong>
      {date && (
        <span className="plans-upcoming-date">
          <CalendarIcon size={13} />
          {date}
        </span>
      )}
    </article>
  );
}

function IdeaChip({ plan }: { plan: PlanRow }) {
  const category = PLAN_CATEGORIES[plan.category];
  const style = { '--plan-accent': category.color } as CSSProperties;

  return (
    <Link className="plans-idea-chip" style={style} to={`/plans/${plan.id}`}>
      <span aria-hidden="true"><category.Icon size={20} /></span>
      <strong>{plan.title}</strong>
    </Link>
  );
}

function PlansOverviewSheet({
  kind,
  plans,
  onClose,
  onConfirm,
}: {
  kind: Exclude<OverviewSheet, null>;
  plans: PlanRow[];
  onClose: () => void;
  onConfirm: (id: number) => void;
}) {
  const title = kind === 'upcoming' ? 'Усі плани попереду' : 'Усі ідеї без дати';
  const eyebrow = kind === 'upcoming' ? 'Заплановано' : 'Ще без дати';

  return (
    <div
      className="modal-overlay plans-overview-sheet-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="modal-sheet plans-overview-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="plans-overview-sheet-title"
      >
        <header>
          <div>
            <small>{eyebrow}</small>
            <h2 id="plans-overview-sheet-title">{title}</h2>
            <p>{plans.length} {pluralUA(plans.length, ['план', 'плани', 'планів'])}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Закрити список">
            <CloseIcon size={20} />
          </button>
        </header>
        <div className="plan-list plans-overview-sheet-list">
          {plans.map((plan) => <PlanCard key={plan.id} plan={plan} onConfirm={onConfirm} />)}
        </div>
      </section>
    </div>
  );
}

function PlansOverviewSkeleton() {
  return (
    <div className="plans-overview-skeleton" aria-hidden="true">
      <span className="plans-overview-skeleton-featured" />
      <span />
      <span />
    </div>
  );
}
