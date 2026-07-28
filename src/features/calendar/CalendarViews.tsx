// ============================================================
// Сітка місяця й огляд року.
// ------------------------------------------------------------
// Список відповідає «що найближче». Сітка — «що в липні», рік — «коли в
// нас густо». Модуль зветься календарем від першого дня й досі жодного
// з цих двох питань не брав на себе.
//
// На відміну від списку, обидва вигляди показують УСІ типи одразу: сенс
// календаря саме в тому, щоб побачити день народження й річницю поруч.
// Тому вкладки типів у них не показуються.
//
// Сітка була німою: дні малювались як <div>, тож тапнути 5 липня і щось
// із ним зробити було неможливо — а це головний жест будь-якого
// календаря. Тепер день це кнопка, вибраний день відкриває свою панель
// замість списку місяця, і з неї ж додається подія САМЕ на цю дату.
// ============================================================
import { useState } from 'react';
import {
  DAYS_UA, MONTHS_UA, currentYearMonth, daysInMonth, firstMondayOffset,
  formatDateUA, todayLocal, ymd,
} from '@/features/_shared/month';
import { pluralUA } from '@/lib/utils';
import { EventIcon } from '@/components/icons/EventIcon';
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from '@/components/icons/UiIcon';
import { TYPES } from './calendarUtils';
import { eventsByDay, yearHeat, yearSummary } from './calendarMonth';
import type { EventRow } from '@/types';

/**
 * Повернення до поточного місяця/року.
 *
 * З'являється лише коли ти НЕ там: інакше це кнопка, яка нічого не
 * робить, у найпомітнішому місці екрана. Догорнувши до 2029-го, назад
 * доводилось клацати стрілкою тридцять разів.
 */
function TodayButton({ show, onClick }: { show: boolean; onClick: () => void }) {
  if (!show) return null;
  return (
    <button type="button" className="cal-today-btn" onClick={onClick}>
      Сьогодні
    </button>
  );
}

// ── Місяць ───────────────────────────────────────────────────
export function CalendarMonthView({
  events, yr, mo, onStepMonth, onGoToday, onOpenEvent, onAddOn,
}: {
  events: EventRow[];
  yr: number;
  mo: number;
  onStepMonth: (delta: number) => void;
  onGoToday: () => void;
  onOpenEvent: (ev: EventRow) => void;
  /** Створити подію на конкретну дату ('YYYY-MM-DD'). */
  onAddOn: (iso: string) => void;
}) {
  const monthName = MONTHS_UA[mo - 1] ?? '';
  const byDay = eventsByDay(events, yr, mo);
  const total = daysInMonth(yr, mo);
  const offset = firstMondayOffset(yr, mo);
  const today = todayLocal();
  const now = currentYearMonth();

  const [selected, setSelected] = useState<number | null>(null);
  // Вибір скидається при зміні місяця: 31-е число попереднього місяця в
  // наступному могло б не існувати взагалі.
  const [seenYm, setSeenYm] = useState(`${yr}-${mo}`);
  if (seenYm !== `${yr}-${mo}`) {
    setSeenYm(`${yr}-${mo}`);
    setSelected(null);
  }

  // Дні місяця з провідними порожніми клітинками під тиждень із понеділка.
  const cells: Array<number | null> = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: total }, (_, i) => i + 1),
  ];

  const chosen = [...byDay.entries()].sort((a, b) => a[0] - b[0]);

  return (
    <div className="cal-month">
      <div className="cal-month-nav">
        <button type="button" className="cal-nav-btn" onClick={() => onStepMonth(-1)} aria-label="Попередній місяць">
          <ChevronLeftIcon size={18} />
        </button>
        <b>{monthName} {yr}</b>
        <TodayButton show={yr !== now.yr || mo !== now.mo} onClick={onGoToday} />
        <button type="button" className="cal-nav-btn" onClick={() => onStepMonth(1)} aria-label="Наступний місяць">
          <ChevronRightIcon size={18} />
        </button>
      </div>

      <div className="cal-dow">
        {DAYS_UA.map((d) => <span key={d}>{d}</span>)}
      </div>

      {/* align-items: start у CSS обов'язковий — інакше клітинка тягнеться
          на висоту рядка й перебиває aspect-ratio (та сама пастка, що вже
          була в мозаїці «Спогадів»). */}
      <div className="cal-grid">
        {cells.map((day, i) => {
          if (day === null) return <span key={`pad-${i}`} className="cal-cell cal-cell--pad" />;
          const list = byDay.get(day) ?? [];
          const iso = ymd(yr, mo, day);
          const isToday = iso === today;
          const isSel = selected === day;
          return (
            <button
              key={day}
              type="button"
              // Повторний тап по вибраному дню знімає вибір — так само,
              // як він його поставив. Окрема кнопка «закрити» для цього
              // не потрібна.
              onClick={() => setSelected(isSel ? null : day)}
              aria-pressed={isSel}
              aria-label={`${day} ${MONTHS_UA[mo - 1]}${list.length ? `, ${list.length} ${pluralUA(list.length, ['подія', 'події', 'подій'])}` : ''}`}
              className={
                `cal-cell${list.length ? ' cal-cell--has' : ''}`
                + `${isToday ? ' cal-cell--today' : ''}${isSel ? ' cal-cell--sel' : ''}`
              }
            >
              <span className="cal-cell-n">{day}</span>
              {list.length > 0 && (
                <span className="cal-cell-dots">
                  {/* Не більше трьох крапок: далі вони зливаються в пляму
                      й перестають щось означати. */}
                  {list.slice(0, 3).map((ev) => (
                    <i key={ev.id} style={{ background: TYPES[ev.type ?? 'other'].mark }} />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {selected !== null ? (
        <DayPanel
          iso={ymd(yr, mo, selected)}
          list={byDay.get(selected) ?? []}
          onOpenEvent={onOpenEvent}
          onAddOn={onAddOn}
          onClear={() => setSelected(null)}
        />
      ) : chosen.length === 0 ? (
        /* Під сіткою — самі події місяця. Крапка каже «щось є», але не
           каже що; без цього списку сітка була б красивою й німою. */
        <p className="empty-state">Цього місяця подій немає.</p>
      ) : (
        <div className="cal-month-list">
          {chosen.map(([day, list]) => (
            <div key={day} className="cal-day-block">
              <div className="cal-day-num">{formatDateUA(ymd(yr, mo, day), { year: false })}</div>
              {list.map((ev) => (
                <EventLine key={ev.id} ev={ev} onOpen={onOpenEvent} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EventLine({ ev, onOpen }: { ev: EventRow; onOpen: (ev: EventRow) => void }) {
  return (
    <button type="button" className="cal-day-event" onClick={() => onOpen(ev)}>
      <span style={{ color: TYPES[ev.type ?? 'other'].mark, display: 'flex' }}>
        <EventIcon type={ev.type} size={19} />
      </span>
      <span className="cal-day-event-title">{ev.title}</span>
    </button>
  );
}

/**
 * Панель вибраного дня.
 *
 * Замінює список місяця, а не додається до нього: інакше події
 * вибраного дня стояли б на екрані двічі — рівно та вада, яку вже
 * виправляли в банері «найближчої».
 *
 * Порожній день теж має панель. Саме вона й важлива: тапнути вільне
 * число і завести на нього подію — те, заради чого сітку відкривають
 * так само часто, як заради перегляду.
 */
function DayPanel({
  iso, list, onOpenEvent, onAddOn, onClear,
}: {
  iso: string;
  list: EventRow[];
  onOpenEvent: (ev: EventRow) => void;
  onAddOn: (iso: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="cal-day-panel">
      <div className="cal-day-panel-hd">
        <b>{formatDateUA(iso)}</b>
        <button type="button" className="cal-day-panel-all" onClick={onClear}>
          Весь місяць
        </button>
      </div>
      {list.length === 0 ? (
        <p className="cal-day-panel-empty">Цього дня нічого не заплановано.</p>
      ) : (
        list.map((ev) => <EventLine key={ev.id} ev={ev} onOpen={onOpenEvent} />)
      )}
      <button type="button" className="cal-day-panel-add" onClick={() => onAddOn(iso)}>
        <PlusIcon size={15} /> Додати на {formatDateUA(iso, { year: false })}
      </button>
    </div>
  );
}

// ── Рік ──────────────────────────────────────────────────────
export function CalendarYearView({
  events, yr, onStepYear, onGoToday, onOpenMonth,
}: {
  events: EventRow[];
  yr: number;
  onStepYear: (delta: number) => void;
  onGoToday: () => void;
  onOpenMonth: (month: number) => void;
}) {
  const months = yearHeat(yearSummary(events, yr));
  const total = months.reduce((n, m) => n + m.count, 0);
  const now = currentYearMonth();

  return (
    <div className="cal-year">
      <div className="cal-month-nav">
        <button type="button" className="cal-nav-btn" onClick={() => onStepYear(-1)} aria-label="Попередній рік">
          <ChevronLeftIcon size={18} />
        </button>
        <b>{yr}</b>
        <TodayButton show={yr !== now.yr} onClick={onGoToday} />
        <button type="button" className="cal-nav-btn" onClick={() => onStepYear(1)} aria-label="Наступний рік">
          <ChevronRightIcon size={18} />
        </button>
      </div>

      <p className="cal-year-total">
        {total} {pluralUA(total, ['подія', 'події', 'подій'])} за рік
      </p>

      <div className="cal-year-grid">
        {months.map((m) => (
          <button
            key={m.month}
            type="button"
            className={`cal-year-cell${m.count ? ' cal-year-cell--has' : ''}${m.month === now.mo && yr === now.yr ? ' cal-year-cell--now' : ''}`}
            // Насиченість пропорційна кількості: до цього огляд був
            // двійковим і на питання «де густо» не відповідав.
            style={{ '--cal-heat': m.heat } as React.CSSProperties}
            onClick={() => onOpenMonth(m.month)}
          >
            <b>{MONTHS_UA[m.month - 1]}</b>
            <span className="cal-year-dots">
              {m.types.map((t) => (
                <i key={t} style={{ background: TYPES[t as keyof typeof TYPES].mark }} />
              ))}
            </span>
            <small>{m.count || '—'}</small>
          </button>
        ))}
      </div>
    </div>
  );
}
