// ============================================================
// SchedulePage — «Графік» (порт schedule.js UI)
// ------------------------------------------------------------
// Дошка на кожного користувача; тап циклічно міняє позначку лише в
// режимі редагування (захист від випадкових тапів). Спільний вихідний
// (обидва «Х») підсвічується серцем.
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
import { useSchedule, useScheduleMutation, MARK_CYCLE, type MarksMap } from './useSchedule';
import type { AppUser } from '@/types';

export function SchedulePage() {
  const { data: users = [] } = useUsers();
  const [{ yr, mo }, setYm] = useState(currentYearMonth);
  const [editMode, setEditMode] = useState(false);

  const { data: marks = {} } = useSchedule(yr, mo);
  const mutation = useScheduleMutation(yr, mo);

  const total = daysInMonth(yr, mo);
  const today = todayLocal();

  // Дати, де в ОБОХ стоїть «Х» — спільний вихідний.
  const commonOff = useMemo(() => {
    const set = new Set<string>();
    if (users.length < 2) return set;
    for (let d = 1; d <= total; d++) {
      const ds = ymd(yr, mo, d);
      if (users.every((u) => marks[u.id]?.[ds] === 'Х')) set.add(ds);
    }
    return set;
  }, [users, marks, yr, mo, total]);

  const onCell = (userId: number, date: string, current: string) => {
    if (!editMode || mutation.isPending) return;
    mutation.mutate({ userId, date, mark: MARK_CYCLE[current] ?? 'Р' });
  };

  return (
    <section className="sched">
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

      <button
        type="button"
        className={`sched-edit-toggle${editMode ? ' is-active' : ''}`}
        onClick={() => setEditMode((v) => !v)}
      >
        {editMode ? '✅ Завершити редагування' : '✏️ Редагувати графік'}
      </button>

      <div className={`sched-boards${editMode ? ' sched-boards--editing' : ''}`}>
        {users.map((u) => (
          <Board
            key={u.id}
            user={u}
            yr={yr}
            mo={mo}
            marks={marks}
            today={today}
            commonOff={commonOff}
            onCell={onCell}
          />
        ))}
      </div>
    </section>
  );
}

interface BoardProps {
  user: AppUser;
  yr: number;
  mo: number;
  marks: MarksMap;
  today: string;
  commonOff: Set<string>;
  onCell: (userId: number, date: string, current: string) => void;
}

function Board({ user, yr, mo, marks, today, commonOff, onCell }: BoardProps) {
  const total = daysInMonth(yr, mo);
  const offset = firstMondayOffset(yr, mo);
  const userMarks = marks[user.id] ?? {};

  return (
    <div className="card sched-board">
      <h3 className="sched-board-title">{user.name}</h3>
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
          const mark = userMarks[ds] ?? '';
          const isToday = ds === today;
          const isCommon = commonOff.has(ds);
          return (
            <button
              key={ds}
              type="button"
              className={
                'sched-cell' +
                (isToday ? ' sched-cell--today' : '') +
                (isCommon ? ' sched-cell--common-off' : '')
              }
              onClick={() => onCell(user.id, ds, mark)}
            >
              <span className="sched-cell-num">
                {day}
                {isCommon && <span className="sched-cell-heart">♥</span>}
              </span>
              <span
                className={
                  'sched-cell-letter' +
                  (mark === 'Р' ? ' sched-cell-letter--work' : '') +
                  (mark === 'Х' ? ' sched-cell-letter--off' : '')
                }
              >
                {mark}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
