import { MONTHS_UA, stepMonth } from '@/features/_shared/month';

export function ScheduleMonthNav({
  yr,
  mo,
  onChange,
}: {
  yr: number;
  mo: number;
  onChange: (next: { yr: number; mo: number }) => void;
}) {
  return (
    <div className="sched-nav">
      <button type="button" className="sched-nav-btn" onClick={() => onChange(stepMonth(yr, mo, -1))} aria-label="Попередній місяць">‹</button>
      <span className="sched-month-label">{MONTHS_UA[mo - 1]} {yr}</span>
      <button type="button" className="sched-nav-btn" onClick={() => onChange(stepMonth(yr, mo, 1))} aria-label="Наступний місяць">›</button>
    </div>
  );
}
