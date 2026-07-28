// ============================================================
// «Плани» — карта спільного шляху.
// ------------------------------------------------------------
// Головний екран не намагається бути таблицею керування. Датовані плани
// стають точками маршруту, ідеї без дати лежать окремо, а завершене
// ховається у «пройдений шлях». Уся складна робота лишається всередині
// конкретного плану.
// ============================================================
import { useMemo, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PlusIcon } from '@/components/icons/UiIcon';
import { HeartIcon } from '@/components/icons/NavIcon';
import { pluralUA } from '@/lib/utils';
import { usePlanMutations, usePlans } from './usePlans';
import { isClosed, nextPlan, planDateLabel, sortPlans } from './planModel';
import { PLAN_CATEGORIES, PLAN_STATUSES } from './planConstants';
import { AddPlanModal } from './AddPlanModal';
import './plans.css';
import './plansJourney.css';
import type { PlanRow } from '@/types';

const ROUTE_ROW_HEIGHT = 166;
const IDEAS_PREVIEW_LIMIT = 6;

interface JourneyPath {
  height: number;
  d: string;
}

/**
 * SVG тягнеться разом із картою, а точки чергуються між правою і лівою
 * частиною екрана. Шлях генерується від кількості планів, тому не має
 * обмеження на довжину й не потребує окремої розкладки для кожного набору.
 */
function journeyPath(count: number): JourneyPath {
  const rows = Math.max(count, 1);
  const height = rows * ROUTE_ROW_HEIGHT + 110;
  const points = [{ x: 50, y: 0 }];

  for (let index = 0; index < count; index += 1) {
    points.push({
      x: index % 2 === 0 ? 72 : 28,
      y: ROUTE_ROW_HEIGHT / 2 + index * ROUTE_ROW_HEIGHT,
    });
  }

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

function JourneyStop({
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
  const { data: plans = [], isPending, isError, refetch, isFetching } = usePlans();
  const { addPlan, confirmPlan } = usePlanMutations();
  const [adding, setAdding] = useState(false);
  const [createdPlanId, setCreatedPlanId] = useState<number | null>(null);
  const [showAllIdeas, setShowAllIdeas] = useState(false);

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
  const route = useMemo(() => journeyPath(dated.length), [dated.length]);
  const visibleIdeas = showAllIdeas ? ideas : ideas.slice(0, IDEAS_PREVIEW_LIMIT);
  const activeCount = dated.length + ideas.length;

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

  return (
    <section className="plans">
      <header className="plan-journey-hero">
        <div className="plan-journey-hero-copy">
          <span className="plan-journey-eyebrow">Карта спільного шляху</span>
          <h1>Наші плани</h1>
          <p>Те, що вже стало частиною вашої історії, і пригоди, які ще попереду.</p>
          {!isPending && !isError && (
            <span className="plan-journey-count">
              {activeCount} {pluralUA(activeCount, ['план попереду', 'плани попереду', 'планів попереду'])}
            </span>
          )}
        </div>

        <button type="button" className="btn plan-journey-add" onClick={openAdd}>
          <PlusIcon size={15} /> План
        </button>
      </header>

      {isPending ? (
        <p className="empty-state">Завантаження маршруту…</p>
      ) : isError ? (
        <div className="empty-state plans-error" role="alert">
          <p>Не вдалося завантажити карту планів.</p>
          <button type="button" className="btn" onClick={() => void refetch()} disabled={isFetching}>
            {isFetching ? 'Пробую…' : 'Спробувати ще'}
          </button>
        </div>
      ) : (
        <>
          <section className="plan-journey-shell" aria-label="Маршрут майбутніх планів">
            <JourneyFog edge="top" />

            <header className="plan-journey-origin">
              <span className="plan-journey-origin-mark" aria-hidden="true">
                <HeartIcon size={24} />
              </span>
              <small>Початок маршруту</small>
              <strong>Все почалося тут</strong>
              <p>Перша точка вашої спільної історії, з якої дорога веде далі.</p>
            </header>

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

              {dated.length === 0 ? (
                <div className="plan-journey-empty">
                  <strong>Перша зупинка ще не нанесена</strong>
                  <p>Додайте план із датою — і стежка відкриє наступну точку маршруту.</p>
                </div>
              ) : (
                <div className="plan-journey-stops">
                  {dated.map((plan, index) => (
                    <JourneyStop
                      key={plan.id}
                      plan={plan}
                      index={index}
                      current={plan.id === soonest?.id}
                      onConfirm={confirm}
                    />
                  ))}
                </div>
              )}
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
    </section>
  );
}
