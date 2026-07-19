// ============================================================
// CalendarPage — «Події» (індекс хабу /calendar; порт renderEvents)
// ------------------------------------------------------------
// Фільтр по типу (Наші свята / Дні народження / Свята / Плани /
// Спільні вихідні) — локальний стан, як старий activeTypeFilter.
// «Плани» рендеряться окремою дошкою, «Спільні вихідні» — тепловою
// картою (SharedDaysOffHeatmap, дані з work_schedule, не з events).
// Кнопка «+» відкриває модалку події або плану (ховається на тепловій карті).
// ============================================================
import { useMemo, useState } from 'react';
import { useEvents, useCalendarMutations } from './useCalendar';
import { enrichEvent, sortEnriched } from './calendarUtils';
import { EventList } from './EventList';
import { PlansBoard } from './PlansBoard';
import { SharedDaysOffHeatmap } from './SharedDaysOffHeatmap';
import { AddEventModal, AddPlanModal } from './AddEventModal';
import type { EventType } from '@/types';

type Filter = EventType | 'shared-days-off';

const TAB_DEFS: { type: Filter; label: string }[] = [
  { type: 'anniversary', label: '💕 Наші свята' },
  { type: 'birthday', label: '🎂 Дні народження' },
  { type: 'holiday', label: '🎉 Свята' },
  { type: 'other', label: '🗺️ Плани' },
  { type: 'shared-days-off', label: '🌿 Спільні вихідні' },
];

export function CalendarPage() {
  const { data: events = [], isPending, isError } = useEvents();
  const { addEvent, addPlan, setPlanStatus, deleteEvent } = useCalendarMutations();

  const [filter, setFilter] = useState<Filter>('anniversary');
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

  const onDelete = (id: number) => {
    if (confirm('Видалити подію?')) deleteEvent.mutate(id);
  };

  const isHeatmap = filter === 'shared-days-off';
  const filtered = isHeatmap ? [] : enriched.filter((e) => (e.type ?? 'other') === filter);

  return (
    <section className="calendar">
      <div className="cal-head">
        <h1>Календар</h1>
        {!isHeatmap && (
          <button
            type="button"
            className="btn"
            onClick={() => setModal(filter === 'other' ? 'plan' : 'event')}
          >
            + Додати
          </button>
        )}
      </div>

      <div className="cal-type-filter-bar">
        {TAB_DEFS.map((def) => (
          <button
            key={def.type}
            type="button"
            className={`cal-type-filter-btn${filter === def.type ? ' active' : ''}`}
            onClick={() => setFilter(def.type)}
          >
            {def.label}
            {def.type !== 'shared-days-off' && (
              <span className="cal-type-count">{counts[def.type]}</span>
            )}
          </button>
        ))}
      </div>

      {isHeatmap ? (
        <SharedDaysOffHeatmap />
      ) : isPending ? (
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
