import { MONTHS_UA, currentYearMonth, stepMonth } from '@/features/_shared/month';

export function ScheduleMonthNav({
  yr,
  mo,
  onChange,
}: {
  yr: number;
  mo: number;
  onChange: (next: { yr: number; mo: number }) => void;
}) {
  const current = currentYearMonth();
  const isCurrentMonth = current.yr === yr && current.mo === mo;

  return (
    <div className="sched-nav">
      <button type="button" className="sched-nav-btn" onClick={() => onChange(stepMonth(yr, mo, -1))} aria-label="Попередній місяць">‹</button>
      <div className="sched-month-center">
        <span className="sched-month-label">{MONTHS_UA[mo - 1]} {yr}</span>
        <button
          type="button"
          className="sched-today-btn"
          onClick={() => onChange(current)}
          disabled={isCurrentMonth}
        >
          {isCurrentMonth ? 'Поточний місяць' : 'Сьогодні'}
        </button>
      </div>
      <button type="button" className="sched-nav-btn" onClick={() => onChange(stepMonth(yr, mo, 1))} aria-label="Наступний місяць">›</button>
    </div>
  );
}
