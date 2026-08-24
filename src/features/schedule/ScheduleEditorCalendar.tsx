import { CheckIcon } from '@/components/icons/UiIcon';
import { DAYS_UA, daysInMonth, firstMondayOffset, ymd } from '@/features/_shared/month';
import type { AppUser } from '@/types';
import type { ScheduleMark } from './useSchedule';
import { markLabel, normalizeMark } from './scheduleEditorModel';

export function ScheduleEditorCalendar({
  user,
  yr,
  mo,
  today,
  userMarks,
  selectedMark,
  bulkMode,
  selectedDates,
  isPending,
  onDay,
}: {
  user: AppUser;
  yr: number;
  mo: number;
  today: string;
  userMarks: Record<string, string>;
  selectedMark: ScheduleMark;
  bulkMode: boolean;
  selectedDates: Set<string>;
  isPending: boolean;
  onDay: (date: string) => void;
}) {
  const total = daysInMonth(yr, mo);
  const offset = firstMondayOffset(yr, mo);

  return (
    <div className="card sched-board sched-board--editing">
      <h3 className="sched-board-title">Графік: {user.name}</h3>
      <p className="sched-editor-hint">
        {bulkMode
          ? `Обери дні, потім застосуй стан «${markLabel(selectedMark)}».`
          : `Торкнися дня, щоб встановити стан «${markLabel(selectedMark)}».`}
      </p>
      <div className="sched-grid">
        {DAYS_UA.map((dayName) => <div key={dayName} className="pcal-dow">{dayName}</div>)}
        {Array.from({ length: offset }).map((_, index) => (
          <div key={`empty-${index}`} className="sched-cell sched-cell--empty" />
        ))}
        {Array.from({ length: total }).map((_, index) => {
          const day = index + 1;
          const date = ymd(yr, mo, day);
          const mark = normalizeMark(userMarks[date]);
          const isSelected = selectedDates.has(date);
          return (
            <button
              key={date}
              type="button"
              className={
                'sched-cell sched-editor-cell' +
                (mark === 'Р' ? ' is-work' : '') +
                (mark === 'Х' ? ' is-off' : '') +
                (date === today ? ' sched-cell--today' : '') +
                (isSelected ? ' is-selected' : '')
              }
              onClick={() => onDay(date)}
              disabled={isPending}
              aria-pressed={bulkMode ? isSelected : undefined}
              aria-label={`${day}. ${markLabel(mark)}${isSelected ? '. Обрано' : ''}`}
            >
              <span className="sched-cell-num">{day}</span>
              <span className="sched-cell-letter">{mark}</span>
              {isSelected && <span className="sched-editor-check" aria-hidden="true"><CheckIcon size={11} /></span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
