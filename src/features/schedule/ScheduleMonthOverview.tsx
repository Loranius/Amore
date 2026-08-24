import { DAYS_UA, daysInMonth, firstMondayOffset, ymd } from '@/features/_shared/month';
import type { PlanRow } from '@/types';
import type { DayStatus } from './scheduleViewModel';
import { fmtLongDate, statusText } from './scheduleViewModel';

export function ScheduleMonthOverview({
  yr,
  mo,
  today,
  usersCount,
  statusCounts,
  statusOf,
  plansByDate,
  onSelectDate,
}: {
  yr: number;
  mo: number;
  today: string;
  usersCount: number;
  statusCounts: { both: number; lena: number; dima: number };
  statusOf: Map<string, DayStatus>;
  plansByDate: Map<string, PlanRow[]>;
  onSelectDate: (date: string) => void;
}) {
  const total = daysInMonth(yr, mo);
  const offset = firstMondayOffset(yr, mo);

  return (
    <>
      {/*
        * Легенда стоїть НАД сіткою й несе числа.
        *
        * Дві виміряні вади в одному місці. Плитки «9 спільні / 10 Діма /
        * 16 Лєна» стояли згори, а легенда кольорів — знизу, на y=905 при
        * вікні 915: тобто код кольору пояснювався під доком, там, де
        * його ніхто не бачить. І казали вони те саме різними словами.
        *
        * Тепер це один рядок: колір, підпис і число разом. Хто дивиться
        * на сітку — бачить, що означає тон; хто рахує — бачить скільки.
        */}
      {usersCount >= 2 && (
        <div className="sched-key" aria-label="Скільки вихідних цього місяця">
          <span className="sched-key-item sched-key-item--both">
            <i className="sched-key-swatch" />
            <span className="sched-key-label">разом</span>
            <b>{statusCounts.both}</b>
          </span>
          <span className="sched-key-item sched-key-item--her">
            <i className="sched-key-swatch" />
            <span className="sched-key-label">Лєна</span>
            <b>{statusCounts.lena}</b>
          </span>
          <span className="sched-key-item sched-key-item--him">
            <i className="sched-key-swatch" />
            <span className="sched-key-label">Діма</span>
            <b>{statusCounts.dima}</b>
          </span>
        </div>
      )}

      {/* Підпис до крапки — НАД сіткою, разом із ключем.
          Знизу він опинявся під доком: рівно та сама вада, від якої
          сюди переїхала легенда кольорів. */}
      <p className="sched-plan-note">
        <i className="sched-key-swatch sched-key-swatch--plan" />
        крапка в кутку дня — на нього вже є план
      </p>

      <div className="card sched-board sched-board--overview">
        <div className="sched-grid">
          {DAYS_UA.map((dayName) => <div key={dayName} className="pcal-dow">{dayName}</div>)}
          {Array.from({ length: offset }).map((_, index) => <div key={`empty-${index}`} className="sched-cell sched-cell--empty" />)}
          {Array.from({ length: total }).map((_, index) => {
            const day = index + 1;
            const date = ymd(yr, mo, day);
            const status = statusOf.get(date) ?? 'none';
            const plans = plansByDate.get(date) ?? [];
            // Крапка «підтверджено» — про згоду партнера, а не про статус
            // підготовки: саме це питання ставлять, дивлячись на графік.
            const confirmed = plans.some((plan) => plan.confirmed);
            return (
              <button
                key={date}
                type="button"
                className={`sched-cell sched-cell--interactive sched-cell--${status}${date === today ? ' sched-cell--today' : ''}`}
                onClick={() => onSelectDate(date)}
                aria-label={`${fmtLongDate(date)}. ${statusText(status)}${plans.length ? '. Є план на цей день' : ''}`}
              >
                <span className="sched-cell-num">{day}</span>
                {/* Смужка, а не літера «Л»/«Д»: колір уже сказав, хто
                    вільний, а літера була третім сигналом на 42 пікселях
                    і змагалась із самою датою. Хто саме — читає легенда
                    згори й `aria-label` клітинки. */}
                <span className="sched-cell-symbol" aria-hidden="true" />
                {plans.length > 0 && <span className={`sched-cell-plan-dot${confirmed ? ' is-confirmed' : ''}`} title={confirmed ? 'Підтверджений план' : 'Запропонований план'} />}
              </button>
            );
          })}
        </div>
      </div>


    </>
  );
}
