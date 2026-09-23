import { DAYS_UA, daysInMonth, firstMondayOffset, ymd } from '@/features/_shared/month';
import type { AppUser, PlanRow } from '@/types';
import type { MarksMap } from './useSchedule';
import type { DayStatus } from './scheduleViewModel';
import { fmtLongDate, statusText } from './scheduleViewModel';

// ============================================================
// Сітка місяця — ДВІ ДОРІЖКИ в кожному дні (ADR-0208, варіант A).
// ------------------------------------------------------------
// ЩО ЗМІНИЛОСЬ І ЧОМУ. Раніше стан дня казав лише ВІДТІНОК: чотири стани
// розрізнялись кольором заливки, та ще й підкреслення повторювало те саме
// вдруге. Хто саме вільний, доводилось згадувати з легенди — а легенда
// пояснювала помаранчеву крапку й мовчала про кольори.
//
// Тепер відповідає МІСЦЕ: верхня смужка — Лєна, нижня — Діма. Заповнена
// означає вихідний. Спільний день додає рамку, тобто третій стан не
// вигадує третього кольору, а складається з двох перших.
//
// ДОТИК ПЕРЕМИКАЄ ДЕНЬ, і режим правки для цього більше не потрібен.
// Перемикач між «Р» і «Х» сам собі скасування: другий дотик повертає
// попереднє.
//
// ЧОМУ НЕ «ТОРКНУТИСЯ САМЕ СМУЖКИ», ЯК ОБІЦЯВ МАКЕТ. Виміряно на живому
// екрані: клітинка дня — рівно **44×44**, тобто мінімальна ціль дотику.
// Дві незалежні цілі в ній дали б по 22 пікселі, тобто вдвічі менше за
// поріг. Тому доріжку, яку правиш, обирає видимий чип над сіткою, а
// клітинка лишається однією ціллю. Це відхилення від макета, і воно
// зроблене заміром, а не смаком.
// ============================================================

export function ScheduleMonthOverview({
  yr,
  mo,
  today,
  usersCount,
  statusCounts,
  statusOf,
  plansOn,
  onSelectDate,
  marks,
  users,
  lena,
  dima,
  editingUserId,
  onPickUser,
  editable,
  selectedDate,
}: {
  yr: number;
  mo: number;
  today: string;
  usersCount: number;
  statusCounts: { both: number; lena: number; dima: number };
  statusOf: Map<string, DayStatus>;
  /** Плани, що ЗАЙМАЮТЬ цей день (`planOccupiesDate`). */
  plansOn: (iso: string) => PlanRow[];
  onSelectDate: (date: string) => void;
  marks: MarksMap;
  users: AppUser[];
  lena: AppUser | undefined;
  dima: AppUser | undefined;
  /** Чию доріжку перемикає дотик. `null` — правити нема кому. */
  editingUserId: number | null;
  onPickUser: (userId: number) => void;
  editable: boolean;
  selectedDate: string | null;
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

      {/* Чий рядок правиш. Видимий і постійний — це не режим: сітка
          завжди жива й завжди показує обох. */}
      {editable && users.length >= 2 && (
        <div className="sched-lane-pick" role="radiogroup" aria-label="Чий графік правити дотиком">
          {users.map((user) => (
            <button
              key={user.id}
              type="button"
              role="radio"
              aria-checked={user.id === editingUserId}
              className={user.id === editingUserId ? 'is-active' : ''}
              onClick={() => onPickUser(user.id)}
            >
              {user.name}
            </button>
          ))}
        </div>
      )}

      <div className="card sched-board sched-board--overview">
        <div className="sched-grid">
          {DAYS_UA.map((dayName) => <div key={dayName} className="pcal-dow">{dayName}</div>)}
          {Array.from({ length: offset }).map((_, index) => <div key={`empty-${index}`} className="sched-cell sched-cell--empty" />)}
          {Array.from({ length: total }).map((_, index) => {
            const day = index + 1;
            const date = ymd(yr, mo, day);
            const status = statusOf.get(date) ?? 'none';
            const plans = plansOn(date);
            // Крапка «підтверджено» — про згоду партнера, а не про статус
            // підготовки: саме це питання ставлять, дивлячись на графік.
            const confirmed = plans.some((plan) => plan.confirmed);
            const herOff = lena ? marks[lena.id]?.[date] === 'Х' : false;
            const himOff = dima ? marks[dima.id]?.[date] === 'Х' : false;
            const mineOff = editingUserId !== null ? marks[editingUserId]?.[date] === 'Х' : false;
            return (
              <button
                key={date}
                type="button"
                className={`sched-cell sched-cell--interactive sched-cell--${status}${date === today ? ' sched-cell--today' : ''}${date === selectedDate ? ' is-picked' : ''}`}
                onClick={() => onSelectDate(date)}
                aria-label={
                  `${fmtLongDate(date)}. ${statusText(status)}`
                  + `${plans.length ? '. Є план на цей день' : ''}`
                  + (editable ? `. Торкніться, щоб зробити ${mineOff ? 'робочим' : 'вихідним'}` : '')
                }
              >
                <span className="sched-cell-num">{day}</span>
                {/*
                  * ДВІ ДОРІЖКИ ЗАМІСТЬ ОДНОГО СИМВОЛУ. Тут стояла одна
                  * смужка, а поруч — коментар «колір уже сказав, хто
                  * вільний». Саме це припущення власник і назвав
                  * незрозумілим: відтінок мусив нести ім'я, а імені в
                  * ньому немає.
                  */}
                <span className="sched-cell-lanes" aria-hidden="true">
                  <i className={`sched-lane sched-lane--her${herOff ? ' is-off' : ''}`} />
                  <i className={`sched-lane sched-lane--him${himOff ? ' is-off' : ''}`} />
                </span>
                {plans.length > 0 && <span className={`sched-cell-plan-dot${confirmed ? ' is-confirmed' : ''}`} title={confirmed ? 'Підтверджений план' : 'Запропонований план'} />}
              </button>
            );
          })}
        </div>
      </div>


    </>
  );
}
