import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Link } from 'react-router-dom';
import { PLAN_CATEGORIES } from './planConstants';
import { waitingSince } from './PlanFocusHero';
import type { PlanRow } from '@/types';
import {
  DECK_DRAG_SLOP,
  DECK_TRANSITION_MS,
  deckMove,
  deckResist,
  deckStep,
  type DeckMove,
} from './ideaDeckSwipe';

// ============================================================
// Колода задумів: екран, який перетворює задум на план.
// ------------------------------------------------------------
// ЦЕ СЕРЦЕ ВАРІАНТА C, і воно виросло з заміру, а не зі смаку: у базі пари
// **п'ять із шести відкритих записів не мають дати**. Список, який показує
// їх плитками поруч із датованими, ставить не те питання. Питання одне —
// «а коли?», — і тут на нього є рівно одна кнопка.
//
// ЧОМУ КОЛОДА, А НЕ СПИСОК. Список із п'яти однакових карток просить
// вибрати; колода показує ОДИН і питає про нього. Порядок не випадковий:
// `ideaQueue` кладе першим той, що лежить найдовше (`Гончарство` — від
// 29 липня). Тобто екран сам піднімає найзанедбаніше, а не те, що згори.
//
// ЧОМУ НАТИВНИЙ `input[type=date]`, А НЕ ВЛАСНИЙ КАЛЕНДАР. Той самий
// елемент уже стоїть на сторінці плану (`PlanDetailsPage`), і другий
// спосіб вибрати дату означав би дві різні поведінки на одне поле. Плюс
// нативний віджет — це календар телефона з його мовою, розміром дотику й
// доступністю, які ми не переписуємо краще.
//
// ЩО ВІН ПИШЕ. `date_precision: 'day'` разом зі `start_date` — саме та
// пара, якої чекає `hasPreciseDate`, тобто задум одразу стає видимим і в
// сітці місяця, і у відліку. Без `date_precision` план лишився б «без
// точної дати» й зник би з обох.
// ============================================================

/*
 * СВАЙП ЗАМІСТЬ «ДАЛІ» (ADR-0213). Власник: «свайп вверх — наступний план,
 * вниз — попередній, каруселлю; прибери кнопку "далі"». Рішення «гортати чи
 * ні» — чисте й під тестом (`ideaDeckSwipe.ts`); тут лише жест і рух.
 *
 * ЦІНА НАЗВАНА. Вертикальний свайп і прокрутка сторінки — один і той самий
 * рух пальця, тож на самій картці сторінка вертикально не гортається
 * (`touch-action: pan-x`). Над і під карткою — гортається як завжди.
 *
 * Клавіатура не втрачає нічого: картка фокусується, ↓ — наступний, ↑ —
 * попередній, а лічильник оголошує, де ти.
 */
type DeckPhase =
  | { kind: 'idle' }
  | { kind: 'drag'; offset: number }
  | { kind: 'leave'; move: DeckMove }
  | { kind: 'enter'; move: DeckMove };

function reducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function PlanIdeaDeck({ ideas, onPickDate, busy }: {
  ideas: readonly PlanRow[];
  onPickDate: (id: number, iso: string) => void;
  busy: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<DeckPhase>({ kind: 'idle' });
  const dateRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const gesture = useRef<{
    id: number; startY: number; startX: number; lastY: number; lastT: number; velocity: number; dragging: boolean;
  } | null>(null);
  // Після свайпу дотик уже не клік: інакше відпускання над кнопкою
  // «Запланувати» відкривало б календар посеред перегортання.
  const swallowClick = useRef(false);
  const timer = useRef<number | null>(null);

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);

  const count = ideas.length;

  const go = useCallback((move: DeckMove) => {
    if (move === 'stay' || count < 2) {
      setPhase({ kind: 'idle' });
      return;
    }
    if (reducedMotion()) {
      // §47: без подорожі — картка просто змінюється.
      setIndex((current) => deckStep(current % count, move, count));
      setPhase({ kind: 'idle' });
      return;
    }
    setPhase({ kind: 'leave', move });
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setIndex((current) => deckStep(current % count, move, count));
      setPhase({ kind: 'enter', move });
      // Два кадри: перший ставить нову картку за краєм без переходу,
      // другий уже з переходом везе її на місце.
      requestAnimationFrame(() => requestAnimationFrame(() => setPhase({ kind: 'idle' })));
    }, DECK_TRANSITION_MS);
  }, [count]);

  if (count === 0) return null;

  // Індекс може пережити зміну списку (задум дістав дату й пішов), тож
  // беремо його по колу, а не довіряємо збереженому числу.
  const position = index % count;
  const idea = ideas[position]!;
  const cat = PLAN_CATEGORIES[idea.category];
  const behind = Math.min(2, count - 1);

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (count < 2 || phase.kind === 'leave') return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    gesture.current = {
      id: event.pointerId,
      startY: event.clientY,
      startX: event.clientX,
      lastY: event.clientY,
      lastT: event.timeStamp,
      velocity: 0,
      dragging: false,
    };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const g = gesture.current;
    if (g === null || g.id !== event.pointerId) return;
    const dy = event.clientY - g.startY;
    if (!g.dragging) {
      // Горизонтальний рух — не наш: він може бути прокруткою чогось поруч.
      if (Math.abs(event.clientX - g.startX) > Math.abs(dy)) {
        if (Math.abs(event.clientX - g.startX) > DECK_DRAG_SLOP) gesture.current = null;
        return;
      }
      if (Math.abs(dy) < DECK_DRAG_SLOP) return;
      g.dragging = true;
      swallowClick.current = true;
      try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* вказівник уже зник */ }
    }
    const dt = event.timeStamp - g.lastT;
    if (dt > 0) g.velocity = (event.clientY - g.lastY) / dt;
    g.lastY = event.clientY;
    g.lastT = event.timeStamp;
    const height = cardRef.current?.offsetHeight ?? 200;
    setPhase({ kind: 'drag', offset: deckResist(dy, height) });
  };

  const finish = (event: ReactPointerEvent<HTMLElement>, cancelled: boolean) => {
    const g = gesture.current;
    gesture.current = null;
    if (g === null || g.id !== event.pointerId || !g.dragging) return;
    // Палець, що зупинився перед відпусканням, не кидає.
    const still = event.timeStamp - g.lastT > 80;
    const height = cardRef.current?.offsetHeight ?? 200;
    const move = cancelled
      ? 'stay'
      : deckMove(event.clientY - g.startY, still ? 0 : g.velocity, height, count);
    go(move);
  };

  const cardStyle = ((): React.CSSProperties => {
    switch (phase.kind) {
      case 'drag':
        return { transform: `translateY(${phase.offset}px)`, transition: 'none' };
      case 'leave':
        return {
          transform: `translateY(${phase.move === 'next' ? '-70%' : '70%'})`,
          opacity: 0,
        };
      case 'enter':
        return {
          transform: `translateY(${phase.move === 'next' ? '28%' : '-28%'}) scale(0.96)`,
          opacity: 0,
          transition: 'none',
        };
      default:
        return {};
    }
  })();

  return (
    <section className="pf-deck" aria-label="Задуми без дати" aria-roledescription="карусель">
      {/*
        * Стос має ВЛАСНУ обгортку, і це не зайвий div. Нижні картки
        * тягнуться `inset: 0`, тобто рівно по передній — а поки вони
        * міряли всю секцію, вони накривали лічильник під нею. Побачив це
        * живий знімок, не типізація.
        */}
      <div className="pf-deck-stack">
      {/*
        * Нижні картки — суто тло колоди, тому `aria-hidden`: вони нічого
        * не називають, і озвучувати порожні картки означало б читати
        * вголос тінь.
        */}
      {Array.from({ length: behind }, (_, layer) => (
        <div key={layer} className={`pf-card pf-card--behind pf-card--l${layer + 1}`} aria-hidden="true" />
      ))}

      <article
        ref={cardRef}
        className={`pf-card${count > 1 ? ' pf-card--swipe' : ''}`}
        style={{ '--plan-color': cat.color, ...cardStyle } as React.CSSProperties}
        tabIndex={count > 1 ? 0 : undefined}
        aria-label={count > 1 ? `${idea.title}. Свайп угору — наступний задум, униз — попередній.` : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(event) => finish(event, false)}
        onPointerCancel={(event) => finish(event, true)}
        onClickCapture={(event) => {
          if (!swallowClick.current) return;
          swallowClick.current = false;
          event.preventDefault();
          event.stopPropagation();
        }}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget || count < 2) return;
          if (event.key === 'ArrowDown') { event.preventDefault(); go('next'); }
          if (event.key === 'ArrowUp') { event.preventDefault(); go('prev'); }
        }}
      >
        <span className="pf-card-cat">
          <cat.Icon size={13} /> {cat.label}
        </span>
        <h3 className="pf-card-title">
          <Link to={`/plans/${idea.id}`}>{idea.title}</Link>
        </h3>
        <p className="pf-card-why">Лежить без дати від {waitingSince(idea.created_at)}.</p>

        {/*
          * `.btn` — це і є головна дія порталу. Перша редакція написала
          * `.btn-primary`, класу, якого в CSS немає ЖОДНОГО правила, і
          * сторож `modalActions.test.ts` упіймав це одразу.
          *
          * «Далі» ПРИБРАНО (ADR-0213): гортає свайп, і кнопка лишилась би
          * другою дорогою до того самого, що забирала пів рядка в головної.
          */}
        <div className="pf-card-acts">
          <button
            type="button"
            className="btn pf-card-date"
            disabled={busy}
            onClick={() => {
              const input = dateRef.current;
              if (!input) return;
              /*
               * `showPicker` відкриває віджет одразу; там, де його немає,
               * лишається звичайний фокус — поле стоїть поруч і видиме
               * для клавіатури, а не сховане за `display: none`.
               */
              if (typeof input.showPicker === 'function') input.showPicker();
              else input.focus();
            }}
          >
            Запланувати
          </button>
        </div>

        <input
          key={idea.id}
          ref={dateRef}
          className="pf-card-input"
          type="date"
          aria-label={`Дата для «${idea.title}»`}
          onChange={(event) => {
            const iso = event.target.value;
            if (iso) onPickDate(idea.id, iso);
          }}
        />
      </article>
      </div>

      <p className="pf-deck-count" aria-live="polite">
        {position + 1} з {count}
      </p>
    </section>
  );
}
