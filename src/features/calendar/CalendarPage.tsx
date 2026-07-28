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
import { currentYearMonth, stepMonth } from '@/features/_shared/month';
import { usePlans } from '@/features/plans/usePlans';
import type { EnrichedEvent, EventType } from '@/types';

// Значок окремо від підпису: TabBar приймає ReactNode, тож малюємо
// той самий набір, що й у списку, а не системне емодзі.
const TAB_DEFS: { type: EventType; label: string }[] = [
  { type: 'anniversary', label: 'Наші свята' },
  { type: 'birthday', label: 'Дні народження' },
  { type: 'holiday', label: 'Свята' },
];

/**
 * Стан модалки несе і вид форми, і рядок, який редагується. Одне поле, а
 * не два незалежні: «яку форму показати» й «що саме правимо» не можуть
 * розійтись, і неможливо відкрити модалку події з планом усередині.
 * `row === null` означає створення — той самий патерн, що у вішлисті.
 */
type ModalState = { kind: 'event'; row: EnrichedEvent | null; date?: string } | null;

export function CalendarPage() {
  const { data: events = [], isPending, isError, refetch, isFetching } = useEvents();
  // Плани — окреме джерело, а не події з `type='other'`, як було досі.
  // Сітка і рік їх показують; список за типами — ні: у планів є власний
  // модуль, і вкладка тут повернула б рівно те дублювання, яке прибрали.
  const { data: plans = [] } = usePlans();
  const {
    addEvent, addHolidays, updateEvent, deleteEvent,
  } = useCalendarMutations();
  const confirmDialog = useConfirm();
  const navigate = useNavigate();

  const [filter, setFilter] = useState<EventType>('anniversary');
  const [modal, setModal] = useState<ModalState>(null);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [view, setView] = useCalendarView();
  const [{ yr, mo }, setYm] = useState(currentYearMonth);

  // Заготовки рахуємо по ВСІХ подіях, а не лише по вкладці свят: 24
  // серпня, заведене колись як «Інша подія», однаково займає той день.
  const presets = useMemo(() => missingPresets(events), [events]);

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
          onClick={() => setModal({ kind: 'event', row: null })}
        >
          + Додати
        </button>
      </div>

      <CalendarViewPicker value={view} onChange={setView} />

      {/* Вкладки типів мають сенс лише у списку: сітка й рік показують усі
          типи одразу — заради того їх і відкривають. */}
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
          onAddOn={(date) => setModal({ kind: 'event', row: null, date })}
          onOpenEvent={(ev) => setModal({
            kind: 'event',
            row: enriched.find((e) => e.id === ev.id) ?? null,
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
      ) : filter === 'holiday' && presets.length > 0 ? (
        <>
          <button type="button" className="cal-preset-cta" onClick={() => setPresetsOpen(true)}>
            <span className="cal-preset-cta-hd"><SparkIcon size={17} /> Додати типові свята</span>
            <small>Новий рік, Незалежність, Різдво та інші — з перевіркою дат</small>
          </button>
          {filtered.length > 0 && (
            <EventList
              events={filtered}
              onEdit={(ev) => setModal({ kind: 'event', row: ev })}
              onDelete={onDelete}
            />
          )}
        </>
      ) : events.length === 0 ? (
        <p className="empty-state">Подій ще немає. Додай першу!</p>
      ) : (
        <EventList
          events={filtered}
          onEdit={(ev) => setModal({ kind: 'event', row: ev })}
          onDelete={onDelete}
        />
      )}

      {modal?.kind === 'event' && (
        <AddEventModal
          event={modal.row}
          initialDate={modal.date}
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
          onSubmit={(items) =>
            addHolidays.mutate(items, { onSuccess: () => setPresetsOpen(false) })
          }
        />
      )}
    </section>
  );
}

/** Скелет замість рядка «Завантаження…»: висота списку не стрибає, коли
 *  дані приїхали. Локальний — потрібен лише тут. */
function CalendarSkeleton() {
  return (
    <div className="cal-skeleton" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="cal-skeleton-row" />
      ))}
    </div>
  );
}
