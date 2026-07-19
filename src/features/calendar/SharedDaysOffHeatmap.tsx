// ============================================================
// SharedDaysOffHeatmap — вкладка «Спільні вихідні» (Календар)
// ------------------------------------------------------------
// Теплова карта місяця з даних графіку роботи (work_schedule):
// зелений = обоє вільні («Х»/«Х»), жовтий = один вільний, сірий —
// решта (обоє працюють або позначку ще не проставлено). Лише
// перегляд — редагування позначок лишається на вкладці «Графік».
// ============================================================
import { useMemo, useState } from 'react';
import { useUsers } from '@/features/_shared/useUsers';
import {
  MONTHS_UA,
  DAYS_UA,
  ymd,
  todayLocal,
  daysInMonth,
  firstMondayOffset,
  currentYearMonth,
  stepMonth,
} from '@/features/_shared/month';
import { useSchedule } from '@/features/schedule/useSchedule';

type DayStatus = 'both-off' | 'one-off' | 'none-off';

export function SharedDaysOffHeatmap() {
  const { data: users = [] } = useUsers();
  const [{ yr, mo }, setYm] = useState(currentYearMonth);
  const { data: marks = {} } = useSchedule(yr, mo);

  const total = daysInMonth(yr, mo);
  const offset = firstMondayOffset(yr, mo);
  const today = todayLocal();

  const statusOf = useMemo(() => {
    return (ds: string): DayStatus => {
      if (users.length < 2) return 'none-off';
      const offCount = users.filter((u) => marks[u.id]?.[ds] === 'Х').length;
      if (offCount >= 2) return 'both-off';
      if (offCount === 1) return 'one-off';
      return 'none-off';
    };
  }, [users, marks]);

  const bothOffCount = useMemo(() => {
    let n = 0;
    for (let d = 1; d <= total; d++) if (statusOf(ymd(yr, mo, d)) === 'both-off') n++;
    return n;
  }, [statusOf, total, yr, mo]);

  return (
    <div className="heat">
      <div className="sched-nav">
        <button
          type="button"
          className="sched-nav-btn"
          onClick={() => setYm(stepMonth(yr, mo, -1))}
          aria-label="Попередній місяць"
        >
          ‹
        </button>
        <span className="sched-month-label">
          {MONTHS_UA[mo - 1]} {yr}
        </span>
        <button
          type="button"
          className="sched-nav-btn"
          onClick={() => setYm(stepMonth(yr, mo, +1))}
          aria-label="Наступний місяць"
        >
          ›
        </button>
      </div>

      {bothOffCount > 0 && (
        <p className="heat-summary">
          💚 {bothOffCount} {bothOffCount === 1 ? 'спільний вихідний' : 'спільних вихідних'} цього місяця
        </p>
      )}

      <div className="card">
        <div className="sched-grid">
          {DAYS_UA.map((d) => (
            <div key={d} className="pcal-dow">
              {d}
            </div>
          ))}
          {Array.from({ length: offset }).map((_, i) => (
            <div key={`e${i}`} className="sched-cell sched-cell--empty" />
          ))}
          {Array.from({ length: total }).map((_, i) => {
            const day = i + 1;
            const ds = ymd(yr, mo, day);
            const status = statusOf(ds);
            const isToday = ds === today;
            return (
              <div
                key={ds}
                className={
                  'sched-cell heat-cell' +
                  ` heat-cell--${status}` +
                  (isToday ? ' sched-cell--today' : '')
                }
              >
                <span className="sched-cell-num">{day}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="heat-legend">
        <span><i className="heat-swatch heat-swatch--both-off" /> обоє вільні</span>
        <span><i className="heat-swatch heat-swatch--one-off" /> один вільний</span>
        <span><i className="heat-swatch heat-swatch--none-off" /> зайняті</span>
      </div>
      <p className="heat-hint">Редагувати позначки — на вкладці «Графік» 📋</p>
    </div>
  );
}
