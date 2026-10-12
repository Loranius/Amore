// ============================================================
// Смуга тижня над «Планами» (ADR-0256).
// ------------------------------------------------------------
// Місяць-сітка займав 40% першого вікна, щоб показати одну крапку, а
// потім сховався за рядок «Календар», і його перестали бачити зовсім.
// Смуга — середина: сім днів цього тижня з крапками (план — акцент,
// подія — колір дати), а дотик розгортає ТОЙ САМИЙ місяць на цьому ж
// місці. Окремого рядка «Календар» більше немає.
// ============================================================
import type { ReactNode } from 'react';
import { MONTHS_UA } from '@/features/_shared/month';
import { WEEKDAYS_SHORT, type WeekDay } from './planStage';

export function PlanWeekStrip({ days, open, onToggle, children }: {
  days: readonly WeekDay[];
  open: boolean;
  onToggle: () => void;
  /** Місяць — показується замість днів, коли смугу розгорнуто. */
  children: ReactNode;
}) {
  const today = days.find((day) => day.isToday) ?? days[0];
  const month = today ? MONTHS_UA[Number(today.iso.slice(5, 7)) - 1] ?? '' : '';
  const first = days[0]?.day;
  const last = days[days.length - 1]?.day;

  return (
    <section className="pf-week" data-open={open ? 'true' : undefined} aria-label="Цей тиждень">
      <button type="button" className="pf-week-toggle" aria-expanded={open} onClick={onToggle}>
        <span className="pf-week-head">
          <b>{month}</b>
          <small>{open ? 'Згорнути до тижня' : `${first}–${last} · весь місяць`}</small>
        </span>
        {!open && (
          <span className="pf-week-days">
            {days.map((day) => (
              <span
                key={day.iso}
                className="pf-week-day"
                aria-current={day.isToday ? 'date' : undefined}
                aria-label={[
                  `${WEEKDAYS_SHORT[day.weekday]} ${day.day}`,
                  day.hasPlan ? 'є план' : '',
                  day.hasEvent ? 'є подія' : '',
                ].filter(Boolean).join(', ')}
              >
                <i aria-hidden="true">{WEEKDAYS_SHORT[day.weekday]}</i>
                <b aria-hidden="true">{day.day}</b>
                <span className="pf-week-dots" aria-hidden="true">
                  {day.hasPlan && <span className="pf-week-dot" data-kind="plan" />}
                  {day.hasEvent && <span className="pf-week-dot" data-kind="event" />}
                </span>
              </span>
            ))}
          </span>
        )}
      </button>
      {open && <div className="pf-week-month">{children}</div>}
    </section>
  );
}
