// ============================================================
// CalendarPage — «Події» (індекс хабу /calendar; порт renderEvents)
// ------------------------------------------------------------
// Фільтр по типу (Наші свята / Дні народження / Свята / Плани) —
// локальний стан, як старий activeTypeFilter. «Плани» рендеряться
// окремою дошкою. Кнопка «+» відкриває модалку події або плану.
// (Раніше тут була ще й вкладка «Спільні вихідні» — теплова карта;
// прибрано, кольорове оформлення перенесене на вкладку «Графік».)
// ============================================================
import { useMemo, useState } from 'react';
import { useConfirm } from '@/providers/ConfirmProvider';
import { TabBar } from '@/components/ui/TabBar';
import { useEvents, useCalendarMutations } from './useCalendar';
import { enrichEvent, sortEnriched } from './calendarUtils';
import { EventList } from './EventList';
import { PlansBoard } from './PlansBoard';
import { AddEventModal, AddPlanModal } from './AddEventModal';
import type { EventType } from '@/types';

const TAB_DEFS: { type: EventType; label: string }[] = [
  { type: 'anniversary', label: '💕 Наші свята' },
  { type: 'birthday', label: '🎂 Дні народження' },
  { type: 'holiday', label: '🎉 Свята' },
  { type: 'other', label: '🗺️ Плани' },
];

export function CalendarPage() {
  const { data: events = [], isPending, isError } = useEvents();
  const { addEvent, addPlan, setPlanStatus, deleteEvent } = useCalendarMutations();
  const confirmDialog = useConfirm();

  const [filter, setFilter] = useState<EventType>('anniversary');
  const [modal, setModal] = useState<'event' | 'plan' | null>(null);

  const enriched = useMemo(
    () => events.map(enrichEvent).sort(sortEnriched),
    [events],
  );
  const counts = useMemo(() => {
    const c: Record<EventType, number> = { anniversary: 0, birthday: 0, holiday: 0, other: 0 };
    for (const e of enriched) c[e.type ?? 'other']++;
    return c;
  }, [enriched]);

  const onDelete = async (id: number) => {
    if (await confirmDialog('Видалити подію?')) deleteEvent.mutate(id);
  };

  const filtered = enriched.filter((e) => (e.type ?? 'other') === filter);

  return (
    <section className="calendar">
      <div className="cal-head">
        <h1>Календар</h1>
        <button
          type="button"
          className="btn"
          onClick={() => setModal(filter === 'other' ? 'plan' : 'event')}
        >
          + Додати
        </button>
      </div>

      <TabBar<EventType>
        variant="scroll"
        value={filter}
        onChange={setFilter}
        items={TAB_DEFS.map((def) => ({ value: def.type, label: def.label, count: counts[def.type] }))}
      />

      {isPending ? (
        <p className="empty-state">Завантаження…</p>
      ) : isError ? (
        <p className="empty-state">Не вдалось завантажити події.</p>
      ) : events.length === 0 ? (
        <p className="empty-state">Подій ще немає. Додай першу!</p>
      ) : filter === 'other' ? (
        <PlansBoard
          plans={filtered}
          onSetStatus={(id, metadata) => setPlanStatus.mutate({ id, metadata })}
          onDelete={onDelete}
        />
      ) : (
        <EventList events={filtered} onDelete={onDelete} />
      )}

      {modal === 'event' && (
        <AddEventModal onClose={() => setModal(null)} onSubmit={(i) => addEvent.mutate(i)} />
      )}
      {modal === 'plan' && (
        <AddPlanModal onClose={() => setModal(null)} onSubmit={(i) => addPlan.mutate(i)} />
      )}
    </section>
  );
}
