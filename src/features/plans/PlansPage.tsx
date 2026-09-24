// ============================================================
// «Плани» — модуль із фокусом (ADR-0207, варіант C).
// ------------------------------------------------------------
// У календарі живуть ДВІ різні сутності:
//   plan  — те, що пара збирається зробити; має статус, бюджет, задачі й
//           окрему плитку під календарем;
//   event — дата / свято / день народження; лишається позначкою в календарі
//           й отримує Telegram-нагадування, але НЕ стає планом.
//
// ЩО ЗМІНИЛОСЬ І ЧОМУ. Власник: «не подобається взагалі все». Три напрями
// зняті в `plans-lab.html`, обрано C — вісь РІШЕННЯ. Теза не зі смаку, а
// з заміру бази: **п'ять із шести відкритих записів не мають дати**, а
// сітка місяця займала 40% першого вікна, щоб показати одну крапку.
//
// Тепер зверху стоїть один план, заради якого модуль відкривають, під ним
// колода задумів з однією дією — дати дату, — а списки живуть за тихими
// лічильниками.
//
// КАЛЕНДАР НЕ ВИДАЛЕНИЙ, І ЦЕ ВАЖЛИВО. Макет C його не показував, але
// перевірка маршрутів перед роботою знайшла, що `/calendar` — це
// **редирект сюди**: іншого місяця в порталі немає. Викинути сітку
// означало б забрати в пари єдиний календар. Тому вона спустилась у свій
// лічильник, а `/calendar` веде на `?view=calendar` і розкриває її одразу.
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSettledPending } from '@/lib/useSettledPending';
import { ChevronRightIcon, PlusIcon } from '@/components/icons/UiIcon';
import { useWorldVisibleRoute } from '@/features/world/useWorldVisibleRoute';
import { useArtifactWorld } from '@/features/world/artifactWorldContext';
import { useDimmedWorld } from '@/features/world/worldDim';
import { currentYearMonth, stepMonth } from '@/features/_shared/month';
import { useCalendarMutations, useEvents } from '@/features/calendar/useCalendar';
import { enrichEvent, sortEnriched } from '@/features/calendar/calendarUtils';
import { CalendarMonthView } from '@/features/calendar/CalendarViews';
import { AddEventModal } from '@/features/calendar/AddEventModal';
import { PageHeader } from '@/components/ui/PageHeader';
import { AddPlanModal } from './AddPlanModal';
import { PlanTile } from './PlanTile';
import { PlanFocusEmpty, PlanFocusHero } from './PlanFocusHero';
import { PlanIdeaDeck } from './PlanIdeaDeck';
import { focusPlan, ideaQueue, scheduledPlans } from './planFocus';
import { isClosed } from './planModel';
import { usePlanMutations, usePlans } from './usePlans';
import '@/features/world/worldDim.css';
import './plans.css';
import './plansModule.css';
import './plansFocus.css';
import type { EventRow, EventType, PlanRow } from '@/types';

type EventKind = Extract<EventType, 'anniversary' | 'birthday' | 'holiday'>;

type EventModal = {
  row: EventRow | null;
  date?: string | undefined;
  type: EventKind;
} | null;

/** Які тихі лічильники відкриті. Календар приходить із рядка запиту. */
type OpenSection = 'scheduled' | 'ideas' | 'closed' | 'calendar';

export function PlansPage() {
  const navigate = useNavigate();
  const [search] = useSearchParams();

  // Модуль впускає світ, як вішліст: сцена лишається фоном, дотики — сторінці.
  const { webglSupported } = useArtifactWorld();
  const worldVisible = webglSupported;
  useWorldVisibleRoute();
  useDimmedWorld(worldVisible);

  const [{ yr, mo }, setYm] = useState(currentYearMonth);
  const [addingPlan, setAddingPlan] = useState(false);
  const [createdPlanId, setCreatedPlanId] = useState<number | null>(null);
  const [eventModal, setEventModal] = useState<EventModal>(null);
  const [open, setOpen] = useState<Set<OpenSection>>(() => new Set());

  /*
   * `/calendar` веде сюди редиректом. Хто прийшов по календар, мусить
   * побачити календар, а не шукати його за лічильником.
   *
   * ЧОМУ ЕФЕКТ, А НЕ ПОЧАТКОВЕ ЗНАЧЕННЯ `useState`. Перша редакція
   * ADR-0207 читала параметр саме там — і це працювало рівно доти, доки
   * на екран заходили ЗЗОВНІ. `/plans` і `/plans?view=calendar` — це один
   * і той самий елемент маршруту, тож перехід між ними НЕ перемонтовує
   * сторінку, ініціалізатор не виконується вдруге, і посилання на
   * `?view=calendar` з самого модуля не робило б нічого. Мовчки: адреса
   * в рядку змінилась, екран — ні.
   *
   * Ефект залежить від булевого значення, а не від рядка запиту, і саме
   * тому пара може розділ ЗАКРИТИ: закриття не міняє параметр, залежність
   * лишається тією самою, ефект не запускається вдруге й не відкриває
   * розділ назад.
   */
  const wantsCalendar = search.get('view') === 'calendar';
  useEffect(() => {
    if (!wantsCalendar) return;
    setOpen((current) => (
      current.has('calendar') ? current : new Set(current).add('calendar')
    ));
  }, [wantsCalendar]);

  const plansQuery = usePlans();
  const eventsQuery = useEvents();
  const { addPlan, confirmPlan, updatePlan } = usePlanMutations();
  const { addEvent, updateEvent } = useCalendarMutations();

  const plans = useMemo(() => plansQuery.data ?? [], [plansQuery.data]);
  const events = useMemo(() => eventsQuery.data ?? [], [eventsQuery.data]);

  // Календар показує важливі моменти, дні народження й звичайні календарні
  // дати/свята. Вони всі живуть у `events`, тому ніколи не потрапляють у
  // списки планів нижче.
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

  const hero = useMemo(() => focusPlan(plans), [plans]);
  const ideas = useMemo(() => ideaQueue(plans), [plans]);
  const scheduled = useMemo(() => scheduledPlans(plans, new Date(), hero), [plans, hero]);
  const closed = useMemo(() => plans.filter(isClosed), [plans]);

  const toggle = (section: OpenSection) => setOpen((current) => {
    const next = new Set(current);
    if (next.has(section)) next.delete(section);
    else next.add(section);
    return next;
  });

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

  // Плюс означає рівно одну дію — новий план. Календарна подія
  // створюється контекстно: другий тап по вже вибраному дню в сітці
  // відкриває її модалку з датою (`onAddOn` нижче).
  const openPlanComposer = () => setAddingPlan(true);

  const closeAddPlan = () => {
    if (addPlan.isPending) return;
    setAddingPlan(false);
    setCreatedPlanId(null);
  };

  const busy = plansQuery.isPending || eventsQuery.isPending;
  const failed = plansQuery.isError || eventsQuery.isError;
  // Скелет за порогом: на теплому кеші дані приходять швидше, ніж око
  // встигає його прочитати, а `pm-sheet-in` устигає програтись двічі —
  // один раз на скелеті, другий на вмісті. Саме це власник описав як
  // «плани просто тупим ривком завантажуються».
  const skeletonVisible = useSettledPending(busy);

  return (
    <section
      className="plans-module"
      data-world={worldVisible ? 'true' : undefined}
    >
      <PageHeader title="Плани" eyebrow="Календар і задуми" />
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
      ) : skeletonVisible ? (
        // Скелет перевіряється ПЕРЕД `busy`: саме він тримає гілку, поки
        // не вийде мінімальний час показу (див. `useSettledPending`).
        <div className="pm-sheet pm-sheet--loading" aria-busy="true">
          <div className="pm-skeleton pm-skeleton--month" />
          <div className="pm-tiles">
            <div className="pm-skeleton pm-skeleton--tile" />
            <div className="pm-skeleton pm-skeleton--tile" />
          </div>
        </div>
      ) : busy ? null : (
        <div className="pm-sheet">
          {hero !== null
            ? <PlanFocusHero plan={hero} />
            : <PlanFocusEmpty ideas={ideas.length} />}

          {ideas.length > 0 && (
            <>
              <div className="pm-section-head">
                <h2>Що наступне?</h2>
              </div>
              <PlanIdeaDeck
                ideas={ideas}
                busy={updatePlan.isPending}
                /*
                 * `date_precision: 'day'` разом зі `start_date` — саме та
                 * пара, якої чекає `hasPreciseDate`. Без неї задум дістав
                 * би дату й однаково лишився б поза сіткою й поза
                 * відліком, тобто дія виглядала б зробленою й не була б.
                 */
                onPickDate={(id, iso) => updatePlan.mutate({
                  id,
                  patch: { start_date: iso, end_date: null, date_precision: 'day' },
                })}
              />
            </>
          )}

          <QuietSection
            label="Заплановано"
            count={scheduled.length}
            open={open.has('scheduled')}
            onToggle={() => toggle('scheduled')}
          >
            <div className="pm-tiles">
              {scheduled.map((plan) => (
                <PlanTile key={plan.id} plan={plan} onConfirm={(id) => confirmPlan.mutate(id)} />
              ))}
            </div>
          </QuietSection>

          <QuietSection
            label="Задуми без дати"
            count={ideas.length}
            open={open.has('ideas')}
            onToggle={() => toggle('ideas')}
          >
            <div className="pm-tiles">
              {ideas.map((plan) => (
                <PlanTile key={plan.id} plan={plan} onConfirm={(id) => confirmPlan.mutate(id)} />
              ))}
            </div>
          </QuietSection>

          <QuietSection
            label="Прожито разом"
            count={closed.length}
            open={open.has('closed')}
            onToggle={() => toggle('closed')}
          >
            <div className="pm-tiles">
              {closed.map((plan) => <PlanTile key={plan.id} plan={plan} />)}
            </div>
          </QuietSection>

          <QuietSection
            label="Календар"
            open={open.has('calendar')}
            onToggle={() => toggle('calendar')}
          >
            <CalendarMonthView
              events={calendarEvents}
              plans={plans}
              yr={yr}
              mo={mo}
              onStepMonth={(delta) => setYm(stepMonth(yr, mo, delta))}
              onGoToday={() => setYm(currentYearMonth())}
              // Перший тап по дню лише вибирає його. Повторний тап по тому
              // самому дню (або кнопка в панелі дня) одразу відкриває модалку
              // календарної події з уже підставленою датою.
              onAddOn={(date) => openNewEvent('holiday', date)}
              onOpenEvent={(event) => openExistingEvent(
                enriched.find((item) => item.id === event.id) ?? event,
              )}
              onOpenPlan={(id) => navigate(`/plans/${id}`)}
            />
          </QuietSection>
        </div>
      )}

      {/* Плюс більше не питає «План чи подія?»: у модулі це завжди план.
          Календарна подія створюється контекстно — другим тапом по даті. */}
      <button
        type="button"
        className="fab"
        aria-label="Додати план"
        onClick={openPlanComposer}
      >
        <PlusIcon size={26} />
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

/**
 * Тихий лічильник, який розкривається на місці.
 *
 * ЦЕ ВІДПОВІДЬ НА НАЗВАНУ ЦІНУ ВАРІАНТА C: «список як список зникає».
 * Зникнути він не має права — кожен запис мусить мати двері, — але й
 * займати перший екран теж. Тому рядок каже ЧИСЛО (це вже інформація:
 * «прожито разом 12»), а вміст приходить на дотик.
 *
 * Порожній розділ не показується взагалі: рядок «Заплановано 0» — це
 * шум, який ще й читається як несправність. Календар — виняток, у нього
 * лічильника немає, бо місяць не рахується.
 */
function QuietSection({ label, count, open, onToggle, children }: {
  label: string;
  count?: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <>
      <button
        type="button"
        className="pf-quiet"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span className="pf-quiet-mark">
          <ChevronRightIcon size={15} />
          {label}
        </span>
        {count !== undefined && <b>{count}</b>}
      </button>
      {open && <div className="pf-quiet-body">{children}</div>}
    </>
  );
}

export type { PlanRow };
