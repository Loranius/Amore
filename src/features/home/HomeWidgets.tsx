// ============================================================
// MiniWidgets (спільний вихідний) + WeekWidget
// ============================================================
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSharedDayoff } from './useHome';
import { todayStr } from './homeUtils';
import { planMetadataOf } from '@/features/_shared/events';
import type { EventRow } from '@/types';

// ── Міні-віджети ─────────────────────────────────────────────
export function MiniWidgets() {
  const navigate = useNavigate();
  const dayoff = useSharedDayoff();

  const dayoffLabel = useMemo(() => {
    if (!dayoff) return null;
    const dt = new Date(dayoff + 'T00:00:00');
    const label = dt.toLocaleDateString('uk-UA', { weekday: 'short', day: 'numeric', month: 'long' });
    const diff = Math.round((dt.getTime() - new Date(todayStr() + 'T00:00:00').getTime()) / 86_400_000);
    const when = diff === 0 ? 'сьогодні! 🎉' : diff === 1 ? 'завтра' : `через ${diff} дн.`;
    return { when, label };
  }, [dayoff]);

  return (
    <div className="mini-widgets">
      {dayoffLabel && (
        <button type="button" className="mini-widget" onClick={() => navigate('/calendar/schedule')}>
          <span className="mini-widget-icon">🏖</span>
          <span className="mini-widget-text">
            <b>Разом {dayoffLabel.when}</b>
            <br />
            {dayoffLabel.label}
          </span>
        </button>
      )}
    </div>
  );
}

// ── Віджет «На цей тиждень» ──────────────────────────────────
const UA_DAYS = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const UA_MONTHS = ['січ', 'лют', 'бер', 'кві', 'тра', 'чер', 'лип', 'сер', 'вер', 'жов', 'лис', 'гру'];
const TYPE_ICON: Record<string, string> = { birthday: '🎂', anniversary: '💕', holiday: '🎉', other: '🗺️' };
const PLAN_ICON: Record<string, string> = { date: '💑', dream: '✨', trip: '✈️', goal: '🎯', other: '🗺️' };

export function WeekWidget({ events }: { events: EventRow[] }) {
  const { days, count } = useMemo(() => buildWeek(events), [events]);
  if (!count) return null;

  return (
    <div className="week-widget">
      <div className="week-widget-hdr">
        <span className="week-widget-title">На цей тиждень</span>
        <span className="week-widget-count">{count}</span>
      </div>
      <div className="week-widget-list">
        {days.map((day) => (
          <div key={day.date}>
            <div className={`week-day-hdr${day.isToday ? ' week-day-hdr--today' : ''}`}>
              <span className="week-day-label">{day.label}</span>
            </div>
            {day.items.map((it) => (
              <div key={it.id} className="week-event-row">
                <span className="week-event-icon">{it.icon}</span>
                <div className="week-event-body">
                  <span className="week-event-title">{it.title}</span>
                  {it.note && <span className="week-event-note">{it.note}</span>}
                </div>
                <span className={`week-event-badge ${it.isPlan ? 'week-badge-plan' : 'week-badge-event'}`}>
                  {it.isPlan ? 'план' : 'подія'}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

interface WeekItem {
  id: number;
  title: string;
  note: string;
  icon: string;
  isPlan: boolean;
}
interface WeekDay {
  date: string;
  label: string;
  isToday: boolean;
  items: WeekItem[];
}

function buildWeek(events: EventRow[]): { days: WeekDay[]; count: number } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sunday = new Date(today);
  sunday.setDate(today.getDate() + ((7 - today.getDay()) % 7));
  sunday.setHours(23, 59, 59, 999);

  const week = events.filter((ev) => {
    const d = new Date(ev.date + 'T00:00:00');
    if (d < today || d > sunday) return false;
    if ((ev.type ?? 'other') === 'other' && planMetadataOf(ev).status === 'done') return false;
    return true;
  });
  if (!week.length) return { days: [], count: 0 };

  const byDay = new Map<string, EventRow[]>();
  for (const ev of week) (byDay.get(ev.date) ?? byDay.set(ev.date, []).get(ev.date)!).push(ev);

  const tomorrow = new Date(today.getTime() + 86_400_000);
  const days: WeekDay[] = [...byDay.keys()].sort().map((dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    const isToday = d.toDateString() === today.toDateString();
    const isTomorrow = d.toDateString() === tomorrow.toDateString();
    const label = isToday
      ? 'Сьогодні'
      : isTomorrow
        ? 'Завтра'
        : `${UA_DAYS[d.getDay()]}, ${d.getDate()} ${UA_MONTHS[d.getMonth()]}`;

    const items: WeekItem[] = (byDay.get(dateStr) ?? []).map((ev) => {
      const isPlan = (ev.type ?? 'other') === 'other';
      const meta = isPlan ? planMetadataOf(ev) : null;
      const icon = isPlan ? (PLAN_ICON[meta!.cat] ?? '🗺️') : (TYPE_ICON[ev.type ?? 'other'] ?? '📅');
      return {
        id: ev.id,
        title: ev.title,
        note: isPlan ? (ev.description ?? '') : '', // metadata → опис уже чистий
        icon,
        isPlan,
      };
    });
    return { date: dateStr, label, isToday, items };
  });

  return { days, count: week.length };
}
