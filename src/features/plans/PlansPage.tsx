// ============================================================
// «Плани» — об'єднаний модуль: календар і плани пари.
// ------------------------------------------------------------
// У календарі живуть ДВІ різні сутності:
//   plan  — те, що пара збирається зробити; має статус, бюджет, задачі й
//           окрему плитку під календарем;
//   event — дата / свято / день народження; лишається позначкою в календарі
//           й отримує Telegram-нагадування, але НЕ стає планом.
//
// Вкладки «Події»/«Календар» тут більше немає. «Події» була входом лише в
// «Наш шлях» (anniversary) — і власник попросив прибрати проміжну зупинку:
// тепер сузір'я відкривається дотиком по лічильнику днів на головній
// (`Hero.tsx`), а модуль планів завжди показує календар одразу.
// Позначки типу anniversary в календарній сітці не зникли: тап по такій
// даті й далі відкриває редагування на місці — це вже не «Наш шлях», а
// звичайна календарна позначка, як день народження чи свято.
// ============================================================
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EventIcon } from '@/components/icons/EventIcon';
import { BulbIcon } from '@/components/icons/PlanIcon';
import { ChevronRightIcon, PlusIcon } from '@/components/icons/UiIcon';
import { useWorldVisibleRoute } from '@/features/world/useWorldVisibleRoute';
import { useArtifactWorld } from '@/features/world/artifactWorldContext';
import { useDimmedWorld } from '@/features/world/worldDim';
import { currentYearMonth, formatDateUA, stepMonth } from '@/features/_shared/month';
import { useCalendarMutations, useEvents } from '@/features/calendar/useCalendar';
import { enrichEvent, sortEnriched } from '@/features/calendar/calendarUtils';
import { CalendarMonthView } from '@/features/calendar/CalendarViews';
import { AddEventModal } from '@/features/calendar/AddEventModal';
import { AddPlanModal } from './AddPlanModal';
import { PlanTile } from './PlanTile';
import { groupPlans } from './planGroups';
import { usePlanMutations, usePlans } from './usePlans';
import '@/features/world/worldDim.css';
import './plans.css';
import './plansModule.css';
import type { EventRow, EventType } from '@/types';

type EventKind = Extract<EventType, 'anniversary' | 'birthday' | 'holiday'>;

type EventModal = {
  row: EventRow | null;
  date?: string | undefined;
  type: EventKind;
} | null;

export function PlansPage() {
  const navigate = useNavigate();

  // Модуль впускає світ, як вішліст: сцена лишається фоном, дотики — сторінці.
  const { webglSupported } = useArtifactWorld();
  const worldVisible = webglSupported;
  useWorldVisibleRoute();
  useDimmedWorld(worldVisible);

  const [{ yr, mo }, setYm] = useState(currentYearMonth);
  const [addingPlan, setAddingPlan] = useState(false);
  const [createdPlanId, setCreatedPlanId] = useState<number | null>(null);
  const [eventModal, setEventModal] = useState<EventModal>(null);
  const [createChooserOpen, setCreateChooserOpen] = useState(false);
  const [createChooserDate, setCreateChooserDate] = useState<string | null>(null);
  const [showClosed, setShowClosed] = useState(false);

  const plansQuery = usePlans();
  const eventsQuery = useEvents();
  const { addPlan, confirmPlan } = usePlanMutations();
  const { addEvent, updateEvent } = useCalendarMutations();

  const plans = useMemo(() => plansQuery.data ?? [], [plansQuery.data]);
  const events = useMemo(() => eventsQuery.data ?? [], [eventsQuery.data]);

  // Календар показує важливі моменти, дні народження й звичайні календарні
  // дати/свята. Вони всі живуть у `events`, тому ніколи не потрапляють у
  // PlanSection нижче.
  const calendarEvents = useMemo(
    () => events.filter((event) => (
      event.type === 'anniversary' || event.type === 'birthday' || event.type === 'holiday'
    )),
    [events],
  );
  const enriched = useMemo(
    () => calendarEvents.map(enrichEvent).sort(sortEnriched),
    [calendarEvents],
  );

  const groups = useMemo(() => groupPlans(plans), [plans]);

  const openNewEvent = (type: EventKind = 'holiday', date?: string) => {
    setEventModal({ row: null, type, date });
  };

  const openExistingEvent = (event: EventRow) => {
    const type: EventKind = event.type === 'birthday'
      ? 'birthday'
      : event.type === 'holiday'
        ? 'holiday'
        : 'anniversary';
    setEventModal({ row: event, type });
  };

  const openCalendarCreate = (date?: string) => {
    setCreateChooserDate(date ?? null);
    setCreateChooserOpen(true);
  };

  const closeCalendarCreate = () => {
    setCreateChooserOpen(false);
    setCreateChooserDate(null);
  };

  const choosePlan = () => {
    closeCalendarCreate();
    setAddingPlan(true);
  };

  const chooseCalendarEvent = () => {
    const date = createChooserDate ?? undefined;
    closeCalendarCreate();
    openNewEvent('holiday', date);
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
    >
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
      ) : (
        <div className="pm-sheet">
          <CalendarMonthView
            events={calendarEvents}
            plans={plans}
            yr={yr}
            mo={mo}
            onStepMonth={(delta) => setYm(stepMonth(yr, mo, delta))}
            onGoToday={() => setYm(currentYearMonth())}
            // Тап по конкретному дню передає дату в спільний вибір
            // «План / Подія». Якщо користувач обирає подію — дата вже стоїть.
            onAddOn={(date) => openCalendarCreate(date)}
            onOpenEvent={(event) => openExistingEvent(
              enriched.find((item) => item.id === event.id) ?? event,
            )}
            onOpenPlan={(id) => navigate(`/plans/${id}`)}
          />

          <PlanSection
            title="Найближчі плани"
            more="Дивитися всі"
            plans={groups.upcoming}
            onConfirm={(id) => confirmPlan.mutate(id)}
            empty="Жодного плану з датою. Додайте перший — він одразу стане в сітці вище."
          />

          <PlanSection
            title="Ідеї без дати"
            more="Колись"
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
                Завершені
                <span>
                  {groups.closed.length}
                  <ChevronRightIcon size={16} />
                </span>
              </button>
              {showClosed && (
                <div className="pm-tiles">
                  {groups.closed.map((plan) => <PlanTile key={plan.id} plan={plan} />)}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Коло, а не пігулка з підписом. Дію називає `aria-label`. */}
      <button
        type="button"
        className="fab"
        aria-label="Додати план або подію"
        onClick={() => openCalendarCreate()}
      >
        <PlusIcon size={26} />
      </button>

      {createChooserOpen && (
        <CalendarCreateChooser
          date={createChooserDate}
          onClose={closeCalendarCreate}
          onPlan={choosePlan}
          onEvent={chooseCalendarEvent}
        />
      )}

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

function CalendarCreateChooser({ date, onClose, onPlan, onEvent }: {
  date: string | null;
  onClose: () => void;
  onPlan: () => void;
  onEvent: () => void;
}) {
  return (
    <div
      className="modal-overlay plan-create-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="modal-sheet plan-create-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="calendar-create-title"
      >
        <div className="plan-create-form">
          <header className="plan-create-head">
            <span className="plan-create-eyebrow">Додати в календар</span>
            <h2 id="calendar-create-title">Що створюємо?</h2>
            <p>
              {date
                ? `Дата вже вибрана: ${formatDateUA(date)}. Оберіть, що має на ній з’явитися.`
                : 'План піде ще й у список нижче. Подія залишиться тільки позначкою в календарі.'}
            </p>
          </header>

          <div className="plan-create-type-grid" aria-label="Що додати в календар">
            <button
              type="button"
              className="plan-create-type-option"
              onClick={onPlan}
            >
              <BulbIcon size={18} />
              <span style={{ display: 'grid', gap: 2, textAlign: 'left' }}>
                <strong>План</strong>
                <small>Поїздка, побачення, місце або інша спільна справа.</small>
              </span>
            </button>
            <button
              type="button"
              className="plan-create-type-option"
              onClick={onEvent}
            >
              <EventIcon type="holiday" size={18} />
              <span style={{ display: 'grid', gap: 2, textAlign: 'left' }}>
                <strong>Подія</strong>
                <small>День народження, свято, особиста дата або нагадування.</small>
              </span>
            </button>
          </div>

          <div className="plan-create-actions">
            <button type="button" className="plan-create-cancel" onClick={onClose}>
              Скасувати
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Скільки карток видно до того, як секція просить «Дивитися всі». */
const SECTION_PREVIEW = 4;

/**
 * Секція планів.
 *
 * Праворуч від назви стоїть вихід («Дивитися всі ›», «Колись ›») — так на
 * референсі. Він розкриває решту КАРТОК ТУТ САМО, а не веде кудись: окремого
 * екрана «всі плани» в застосунку немає, і вигадувати маршрут заради стрілки
 * не варто. Кнопка з'являється лише тоді, коли є що розкривати.
 */
function PlanSection({ title, more, plans, onConfirm, empty }: {
  title: string;
  more: string;
  plans: readonly import('@/types').PlanRow[];
  onConfirm: (id: number) => void;
  empty: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const hidden = Math.max(0, plans.length - SECTION_PREVIEW);
  const shown = expanded ? plans : plans.slice(0, SECTION_PREVIEW);

  return (
    <>
      <div className="pm-section-head">
        <h2>{title}</h2>
        {hidden > 0 && (
          <button
            type="button"
            className="pm-section-more"
            aria-expanded={expanded}
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? 'Згорнути' : more}
            <ChevronRightIcon size={16} />
          </button>
        )}
      </div>
      {plans.length === 0 ? (
        <p className="pm-section-empty">{empty}</p>
      ) : (
        <div className="pm-tiles">
          {shown.map((plan) => <PlanTile key={plan.id} plan={plan} onConfirm={onConfirm} />)}
        </div>
      )}
    </>
  );
}
