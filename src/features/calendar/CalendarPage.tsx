// ============================================================
// CalendarPage — особисті дати пари.
// ------------------------------------------------------------
// Календар має два змістовні розділи: «Наші свята» з дорожньою картою
// стосунків та «Дні народження». Загальні державні й типові свята не
// показуються ні у вкладках, ні в місячній та річній сітках.
// ============================================================
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConfirm } from '@/providers/ConfirmProvider';
import { TabBar } from '@/components/ui/TabBar';
import { EventIcon } from '@/components/icons/EventIcon';
import { useEvents, useCalendarMutations } from './useCalendar';
import { enrichEvent, sortEnriched } from './calendarUtils';
import { EventList } from './EventList';
import { AddEventModal } from './AddEventModal';
import { CalendarViewPicker } from './CalendarViewPicker';
import { CalendarMonthView, CalendarYearView } from './CalendarViews';
import { useCalendarView } from './calendarView';
import { RelationshipJourney } from './RelationshipJourney';
import { currentYearMonth, stepMonth } from '@/features/_shared/month';
import { usePlans } from '@/features/plans/usePlans';
import type { EventRow, EventType } from '@/types';

type CalendarSection = Extract<EventType, 'anniversary' | 'birthday'>;

const TAB_DEFS: { type: CalendarSection; label: string }[] = [
  { type: 'anniversary', label: 'Наші свята' },
  { type: 'birthday', label: 'Дні народження' },
];

type ModalState = {
  row: EventRow | null;
  date?: string | undefined;
  type: CalendarSection;
} | null;

export function CalendarPage() {
  const { data: events = [], isPending, isError, refetch, isFetching } = useEvents();
  const { data: plans = [] } = usePlans();
  const { addEvent, updateEvent, deleteEvent } = useCalendarMutations();
  const confirmDialog = useConfirm();
  const navigate = useNavigate();

  const [filter, setFilter] = useState<CalendarSection>('anniversary');
  const [modal, setModal] = useState<ModalState>(null);
  const [view, setView] = useCalendarView();
  const [{ yr, mo }, setYm] = useState(currentYearMonth);

  // Старі holiday-рядки не видаляємо з бази, але вони більше не є частиною
  // особистого календаря пари й не повинні просочуватись у жоден його вигляд.
  const visibleEvents = useMemo(
    () => events.filter((event) => event.type === 'anniversary' || event.type === 'birthday'),
    [events],
  );
  const enriched = useMemo(
    () => visibleEvents.map(enrichEvent).sort(sortEnriched),
    [visibleEvents],
  );
  const counts = useMemo(() => {
    const result: Record<CalendarSection, number> = { anniversary: 0, birthday: 0 };
    for (const event of enriched) {
      if (event.type === 'anniversary' || event.type === 'birthday') result[event.type] += 1;
    }
    return result;
  }, [enriched]);

  const filtered = enriched.filter((event) => event.type === filter);

  const openNewEvent = (type: CalendarSection = filter, date?: string) => {
    setModal({ row: null, type, date });
  };

  const openExistingEvent = (event: EventRow) => {
    const type: CalendarSection = event.type === 'birthday' ? 'birthday' : 'anniversary';
    setModal({ row: event, type });
  };

  const onDelete = async (id: number) => {
    if (await confirmDialog('Видалити подію?')) deleteEvent.mutate(id);
  };

  return (
    // Фон раніше приходив від обгортки хабу. Хаб зник разом зі своїм
    // єдиним сабтабом, тож сторінка несе його сама — рівно так, як це
    // роблять усі інші розділи порталу.
    <section className="calendar pink-page">
      <div className="cal-head">
        <h1>Календар</h1>
        <button type="button" className="btn" onClick={() => openNewEvent()}>
          + Додати
        </button>
      </div>

      <CalendarViewPicker value={view} onChange={setView} />

      {view === 'list' && (
        <TabBar<CalendarSection>
          variant="scroll"
          value={filter}
          onChange={setFilter}
          items={TAB_DEFS.map((definition) => ({
            value: definition.type,
            label: definition.label,
            icon: <EventIcon type={definition.type} size={15} />,
            count: counts[definition.type],
          }))}
        />
      )}

      {isPending ? (
        <CalendarSkeleton />
      ) : isError ? (
        <div className="empty-state cal-error">
          <p>Не вдалось завантажити події.</p>
          <button type="button" className="btn" onClick={() => void refetch()} disabled={isFetching}>
            {isFetching ? 'Пробую…' : 'Спробувати ще раз'}
          </button>
        </div>
      ) : view === 'month' ? (
        <CalendarMonthView
          events={visibleEvents}
          plans={plans}
          yr={yr}
          mo={mo}
          onStepMonth={(delta) => setYm(stepMonth(yr, mo, delta))}
          onGoToday={() => setYm(currentYearMonth())}
          onAddOn={(date) => openNewEvent(filter, date)}
          onOpenEvent={(event) => openExistingEvent(
            enriched.find((item) => item.id === event.id) ?? event,
          )}
          onOpenPlan={(id) => navigate(`/plans/${id}`)}
        />
      ) : view === 'year' ? (
        <CalendarYearView
          events={visibleEvents}
          plans={plans}
          yr={yr}
          onStepYear={(delta) => setYm({ yr: yr + delta, mo })}
          onGoToday={() => setYm(currentYearMonth())}
          onOpenMonth={(month) => { setYm({ yr, mo: month }); setView('month'); }}
        />
      ) : filter === 'anniversary' ? (
        <>
          <RelationshipJourney
            events={visibleEvents}
            onOpen={openExistingEvent}
            onAdd={() => openNewEvent('anniversary')}
          />
          {filtered.length > 0 ? (
            <EventList events={filtered} onEdit={openExistingEvent} onDelete={onDelete} />
          ) : (
            <p className="empty-state">Наших подій ще немає. Додайте перший момент вашої історії.</p>
          )}
        </>
      ) : filtered.length === 0 ? (
        <p className="empty-state">Днів народження ще немає.</p>
      ) : (
        <EventList events={filtered} onEdit={openExistingEvent} onDelete={onDelete} />
      )}

      {modal && (
        <AddEventModal
          event={modal.row}
          initialDate={modal.date}
          initialType={modal.type}
          onClose={() => setModal(null)}
          onSubmit={(input) => {
            if (modal.row) updateEvent.mutate({ id: modal.row.id, input });
            else addEvent.mutate(input);
          }}
        />
      )}
    </section>
  );
}

function CalendarSkeleton() {
  return (
    <div className="cal-skeleton" aria-hidden="true">
      {[0, 1, 2, 3].map((index) => <div key={index} className="cal-skeleton-row" />)}
    </div>
  );
}
