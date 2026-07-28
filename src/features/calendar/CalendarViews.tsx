// ============================================================
// Сітка місяця й огляд року.
// ------------------------------------------------------------
// Список відповідає «що найближче». Сітка — «що в липні», рік — «коли в
// нас густо». Модуль зветься календарем від першого дня й досі жодного
// з цих двох питань не брав на себе.
//
// На відміну від списку, обидва вигляди показують УСІ типи одразу: сенс
// календаря саме в тому, щоб побачити день народження й річницю поруч.
// Тому вкладки типів у них не показуються.
//
// Сітка була німою: дні малювались як <div>, тож тапнути 5 липня і щось
// із ним зробити було неможливо — а це головний жест будь-якого
// календаря. Тепер день це кнопка, вибраний день відкриває свою панель
// замість списку місяця, і з неї ж додається подія САМЕ на цю дату.
//
// Плани приходять ОКРЕМИМ пропом із власної таблиці: у календарі вони
// гості, а не події. Тому в них свій значок-позначка (смужка проти
// круглої крапки), свій колір категорії й тап веде не в модалку події,
// а на сторінку плану.
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
import { eventsByDay, yearHeat, yearSummary } from './calendarMonth';
import { planMuted, planYearTotal, plansByDay, plansByMonth } from './calendarPlans';
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

  // Список під сіткою — об'єднання днів із подіями і днів із планами:
  // день, у якому є лише план, мусить у ньому бути, інакше сітка знову
  // стане німою рівно для планів.
  const chosen = [...new Set([...byDay.keys(), ...planDays.keys()])].sort((a, b) => a - b);

  // Багатоденний план стоїть у списку РАЗ — під своїм першим днем у цьому
  // місяці, з підписом «3 дні». У сітці й у панелі дня він займає кожен
  // свій день (там питання «що 22-го»), але списком три однакові рядки
  // поспіль нічого не додавали б.
  const listPlans = new Map<number, Array<{ plan: PlanRow; span: number }>>();
  const spans = new Map<number, number>();
  for (const list of planDays.values()) {
    for (const p of list) spans.set(p.id, (spans.get(p.id) ?? 0) + 1);
  }
  const listed = new Set<number>();
  for (const day of chosen) {
    for (const p of planDays.get(day) ?? []) {
      if (listed.has(p.id)) continue;
      listed.add(p.id);
      const bucket = listPlans.get(day);
      const entry = { plan: p, span: spans.get(p.id) ?? 1 };
      if (bucket) bucket.push(entry);
      else listPlans.set(day, [entry]);
    }
  }

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
          // Не більше трьох позначок разом: далі вони зливаються в пляму
          // й перестають щось означати. Події йдуть першими — план
          // однаково видно смужкою в списку під сіткою.
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
        /* Під сіткою — самі події й плани місяця. Крапка каже «щось є»,
           але не каже що; без цього списку сітка була б красивою й німою. */
        <p className="empty-state">Цього місяця нічого немає.</p>
      ) : (
        <div className="cal-month-list">
          {chosen.map((day) => {
            const dayEvents = byDay.get(day) ?? [];
            const dayPlans = listPlans.get(day) ?? [];
            // День, у якому лишились самі «продовження» багатоденного
            // плану, у списку не потрібен: заголовок дати без жодного
            // рядка під ним.
            if (dayEvents.length === 0 && dayPlans.length === 0) return null;
            return (
              <div key={day} className="cal-day-block">
                <div className="cal-day-num">{formatDateUA(ymd(yr, mo, day), { year: false })}</div>
                {dayEvents.map((ev) => (
                  <EventLine key={`e${ev.id}`} ev={ev} onOpen={onOpenEvent} />
                ))}
                {dayPlans.map(({ plan, span }) => (
                  <PlanLine key={`p${plan.id}`} plan={plan} span={span} onOpen={onOpenPlan} />
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
export function CalendarYearView({
  events, plans, yr, onStepYear, onGoToday, onOpenMonth,
}: {
  events: EventRow[];
  plans: PlanRow[];
  yr: number;
  onStepYear: (delta: number) => void;
  onGoToday: () => void;
  onOpenMonth: (month: number) => void;
}) {
  const planCounts = plansByMonth(plans, yr);
  const eventMonths = yearSummary(events, yr);
  // Плани входять у кількість ДО розрахунку насиченості: інакше місяць
  // із тижневим походом і без подій лишився б блідим, а питання
  // річного огляду — «де в нас густо», а не «де густо на події».
  const months = yearHeat(
    eventMonths.map((m) => ({ ...m, count: m.count + (planCounts[m.month - 1] ?? 0) })),
  );
  const eventTotal = eventMonths.reduce((n, m) => n + m.count, 0);
  // Рахуємо РІЗНІ плани, а не суму по місяцях: похід через межу року
  // інакше став би двома.
  const planTotal = planYearTotal(plans, yr);
  const now = currentYearMonth();

  return (
    <div className="cal-year">
      <div className="cal-month-nav">
        <button type="button" className="cal-nav-btn" onClick={() => onStepYear(-1)} aria-label="Попередній рік">
          <ChevronLeftIcon size={18} />
        </button>
        <b>{yr}</b>
        <TodayButton show={yr !== now.yr} onClick={onGoToday} />
        <button type="button" className="cal-nav-btn" onClick={() => onStepYear(1)} aria-label="Наступний рік">
          <ChevronRightIcon size={18} />
        </button>
      </div>

      {/* Події й плани рахуються окремо: злити їх в одне число означало б
          назвати похід подією, а це вже інший модуль. */}
      <p className="cal-year-total">
        {eventTotal} {pluralUA(eventTotal, ['подія', 'події', 'подій'])} за рік
        {planTotal > 0 && <> · {planTotal} {pluralUA(planTotal, ['план', 'плани', 'планів'])}</>}
      </p>

      <div className="cal-year-grid">
        {months.map((m) => (
          <button
            key={m.month}
            type="button"
            className={`cal-year-cell${m.count ? ' cal-year-cell--has' : ''}${m.month === now.mo && yr === now.yr ? ' cal-year-cell--now' : ''}`}
            // Насиченість пропорційна кількості: до цього огляд був
            // двійковим і на питання «де густо» не відповідав.
            style={{ '--cal-heat': m.heat } as React.CSSProperties}
            onClick={() => onOpenMonth(m.month)}
          >
            <b>{MONTHS_UA[m.month - 1]}</b>
            <span className="cal-year-dots">
              {m.types.map((t) => (
                <i key={t} style={{ background: TYPES[t as keyof typeof TYPES].mark }} />
              ))}
              {/* Одна смужка на весь місяць, а не по одній на план:
                  крапки тут відповідають на «що саме», а не «скільки». */}
              {(planCounts[m.month - 1] ?? 0) > 0 && <i className="cal-dot-plan" />}
            </span>
            <small>{m.count || '—'}</small>
          </button>
        ))}
      </div>
    </div>
  );
}
