// ============================================================
// «Плани» — карта спільного шляху.
// ------------------------------------------------------------
// Календарні річниці й великі події показують уже пройдений шлях,
// «Ви тут» відділяє минуле від майбутнього, а датовані плани та майбутні
// віхи продовжують ту саму стежку. Дані не дублюються між модулями.
// ============================================================
import { useMemo, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { EventIcon } from '@/components/icons/EventIcon';
import { PlusIcon } from '@/components/icons/UiIcon';
import { HeartIcon } from '@/components/icons/NavIcon';
import { pluralUA } from '@/lib/utils';
import { useConfirm } from '@/providers/ConfirmProvider';
import { useCalendarMutations, useEvents } from '@/features/calendar/useCalendar';
import type { NewEventInput } from '@/features/calendar/useCalendar';
import { usePlanMutations, usePlans } from './usePlans';
import { isClosed, nextPlan, planDateLabel, sortPlans } from './planModel';
import { PLAN_CATEGORIES, PLAN_STATUSES } from './planConstants';
import { AddPlanModal } from './AddPlanModal';
import { AddMilestoneModal } from './AddMilestoneModal';
import './plans.css';
import './plansJourney.css';
import './plansMilestones.css';
import type { EventRow, PlanRow } from '@/types';

const ROUTE_ROW_HEIGHT = 166;
const IDEAS_PREVIEW_LIMIT = 6;
const MILESTONE_ACCENT = '#c77a98';
const IMPORTANT_MILESTONE_ACCENT = '#bd5f84';

interface JourneyPath {
  height: number;
  d: string;
}

type FutureJourneyItem =
  | { kind: 'milestone'; date: string; event: EventRow }
  | { kind: 'plan'; date: string; plan: PlanRow };

function localDateKey(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function milestoneDateLabel(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function relationshipMoment(event: EventRow): boolean {
  return event.type === 'anniversary' || event.is_milestone;
}

function routeNodeX(index: number): number {
  return index % 2 === 0 ? 72 : 28;
}

/**
 * Точки можуть бути ліворуч, праворуч або по центру («Ви тут»), тому
 * шлях будується з готового масиву X-координат, а не лише з кількості.
 */
function journeyPath(nodeXs: number[]): JourneyPath {
  const rows = Math.max(nodeXs.length, 1);
  const height = rows * ROUTE_ROW_HEIGHT + 110;
  const points = [{ x: 50, y: 0 }];

  nodeXs.forEach((x, index) => {
    points.push({ x, y: ROUTE_ROW_HEIGHT / 2 + index * ROUTE_ROW_HEIGHT });
  });
  points.push({ x: 50, y: height });

  let d = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]!;
    const current = points[index]!;
    const middleY = (previous.y + current.y) / 2;
    d += ` C ${previous.x} ${middleY}, ${current.x} ${middleY}, ${current.x} ${current.y}`;
  }

  return { height, d };
}

function JourneyFog({ edge }: { edge: 'top' | 'bottom' }) {
  return (
    <div className={`plan-journey-fog plan-journey-fog--${edge}`} aria-hidden="true">
      <span className="plan-journey-cloud" />
      <span className="plan-journey-cloud" />
      <span className="plan-journey-cloud" />
    </div>
  );
}

function JourneyPlanStop({
  plan,
  index,
  current,
  onConfirm,
}: {
  plan: PlanRow;
  index: number;
  current: boolean;
  onConfirm: (id: number) => void;
}) {
  const category = PLAN_CATEGORIES[plan.category];
  const status = PLAN_STATUSES[plan.status];
  const date = planDateLabel(plan);
  const side = index % 2 === 0 ? 'left' : 'right';
  const style = { '--plan-journey-accent': category.color } as CSSProperties;

  return (
    <div
      className={`plan-journey-stop plan-journey-stop--${side}${current ? ' plan-journey-stop--current' : ''}`}
      style={style}
    >
      <span className="plan-journey-marker" aria-hidden="true">
        <category.Icon size={18} />
      </span>

      <article className="plan-journey-card">
        <Link
          className="plan-journey-card-open"
          to={`/plans/${plan.id}`}
          aria-label={`Відкрити план «${plan.title}»`}
        />

        {current && <span className="plan-journey-card-kicker">Наступна зупинка</span>}
        {!plan.confirmed && <span className="plan-journey-card-kicker">Запропоновано</span>}

        <strong>{plan.title}</strong>
        <span className="plan-journey-card-meta">
          {date && <span>{date}</span>}
          {plan.location_name && <span>{plan.location_name}</span>}
        </span>

        {current && <span className="plan-journey-card-note">{status.label}</span>}

        {!plan.confirmed && (
          <button
            type="button"
            className="plan-journey-confirm"
            onClick={() => onConfirm(plan.id)}
          >
            Підтвердити
          </button>
        )}
      </article>
    </div>
  );
}

function JourneyMilestone({
  event,
  index,
  future,
  onOpen,
}: {
  event: EventRow;
  index: number;
  future: boolean;
  onOpen: (event: EventRow) => void;
}) {
  const side = index % 2 === 0 ? 'left' : 'right';
  const accent = event.is_milestone ? IMPORTANT_MILESTONE_ACCENT : MILESTONE_ACCENT;
  const style = { '--plan-journey-accent': accent } as CSSProperties;

  return (
    <div
      className={`plan-journey-stop plan-journey-stop--${side} plan-journey-stop--milestone${event.is_milestone ? ' plan-journey-stop--milestone-important' : ''}`}
      style={style}
    >
      <span className="plan-journey-marker" aria-hidden="true">
        <EventIcon type={event.type ?? 'anniversary'} size={18} />
      </span>

      <article className="plan-journey-card">
        <button
          type="button"
          className="plan-journey-card-open plan-journey-card-open--button"
          onClick={() => onOpen(event)}
          aria-label={`Відкрити віху «${event.title}»`}
        />
        <span className="plan-journey-card-kicker">
          {future ? 'Попереду' : event.is_milestone ? 'Велика віха' : 'Наша історія'}
        </span>
        <strong>{event.title}</strong>
        <span className="plan-journey-card-meta">
          <span>{milestoneDateLabel(event.date)}</span>
          {event.yearly && <span>щороку</span>}
        </span>
        {event.description && <span className="plan-journey-card-description">{event.description}</span>}
      </article>
    </div>
  );
}

function JourneyNow() {
  return (
    <div className="plan-journey-now" aria-label="Поточна точка маршруту">
      <span className="plan-journey-marker" aria-hidden="true"><HeartIcon size={20} /></span>
      <span className="plan-journey-now-copy">
        <small>Сьогодні</small>
        <strong>Ви тут</strong>
      </span>
    </div>
  );
}

function IdeaNote({ plan, onConfirm }: { plan: PlanRow; onConfirm: (id: number) => void }) {
  const category = PLAN_CATEGORIES[plan.category];
  const style = { '--plan-note-accent': category.color } as CSSProperties;

  return (
    <article className="plan-idea-note" style={style}>
      <Link
        className="plan-idea-open"
        to={`/plans/${plan.id}`}
        aria-label={`Відкрити ідею «${plan.title}»`}
      />
      <span className="plan-idea-icon" aria-hidden="true"><category.Icon size={15} /></span>
      <strong>{plan.title}</strong>
      {plan.description && <small>{plan.description}</small>}
      {!plan.confirmed && (
        <button type="button" className="plan-idea-confirm" onClick={() => onConfirm(plan.id)}>
          Підтвердити
        </button>
      )}
    </article>
  );
}

export function PlansPage() {
  const navigate = useNavigate();
  const confirmDialog = useConfirm();
  const {
    data: plans = [],
    isPending: plansPending,
    isError: plansError,
    refetch: refetchPlans,
    isFetching: plansFetching,
  } = usePlans();
  const {
    data: events = [],
    isPending: eventsPending,
    isError: eventsError,
    refetch: refetchEvents,
    isFetching: eventsFetching,
  } = useEvents();
  const { addPlan, confirmPlan } = usePlanMutations();
  const { addEvent, updateEvent, deleteEvent } = useCalendarMutations();

  const [adding, setAdding] = useState(false);
  const [createdPlanId, setCreatedPlanId] = useState<number | null>(null);
  const [showAllIdeas, setShowAllIdeas] = useState(false);
  const [milestoneEditor, setMilestoneEditor] = useState<EventRow | 'new' | null>(null);

  const sorted = useMemo(() => sortPlans(plans), [plans]);
  const soonest = useMemo(() => nextPlan(plans), [plans]);
  const dated = useMemo(
    () => sorted.filter((plan) => !isClosed(plan) && plan.start_date !== null),
    [sorted],
  );
  const ideas = useMemo(
    () => sorted.filter((plan) => !isClosed(plan) && plan.start_date === null),
    [sorted],
  );
  const closed = useMemo(() => sorted.filter((plan) => isClosed(plan)), [sorted]);

  const today = localDateKey();
  const moments = useMemo(
    () => events
      .filter(relationshipMoment)
      .slice()
      .sort((left, right) => left.date.localeCompare(right.date) || left.id - right.id),
    [events],
  );
  const pastMoments = useMemo(
    () => moments.filter((event) => event.date <= today),
    [moments, today],
  );
  const origin = pastMoments[0] ?? null;
  const history = origin ? pastMoments.slice(1) : pastMoments;
  const futureMoments = useMemo(
    () => moments.filter((event) => event.date > today),
    [moments, today],
  );
  const futureItems = useMemo<FutureJourneyItem[]>(() => {
    const items: FutureJourneyItem[] = [
      ...futureMoments.map((event) => ({ kind: 'milestone' as const, date: event.date, event })),
      ...dated.map((plan) => ({ kind: 'plan' as const, date: plan.start_date!, plan })),
    ];
    return items.sort((left, right) => left.date.localeCompare(right.date) || left.kind.localeCompare(right.kind));
  }, [dated, futureMoments]);

  const routeXs = useMemo(() => {
    const xs = history.map((_event, index) => routeNodeX(index));
    xs.push(50);
    futureItems.forEach((_item, offset) => xs.push(routeNodeX(history.length + 1 + offset)));
    return xs;
  }, [futureItems, history]);
  const route = useMemo(() => journeyPath(routeXs), [routeXs]);

  const visibleIdeas = showAllIdeas ? ideas : ideas.slice(0, IDEAS_PREVIEW_LIMIT);
  const activeCount = dated.length + ideas.length;
  const journeyPending = plansPending || eventsPending;
  const journeyError = plansError || eventsError;
  const journeyFetching = plansFetching || eventsFetching;

  const confirm = (id: number) => confirmPlan.mutate(id);

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

  const openNewMilestone = () => {
    addEvent.reset();
    updateEvent.reset();
    deleteEvent.reset();
    setMilestoneEditor('new');
  };

  const openMilestone = (event: EventRow) => {
    addEvent.reset();
    updateEvent.reset();
    deleteEvent.reset();
    setMilestoneEditor(event);
  };

  const milestoneBusy = addEvent.isPending || updateEvent.isPending;
  const milestoneDeleting = deleteEvent.isPending;
  const currentMilestone = milestoneEditor === 'new' ? null : milestoneEditor;

  const closeMilestone = () => {
    if (milestoneBusy || milestoneDeleting) return;
    setMilestoneEditor(null);
  };

  const saveMilestone = (input: NewEventInput) => {
    if (milestoneEditor === 'new') {
      addEvent.mutate(input, { onSuccess: () => setMilestoneEditor(null) });
      return;
    }
    if (milestoneEditor) {
      updateEvent.mutate(
        { id: milestoneEditor.id, input },
        { onSuccess: () => setMilestoneEditor(null) },
      );
    }
  };

  const removeMilestone = async () => {
    if (!currentMilestone) return;
    if (await confirmDialog(`Видалити віху «${currentMilestone.title}» із календаря та карти?`)) {
      deleteEvent.mutate(currentMilestone.id, { onSuccess: () => setMilestoneEditor(null) });
    }
  };

  return (
    <section className="plans">
      <header className="plan-journey-hero">
        <div className="plan-journey-hero-copy">
          <span className="plan-journey-eyebrow">Карта стосунків</span>
          <h1>Наш шлях</h1>
          <p>Важливі моменти, точка, де ви зараз, і пригоди, які ще попереду.</p>
          {!journeyPending && !journeyError && (
            <div className="plan-journey-counts">
              <span className="plan-journey-count plan-journey-count--history">
                {moments.length} {pluralUA(moments.length, ['віха на карті', 'віхи на карті', 'віх на карті'])}
              </span>
              <span className="plan-journey-count">
                {activeCount} {pluralUA(activeCount, ['план попереду', 'плани попереду', 'планів попереду'])}
              </span>
            </div>
          )}
        </div>

        <div className="plan-journey-actions">
          <button type="button" className="plan-journey-add-milestone" onClick={openNewMilestone}>
            <HeartIcon size={14} /> Віха
          </button>
          <button type="button" className="btn plan-journey-add" onClick={openAdd}>
            <PlusIcon size={15} /> План
          </button>
        </div>
      </header>

      {journeyPending ? (
        <p className="empty-state">Завантаження маршруту…</p>
      ) : journeyError ? (
        <div className="empty-state plans-error" role="alert">
          <p>Не вдалося завантажити спільний шлях.</p>
          <button
            type="button"
            className="btn"
            onClick={() => void Promise.all([refetchPlans(), refetchEvents()])}
            disabled={journeyFetching}
          >
            {journeyFetching ? 'Пробую…' : 'Спробувати ще'}
          </button>
        </div>
      ) : (
        <>
          <section className="plan-journey-shell" aria-label="Карта спільного шляху">
            <JourneyFog edge="top" />

            {origin ? (
              <button
                type="button"
                className="plan-journey-origin plan-journey-origin--interactive"
                onClick={() => openMilestone(origin)}
                aria-label={`Відкрити початкову віху «${origin.title}»`}
              >
                <span className="plan-journey-origin-mark" aria-hidden="true">
                  <HeartIcon size={24} />
                </span>
                <small>Початок маршруту</small>
                <strong>{origin.title}</strong>
                <span className="plan-journey-origin-date">{milestoneDateLabel(origin.date)}</span>
                {origin.description && <p>{origin.description}</p>}
                <span className="plan-journey-origin-edit">Торкнися, щоб відкрити</span>
              </button>
            ) : (
              <header className="plan-journey-origin">
                <span className="plan-journey-origin-mark" aria-hidden="true">
                  <HeartIcon size={24} />
                </span>
                <small>Початок маршруту</small>
                <strong>Все почалося тут</strong>
                <p>Додайте першу важливу дату — і карта отримає справжній початок.</p>
              </header>
            )}

            <div className="plan-journey-route">
              <svg
                className="plan-journey-route-svg"
                viewBox={`0 0 100 ${route.height}`}
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path className="plan-journey-path-base" d={route.d} />
                <path className="plan-journey-path-dash" d={route.d} />
              </svg>

              <div className="plan-journey-stops">
                {history.map((event, index) => (
                  <JourneyMilestone
                    key={`milestone-${event.id}`}
                    event={event}
                    index={index}
                    future={false}
                    onOpen={openMilestone}
                  />
                ))}

                <JourneyNow />

                {futureItems.map((item, offset) => {
                  const index = history.length + 1 + offset;
                  return item.kind === 'milestone' ? (
                    <JourneyMilestone
                      key={`milestone-${item.event.id}`}
                      event={item.event}
                      index={index}
                      future
                      onOpen={openMilestone}
                    />
                  ) : (
                    <JourneyPlanStop
                      key={`plan-${item.plan.id}`}
                      plan={item.plan}
                      index={index}
                      current={item.plan.id === soonest?.id}
                      onConfirm={confirm}
                    />
                  );
                })}
              </div>
            </div>

            <JourneyFog edge="bottom" />
            <footer className="plan-journey-future">
              <strong>Далі шлях ховається в тумані</strong>
              <p>Майбутнє ще не нанесене на карту — нова пригода може початися з однієї ідеї.</p>
              <button type="button" className="btn" onClick={openAdd}>
                <PlusIcon size={14} /> Відкрити нову точку
              </button>
            </footer>
          </section>

          {ideas.length > 0 && (
            <section className="plan-idea-cove" aria-labelledby="plan-ideas-title">
              <header className="plan-section-head">
                <div>
                  <h2 id="plan-ideas-title">Ще не нанесено на карту</h2>
                  <p>Ідеї без дати чекають, коли ви визначите для них місце на маршруті.</p>
                </div>
                <span className="plan-section-count">{ideas.length}</span>
              </header>

              <div className="plan-idea-grid">
                {visibleIdeas.map((plan) => (
                  <IdeaNote key={plan.id} plan={plan} onConfirm={confirm} />
                ))}
              </div>

              {ideas.length > IDEAS_PREVIEW_LIMIT && (
                <button
                  type="button"
                  className="plan-idea-more"
                  onClick={() => setShowAllIdeas((current) => !current)}
                >
                  {showAllIdeas ? 'Згорнути ідеї' : `Показати ще ${ideas.length - IDEAS_PREVIEW_LIMIT}`}
                </button>
              )}
            </section>
          )}

          {closed.length > 0 && (
            <details className="plan-journey-archive">
              <summary>
                <span className="plan-journey-archive-title">
                  <small>Позаду</small>
                  <strong>Пройдений шлях</strong>
                </span>
                <span className="plan-journey-archive-count">{closed.length}</span>
              </summary>

              <div className="plan-journey-archive-list">
                {closed.map((plan) => {
                  const category = PLAN_CATEGORIES[plan.category];
                  const status = PLAN_STATUSES[plan.status];
                  const date = planDateLabel(plan);
                  const style = { '--archive-accent': category.color } as CSSProperties;

                  return (
                    <Link
                      key={plan.id}
                      className="plan-journey-archive-item"
                      to={`/plans/${plan.id}`}
                      style={style}
                    >
                      <span className="plan-journey-archive-icon" aria-hidden="true">
                        <category.Icon size={15} />
                      </span>
                      <span className="plan-journey-archive-copy">
                        <strong>{plan.title}</strong>
                        <small>{[status.label, date].filter(Boolean).join(' · ')}</small>
                      </span>
                    </Link>
                  );
                })}
              </div>
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

      {milestoneEditor && (
        <AddMilestoneModal
          key={milestoneEditor === 'new' ? 'new' : milestoneEditor.id}
          event={currentMilestone}
          busy={milestoneBusy}
          deleting={milestoneDeleting}
          onClose={closeMilestone}
          onSubmit={saveMilestone}
          onDelete={currentMilestone ? () => void removeMilestone() : undefined}
        />
      )}
    </section>
  );
}
