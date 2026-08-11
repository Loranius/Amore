// ============================================================
// «Плани» — об'єднаний модуль: події пари й календар з планами.
// ------------------------------------------------------------
// Власник звів два модулі в один: «об'єднати плани і календар. На один модуль
// буде менше». Верхня панель — та сама скляна панель вкладок, що у вішліста, і
// вкладок рівно дві:
//
//   Події    — «Наш шлях» із календаря. Саме ці події живлять кристал, і
//              функціонал лишився той самий.
//   Календар — місяць першим екраном, під ним плани плитками у два стовпці.
//
// **Що зникло, і чому саме це.** Вкладка «Дні народження» — самі дати лишились
// подіями й видно їх у сітці, а окремий список під них дублював календар.
// Перемикач виглядів (список / місяць / рік) — дві вкладки нагорі і Є
// перемикачем, а третій поверх перемикачів робив би з екрана панель керування.
// Решта кнопок у верхньому куті: лишилась одна дія, і вона йде за вкладкою.
//
// **Дані не змінились.** Ті самі запити, мутації й типи; об'єднання — це
// маршрут і композиція. Кристал так само росте з подій пари.
// ============================================================
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PlusIcon } from '@/components/icons/UiIcon';
import { useWorldVisibleRoute } from '@/features/world/useWorldVisibleRoute';
import { useArtifactWorld } from '@/features/world/artifactWorldContext';
import { useDimmedWorld } from '@/features/world/worldDim';
import { currentYearMonth, stepMonth } from '@/features/_shared/month';
import { useCalendarMutations, useEvents } from '@/features/calendar/useCalendar';
import { enrichEvent, sortEnriched } from '@/features/calendar/calendarUtils';
import { CalendarMonthView } from '@/features/calendar/CalendarViews';
import { RelationshipJourney } from '@/features/calendar/RelationshipJourney';
import { AddEventModal } from '@/features/calendar/AddEventModal';
import { AddPlanModal } from './AddPlanModal';
import { PlanTile } from './PlanTile';
import { groupPlans } from './planGroups';
import { usePlanMutations, usePlans } from './usePlans';
import '@/features/world/worldDim.css';
import './plans.css';
import './plansModule.css';
import type { EventRow, EventType } from '@/types';

/** Розділ модуля. Календар перший: власник просив, щоб його бачили одразу. */
type Section = 'calendar' | 'events';

/**
 * Подія, яку тут заводять, — це подія пари.
 *
 * Дні народження лишаються окремим типом і живуть у сітці, але створює їх та
 * сама форма: тип обирають у ній, а не вкладкою нагорі.
 */
type EventKind = Extract<EventType, 'anniversary' | 'birthday'>;

type EventModal = { row: EventRow | null; date?: string | undefined; type: EventKind } | null;

function requestedSection(value: string | null): Section {
  return value === 'events' ? 'events' : 'calendar';
}

export function PlansPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Модуль впускає світ, як вішліст: сцена лишається фоном, дотики — сторінці.
  const { webglSupported } = useArtifactWorld();
  const worldVisible = webglSupported;
  useWorldVisibleRoute();
  useDimmedWorld(worldVisible);

  // Розділ живе в адресі, і ТІЛЬКИ в ній.
  //
  // Спершу він був станом, який ефект відображав в адресу, — і це давало
  // тиху ваду: посилання `?tab=events` спрацьовувало лише при монтуванні.
  // Відкрий його, стоячи вже на «Планах», — і ефект миттєво переписував
  // адресу зі свого стану, тобто повертав календар. Виміряно на живому
  // порталі: два переходи в одному сеансі, і другий показував не те, що
  // просили.
  const section = requestedSection(searchParams.get('tab'));
  const setSection = (next: Section) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'calendar') params.delete('tab');
    else params.set('tab', next);
    setSearchParams(params, { replace: true });
  };
  const [{ yr, mo }, setYm] = useState(currentYearMonth);
  const [addingPlan, setAddingPlan] = useState(false);
  const [createdPlanId, setCreatedPlanId] = useState<number | null>(null);
  const [eventModal, setEventModal] = useState<EventModal>(null);
  const [showClosed, setShowClosed] = useState(false);

  const plansQuery = usePlans();
  const eventsQuery = useEvents();
  const { addPlan, confirmPlan } = usePlanMutations();
  const { addEvent, updateEvent } = useCalendarMutations();

  const plans = useMemo(() => plansQuery.data ?? [], [plansQuery.data]);
  const events = useMemo(() => eventsQuery.data ?? [], [eventsQuery.data]);

  // Старі holiday-рядки лишаються в базі, але особистим календарем пари не є.
  const personal = useMemo(
    () => events.filter((event) => event.type === 'anniversary' || event.type === 'birthday'),
    [events],
  );
  const enriched = useMemo(() => personal.map(enrichEvent).sort(sortEnriched), [personal]);
  const journeyEvents = useMemo(
    () => personal.filter((event) => event.type === 'anniversary'),
    [personal],
  );

  const groups = useMemo(() => groupPlans(plans), [plans]);
  const activeCount = groups.upcoming.length + groups.ideas.length;

  const openNewEvent = (type: EventKind = 'anniversary', date?: string) => {
    setEventModal({ row: null, type, date });
  };

  const openExistingEvent = (event: EventRow) => {
    setEventModal({ row: event, type: event.type === 'birthday' ? 'birthday' : 'anniversary' });
  };

  const closeAddPlan = () => {
    if (addPlan.isPending) return;
    setAddingPlan(false);
    setCreatedPlanId(null);
  };

  const busy = plansQuery.isPending || eventsQuery.isPending;
  const failed = plansQuery.isError || eventsQuery.isError;

  return (
    <section
      className="plans-module"
      data-world={worldVisible ? 'true' : undefined}
      data-section={section}
    >
      <div className="pm-tabs" role="tablist" aria-label="Розділи планів">
        <button
          type="button"
          role="tab"
          className="pm-tab"
          aria-selected={section === 'events'}
          onClick={() => setSection('events')}
        >
          Події <span className="pm-tab-count">{journeyEvents.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          className="pm-tab"
          aria-selected={section === 'calendar'}
          onClick={() => setSection('calendar')}
        >
          Календар <span className="pm-tab-count">{activeCount}</span>
        </button>
      </div>

      {failed ? (
        <div className="empty-state pm-error" role="alert">
          <p>Не вдалося завантажити плани й події.</p>
          <button
            type="button"
            className="btn"
            onClick={() => { void plansQuery.refetch(); void eventsQuery.refetch(); }}
          >
            Спробувати ще
          </button>
        </div>
      ) : busy ? (
        <div className="pm-sheet" aria-busy="true">
          <div className="pm-skeleton pm-skeleton--month" />
          <div className="pm-tiles">
            <div className="pm-skeleton pm-skeleton--tile" />
            <div className="pm-skeleton pm-skeleton--tile" />
          </div>
        </div>
      ) : section === 'calendar' ? (
        <div className="pm-sheet">
          <CalendarMonthView
            events={personal}
            plans={plans}
            yr={yr}
            mo={mo}
            onStepMonth={(delta) => setYm(stepMonth(yr, mo, delta))}
            onGoToday={() => setYm(currentYearMonth())}
            onAddOn={(date) => openNewEvent('anniversary', date)}
            onOpenEvent={(event) => openExistingEvent(
              enriched.find((item) => item.id === event.id) ?? event,
            )}
            onOpenPlan={(id) => navigate(`/plans/${id}`)}
          />

          <PlanSection
            title="Найближчі плани"
            note={`${groups.upcoming.length}`}
            plans={groups.upcoming}
            onConfirm={(id) => confirmPlan.mutate(id)}
            empty="Жодного плану з датою. Додайте перший — він одразу стане в сітці вище."
          />

          <PlanSection
            title="Ідеї без дати"
            note="колись"
            plans={groups.ideas}
            onConfirm={(id) => confirmPlan.mutate(id)}
            empty="Ідей поки немає."
          />

          {groups.closed.length > 0 && (
            <>
              <button
                type="button"
                className="pm-section-toggle"
                aria-expanded={showClosed}
                onClick={() => setShowClosed((current) => !current)}
              >
                Завершені <span>{groups.closed.length}</span>
              </button>
              {showClosed && (
                <div className="pm-tiles">
                  {groups.closed.map((plan) => <PlanTile key={plan.id} plan={plan} />)}
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="pm-sheet pm-sheet--journey">
          <RelationshipJourney
            events={journeyEvents}
            onOpen={openExistingEvent}
            onAdd={() => openNewEvent('anniversary')}
          />
        </div>
      )}

      <button
        type="button"
        className="pm-fab"
        onClick={() => (section === 'calendar' ? setAddingPlan(true) : openNewEvent('anniversary'))}
      >
        <PlusIcon size={17} />
        {section === 'calendar' ? 'План' : 'Подія'}
      </button>

      {addingPlan && (
        <AddPlanModal
          busy={addPlan.isPending}
          createdPlanId={createdPlanId}
          onClose={closeAddPlan}
          onSubmit={(input) => addPlan.mutate(input, {
            onSuccess: (plan) => setCreatedPlanId(plan.id),
          })}
          onContinue={(id) => { closeAddPlan(); navigate(`/plans/${id}`); }}
        />
      )}

      {eventModal && (
        <AddEventModal
          event={eventModal.row}
          initialDate={eventModal.date}
          initialType={eventModal.type}
          onClose={() => setEventModal(null)}
          onSubmit={(input) => {
            if (eventModal.row) updateEvent.mutate({ id: eventModal.row.id, input });
            else addEvent.mutate(input);
          }}
        />
      )}
    </section>
  );
}

function PlanSection({ title, note, plans, onConfirm, empty }: {
  title: string;
  note: string;
  plans: readonly import('@/types').PlanRow[];
  onConfirm: (id: number) => void;
  empty: string;
}) {
  return (
    <>
      <div className="pm-section-head">
        <h2>{title}</h2>
        <span>{note}</span>
      </div>
      {plans.length === 0 ? (
        <p className="pm-section-empty">{empty}</p>
      ) : (
        <div className="pm-tiles">
          {plans.map((plan) => <PlanTile key={plan.id} plan={plan} onConfirm={onConfirm} />)}
        </div>
      )}
    </>
  );
}
