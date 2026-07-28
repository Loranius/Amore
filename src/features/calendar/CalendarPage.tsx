// ============================================================
// CalendarPage — події, свята й «Наш шлях».
// ------------------------------------------------------------
// «Наш шлях» належить вкладці «Наші свята» і читає лише календарні
// річниці та важливі віхи. Плани лишаються окремим модулем, але місячна
// й річна сітки й далі можуть показувати їх поруч з календарними датами.
// ============================================================
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConfirm } from '@/providers/ConfirmProvider';
import { TabBar } from '@/components/ui/TabBar';
import { EventIcon, SparkIcon } from '@/components/icons/EventIcon';
import { useEvents, useCalendarMutations } from './useCalendar';
import { enrichEvent, sortEnriched } from './calendarUtils';
import { EventList } from './EventList';
import { AddEventModal } from './AddEventModal';
import { HolidayPresetsModal } from './HolidayPresetsModal';
import { missingPresets } from './holidayPresets';
import { CalendarViewPicker } from './CalendarViewPicker';
import { CalendarMonthView, CalendarYearView } from './CalendarViews';
import { useCalendarView } from './calendarView';
import { RelationshipJourney } from './RelationshipJourney';
import { currentYearMonth, stepMonth } from '@/features/_shared/month';
import { usePlans } from '@/features/plans/usePlans';
import type { EventRow, EventType } from '@/types';

const TAB_DEFS: { type: EventType; label: string }[] = [
  { type: 'anniversary', label: 'Наші свята' },
  { type: 'birthday', label: 'Дні народження' },
  { type: 'holiday', label: 'Свята' },
];

type ModalState = {
  kind: 'event';
  row: EventRow | null;
  date?: string;
  type?: EventType;
} | null;

export function CalendarPage() {
  const { data: events = [], isPending, isError, refetch, isFetching } = useEvents();
  const { data: plans = [] } = usePlans();
  const { addEvent, addHolidays, updateEvent, deleteEvent } = useCalendarMutations();
  const confirmDialog = useConfirm();
  const navigate = useNavigate();

  const [filter, setFilter] = useState<EventType>('anniversary');
  const [modal, setModal] = useState<ModalState>(null);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [view, setView] = useCalendarView();
  const [{ yr, mo }, setYm] = useState(currentYearMonth);

  const presets = useMemo(() => missingPresets(events), [events]);
  const enriched = useMemo(() => events.map(enrichEvent).sort(sortEnriched), [events]);
  const counts = useMemo(() => {
    const result: Record<EventType, number> = { anniversary: 0, birthday: 0, holiday: 0, other: 0 };
    for (const event of enriched) result[event.type ?? 'other']++;
    return result;
  }, [enriched]);

  const filtered = enriched.filter((event) => (event.type ?? 'other') === filter);

  const openNewEvent = (type: EventType = filter, date?: string) => {
    setModal({ kind: 'event', row: null, type, date });
  };

  const onDelete = async (id: number) => {
    if (await confirmDialog('Видалити подію?')) deleteEvent.mutate(id);
  };

  return (
    <section className="calendar">
      <div className="cal-head">
        <h1>Календар</h1>
        <button type="button" className="btn" onClick={() => openNewEvent()}>
          + Додати
        </button>
      </div>

      <CalendarViewPicker value={view} onChange={setView} />

      {view === 'list' && (
        <TabBar<EventType>
          variant="scroll"
          value={filter}
          onChange={setFilter}
          items={TAB_DEFS.map((def) => ({
            value: def.type,
            label: def.label,
            icon: <EventIcon type={def.type} size={15} />,
            count: counts[def.type],
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
          events={events}
          plans={plans}
          yr={yr}
          mo={mo}
          onStepMonth={(delta) => setYm(stepMonth(yr, mo, delta))}
          onGoToday={() => setYm(currentYearMonth())}
          onAddOn={(date) => openNewEvent(filter, date)}
          onOpenEvent={(event) => setModal({
            kind: 'event',
            row: enriched.find((item) => item.id === event.id) ?? event,
          })}
          onOpenPlan={(id) => navigate(`/plans/${id}`)}
        />
      ) : view === 'year' ? (
        <CalendarYearView
          events={events}
          plans={plans}
          yr={yr}
          onStepYear={(delta) => setYm({ yr: yr + delta, mo })}
          onGoToday={() => setYm(currentYearMonth())}
          onOpenMonth={(month) => { setYm({ yr, mo: month }); setView('month'); }}
        />
      ) : filter === 'anniversary' ? (
        <>
          <RelationshipJourney
            events={events}
            onOpen={(event) => setModal({ kind: 'event', row: event })}
            onAdd={() => openNewEvent('anniversary')}
          />
          {filtered.length > 0 ? (
            <EventList
              events={filtered}
              onEdit={(event) => setModal({ kind: 'event', row: event })}
              onDelete={onDelete}
            />
          ) : (
            <p className="empty-state">Наших свят ще немає. Додайте першу важливу дату.</p>
          )}
        </>
      ) : filter === 'holiday' && presets.length > 0 ? (
        <>
          <button type="button" className="cal-preset-cta" onClick={() => setPresetsOpen(true)}>
            <span className="cal-preset-cta-hd"><SparkIcon size={17} /> Додати типові свята</span>
            <small>Новий рік, Незалежність, Різдво та інші — з перевіркою дат</small>
          </button>
          {filtered.length > 0 && (
            <EventList
              events={filtered}
              onEdit={(event) => setModal({ kind: 'event', row: event })}
              onDelete={onDelete}
            />
          )}
        </>
      ) : filtered.length === 0 ? (
        <p className="empty-state">Подій у цій вкладці ще немає.</p>
      ) : (
        <EventList
          events={filtered}
          onEdit={(event) => setModal({ kind: 'event', row: event })}
          onDelete={onDelete}
        />
      )}

      {modal?.kind === 'event' && (
        <AddEventModal
          event={modal.row}
          initialDate={modal.date}
          initialType={modal.type}
          onClose={() => setModal(null)}
          onSubmit={(input) => {
            const row = modal.row;
            if (row) updateEvent.mutate({ id: row.id, input });
            else addEvent.mutate(input);
          }}
        />
      )}

      {presetsOpen && (
        <HolidayPresetsModal
          presets={presets}
          busy={addHolidays.isPending}
          onClose={() => setPresetsOpen(false)}
          onSubmit={(items) => addHolidays.mutate(items, { onSuccess: () => setPresetsOpen(false) })}
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
