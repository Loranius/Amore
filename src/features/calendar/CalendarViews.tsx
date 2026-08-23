// ============================================================
// Сітка місяця й огляд року.
// ------------------------------------------------------------
// Сітка показує повну картину місяця: календарні події, події «Нашого
// шляху» й плани. Список ПІД сіткою навмисно вужчий: там лишаються тільки
// утилітарні календарні записи (дні народження, свята й нагадування).
// Плани вже мають власні секції нижче на сторінці, а події стосунків
// відкриваються з головної (лічильник днів веде в «Наш шлях»), тому
// дублювати їх тут не потрібно.
//
// Вибраний день лишається повним контекстом дня: у DayPanel видно і події,
// і плани, бо це вже не місячний дубль, а детальний перегляд конкретної дати.
// ============================================================
import { useState } from 'react';
import {
  DAYS_UA, MONTHS_UA, currentYearMonth, daysInMonth, firstMondayOffset,
  formatDateUA, todayLocal, ymd,
} from '@/features/_shared/month';
import { pluralUA } from '@/lib/utils';
import { EventIcon } from '@/components/icons/EventIcon';
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from '@/components/icons/UiIcon';
import { PLAN_CATEGORIES } from '@/features/plans/planConstants';
import { TYPES } from './calendarUtils';
import { eventsByDay } from './calendarMonth';
import { planMuted, plansByDay } from './calendarPlans';
import type { EventRow, PlanRow } from '@/types';

/** Скільки позначок вміщується в клітинку дня, перш ніж вони зіллються. */
const MAX_DOTS = 3;

/**
 * Повернення до поточного місяця/року.
 *
 * З'являється лише коли ти НЕ там: інакше це кнопка, яка нічого не
 * робить, у найпомітнішому місці екрана. Догорнувши до 2029-го, назад
 * доводилось клацати стрілкою тридцять разів.
 */
function TodayButton({ show, onClick }: { show: boolean; onClick: () => void }) {
  if (!show) return null;
  return (
    <button type="button" className="cal-today-btn" onClick={onClick}>
      Сьогодні
    </button>
  );
}

/**
 * Чи належить подія до короткого місячного списку під календарем.
 *
 * anniversary — це «Наш шлях»; він і далі позначкою в сітці, але свій
 * окремий вхід має з головної, тому в короткому списку не дублюється.
 * birthday / holiday — саме календарні записи, заради яких цей список і є.
 */
function showInMonthList(event: EventRow): boolean {
  return event.type === 'birthday' || event.type === 'holiday';
}

// ── Місяць ───────────────────────────────────────────────────
export function CalendarMonthView({
  events, plans, yr, mo, onStepMonth, onGoToday, onOpenEvent, onOpenPlan, onAddOn,
}: {
  events: EventRow[];
  plans: PlanRow[];
  yr: number;
  mo: number;
  onStepMonth: (delta: number) => void;
  onGoToday: () => void;
  onOpenEvent: (ev: EventRow) => void;
  /** Відкрити сторінку плану — календар його лише показує, не редагує. */
  onOpenPlan: (id: number) => void;
  /** Створити подію на конкретну дату ('YYYY-MM-DD'). */
  onAddOn: (iso: string) => void;
}) {
  const monthName = MONTHS_UA[mo - 1] ?? '';
  const byDay = eventsByDay(events, yr, mo);
  const planDays = plansByDay(plans, yr, mo);
  const total = daysInMonth(yr, mo);
  const offset = firstMondayOffset(yr, mo);
  const today = todayLocal();
  const now = currentYearMonth();

  const [selected, setSelected] = useState<number | null>(null);
  // Вибір скидається при зміні місяця: 31-е число попереднього місяця в
  // наступному могло б не існувати взагалі.
  const [seenYm, setSeenYm] = useState(`${yr}-${mo}`);
  if (seenYm !== `${yr}-${mo}`) {
    setSeenYm(`${yr}-${mo}`);
    setSelected(null);
  }

  // Дні місяця з провідними порожніми клітинками під тиждень із понеділка.
  const cells: Array<number | null> = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: total }, (_, i) => i + 1),
  ];

  // Короткий список під сіткою — ТІЛЬКИ календарні записи. Саму сітку не
  // фільтруємо: на ній і надалі видно всі маркери, включно з планами та
  // подіями «Нашого шляху».
  const monthListByDay = new Map<number, EventRow[]>();
  for (const [day, dayEvents] of byDay.entries()) {
    const visible = dayEvents.filter(showInMonthList);
    if (visible.length > 0) monthListByDay.set(day, visible);
  }
  const chosen = [...monthListByDay.keys()].sort((a, b) => a - b);

  return (
    <div className="cal-month">
      <div className="cal-month-nav">
        <button type="button" className="cal-nav-btn" onClick={() => onStepMonth(-1)} aria-label="Попередній місяць">
          <ChevronLeftIcon size={18} />
        </button>
        <b>{monthName} {yr}</b>
        <TodayButton show={yr !== now.yr || mo !== now.mo} onClick={onGoToday} />
        <button type="button" className="cal-nav-btn" onClick={() => onStepMonth(1)} aria-label="Наступний місяць">
          <ChevronRightIcon size={18} />
        </button>
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
          const dayPlans = planDays.get(day) ?? [];
          const iso = ymd(yr, mo, day);
          const isToday = iso === today;
          const isSel = selected === day;
          // Не більше трьох позначок разом: далі вони зливаються в пляму.
          // Тут навмисно лишаються ВСІ типи: список нижче фільтрується,
          // а сама календарна сітка повинна давати повну картину дня.
          const dots = [...list.slice(0, MAX_DOTS), ...dayPlans].slice(0, MAX_DOTS);
          return (
            <button
              key={day}
              type="button"
              // Повторний тап по вибраному дню знімає вибір — так само,
              // як він його поставив. Окрема кнопка «закрити» для цього
              // не потрібна.
              onClick={() => setSelected(isSel ? null : day)}
              aria-pressed={isSel}
              aria-label={cellLabel(day, mo, list.length, dayPlans.length)}
              className={
                `cal-cell${list.length || dayPlans.length ? ' cal-cell--has' : ''}`
                + `${isToday ? ' cal-cell--today' : ''}${isSel ? ' cal-cell--sel' : ''}`
              }
            >
              <span className="cal-cell-n">{day}</span>
              {dots.length > 0 && (
                <span className="cal-cell-dots">
                  {dots.map((row) => (
                    'category' in row
                      ? (
                        <i
                          key={`p${row.id}`}
                          className="cal-dot-plan"
                          style={{ background: PLAN_CATEGORIES[row.category].color }}
                        />
                      )
                      : <i key={`e${row.id}`} style={{ background: TYPES[row.type ?? 'other'].mark }} />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {selected !== null ? (
        <DayPanel
          iso={ymd(yr, mo, selected)}
          list={byDay.get(selected) ?? []}
          plans={planDays.get(selected) ?? []}
          onOpenEvent={onOpenEvent}
          onOpenPlan={onOpenPlan}
          onAddOn={onAddOn}
          onClear={() => setSelected(null)}
        />
      ) : chosen.length === 0 ? (
        <p className="empty-state">Цього місяця немає календарних подій.</p>
      ) : (
        <div className="cal-month-list">
          {chosen.map((day) => {
            const dayEvents = monthListByDay.get(day) ?? [];
            if (dayEvents.length === 0) return null;
            return (
              <div key={day} className="cal-day-block">
                <div className="cal-day-num">{formatDateUA(ymd(yr, mo, day), { year: false })}</div>
                {dayEvents.map((ev) => (
                  <EventLine key={`e${ev.id}`} ev={ev} onOpen={onOpenEvent} />
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Підпис клітинки для читалки: події й плани рахуються окремо, бо це
 *  різні речі, і «3 події» на дні з одним планом було б неправдою. */
function cellLabel(day: number, mo: number, events: number, plans: number): string {
  const parts: string[] = [];
  if (events) parts.push(`${events} ${pluralUA(events, ['подія', 'події', 'подій'])}`);
  if (plans) parts.push(`${plans} ${pluralUA(plans, ['план', 'плани', 'планів'])}`);
  return `${day} ${MONTHS_UA[mo - 1]}${parts.length ? `, ${parts.join(', ')}` : ''}`;
}

function EventLine({ ev, onOpen }: { ev: EventRow; onOpen: (ev: EventRow) => void }) {
  return (
    <button type="button" className="cal-day-event" onClick={() => onOpen(ev)}>
      <span style={{ color: TYPES[ev.type ?? 'other'].mark, display: 'flex' }}>
        <EventIcon type={ev.type} size={19} />
      </span>
      <span className="cal-day-event-title">{ev.title}</span>
    </button>
  );
}

/**
 * Рядок плану в календарі.
 *
 * Виглядає як рядок події, але веде на сторінку плану, а не в модалку
 * редагування: календар плани лише показує. Підпис «План» потрібен саме
 * тому — без нього тап відкривав би зовсім не те, чого чекаєш.
 */
function PlanLine({ plan, span = 1, onOpen }: {
  plan: PlanRow;
  /** Скільки днів цього місяця займає план — підпис для багатоденних. */
  span?: number;
  onOpen: (id: number) => void;
}) {
  const cat = PLAN_CATEGORIES[plan.category];
  return (
    <button
      type="button"
      className={`cal-day-event cal-day-plan${planMuted(plan) ? ' cal-muted' : ''}`}
      onClick={() => onOpen(plan.id)}
    >
      <span style={{ color: cat.color, display: 'flex' }}>
        <cat.Icon size={19} />
      </span>
      <span className="cal-day-event-title">{plan.title}</span>
      {span > 1 && (
        <span className="cal-day-plan-span">{span} {pluralUA(span, ['день', 'дні', 'днів'])}</span>
      )}
      <span className="cal-day-plan-tag">План</span>
    </button>
  );
}

/**
 * Панель вибраного дня.
 *
 * Замінює список місяця, а не додається до нього: інакше події
 * вибраного дня стояли б на екрані двічі — рівно та вада, яку вже
 * виправляли в банері «найближчої».
 *
 * Порожній день теж має панель. Саме вона й важлива: тапнути вільне
 * число і завести на нього подію — те, заради чого сітку відкривають
 * так само часто, як заради перегляду.
 */
function DayPanel({
  iso, list, plans, onOpenEvent, onOpenPlan, onAddOn, onClear,
}: {
  iso: string;
  list: EventRow[];
  plans: PlanRow[];
  onOpenEvent: (ev: EventRow) => void;
  onOpenPlan: (id: number) => void;
  onAddOn: (iso: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="cal-day-panel">
      <div className="cal-day-panel-hd">
        <b>{formatDateUA(iso)}</b>
        <button type="button" className="cal-day-panel-all" onClick={onClear}>
          Весь місяць
        </button>
      </div>
      {list.length === 0 && plans.length === 0 ? (
        <p className="cal-day-panel-empty">Цього дня нічого не заплановано.</p>
      ) : (
        <>
          {list.map((ev) => <EventLine key={`e${ev.id}`} ev={ev} onOpen={onOpenEvent} />)}
          {plans.map((p) => <PlanLine key={`p${p.id}`} plan={p} onOpen={onOpenPlan} />)}
        </>
      )}
      <button type="button" className="cal-day-panel-add" onClick={() => onAddOn(iso)}>
        <PlusIcon size={15} /> Додати на {formatDateUA(iso, { year: false })}
      </button>
    </div>
  );
}

// ── Рік ──────────────────────────────────────────────────────
//
// Огляду року тут більше немає. Він жив на сторінці календаря, а сторінки не
// стало: власник звів календар і плани в один модуль із двома вкладками, і
// третій поверх перемикачів (список / місяць / рік) робив би з екрана панель
// керування. Місяць лишився — його показують першим.
