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
// ============================================================
import { DAYS_UA, MONTHS_UA, daysInMonth, firstMondayOffset, formatDateUA, todayLocal, ymd } from '@/features/_shared/month';
import { pluralUA } from '@/lib/utils';
import { TYPES } from './calendarUtils';
import { eventsByDay, yearSummary } from './calendarMonth';
import type { EventRow } from '@/types';

// ── Місяць ───────────────────────────────────────────────────
export function CalendarMonthView({
  events, yr, mo, onStepMonth, onOpenEvent,
}: {
  events: EventRow[];
  yr: number;
  mo: number;
  onStepMonth: (delta: number) => void;
  onOpenEvent: (ev: EventRow) => void;
}) {
  const monthName = MONTHS_UA[mo - 1] ?? '';
  const byDay = eventsByDay(events, yr, mo);
  const total = daysInMonth(yr, mo);
  const offset = firstMondayOffset(yr, mo);
  const today = todayLocal();

  // Дні місяця з провідними порожніми клітинками під тиждень із понеділка.
  const cells: Array<number | null> = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: total }, (_, i) => i + 1),
  ];

  const chosen = [...byDay.entries()].sort((a, b) => a[0] - b[0]);

  return (
    <div className="cal-month">
      <div className="cal-month-nav">
        <button type="button" className="cal-nav-btn" onClick={() => onStepMonth(-1)} aria-label="Попередній місяць">‹</button>
        <b>{monthName} {yr}</b>
        <button type="button" className="cal-nav-btn" onClick={() => onStepMonth(1)} aria-label="Наступний місяць">›</button>
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
          const isToday = ymd(yr, mo, day) === today;
          return (
            <div
              key={day}
              className={`cal-cell${list.length ? ' cal-cell--has' : ''}${isToday ? ' cal-cell--today' : ''}`}
            >
              <span className="cal-cell-n">{day}</span>
              {list.length > 0 && (
                <span className="cal-cell-dots">
                  {/* Не більше трьох крапок: далі вони зливаються в пляму
                      й перестають щось означати. */}
                  {list.slice(0, 3).map((ev) => (
                    <i key={ev.id} style={{ background: TYPES[ev.type ?? 'other'].color }} />
                  ))}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Під сіткою — самі події місяця. Крапка каже «щось є», але не
          каже що; без цього списку сітка була б красивою й німою. */}
      {chosen.length === 0 ? (
        <p className="empty-state">Цього місяця подій немає.</p>
      ) : (
        <div className="cal-month-list">
          {chosen.map(([day, list]) => (
            <div key={day} className="cal-day-block">
              <div className="cal-day-num">{formatDateUA(ymd(yr, mo, day), { year: false })}</div>
              {list.map((ev) => (
                <button key={ev.id} type="button" className="cal-day-event" onClick={() => onOpenEvent(ev)}>
                  <span aria-hidden="true">{TYPES[ev.type ?? 'other'].icon}</span>
                  <span className="cal-day-event-title">{ev.title}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Рік ──────────────────────────────────────────────────────
export function CalendarYearView({
  events, yr, onStepYear, onOpenMonth,
}: {
  events: EventRow[];
  yr: number;
  onStepYear: (delta: number) => void;
  onOpenMonth: (month: number) => void;
}) {
  const months = yearSummary(events, yr);
  const total = months.reduce((n, m) => n + m.count, 0);

  return (
    <div className="cal-year">
      <div className="cal-month-nav">
        <button type="button" className="cal-nav-btn" onClick={() => onStepYear(-1)} aria-label="Попередній рік">‹</button>
        <b>{yr}</b>
        <button type="button" className="cal-nav-btn" onClick={() => onStepYear(1)} aria-label="Наступний рік">›</button>
      </div>

      <p className="cal-year-total">
        {total} {pluralUA(total, ['подія', 'події', 'подій'])} за рік
      </p>

      <div className="cal-year-grid">
        {months.map((m) => (
          <button
            key={m.month}
            type="button"
            className={`cal-year-cell${m.count ? ' cal-year-cell--has' : ''}`}
            onClick={() => onOpenMonth(m.month)}
          >
            <b>{MONTHS_UA[m.month - 1]}</b>
            <span className="cal-year-dots">
              {m.types.map((t) => (
                <i key={t} style={{ background: TYPES[t as keyof typeof TYPES].color }} />
              ))}
            </span>
            <small>{m.count || '—'}</small>
          </button>
        ))}
      </div>
    </div>
  );
}
