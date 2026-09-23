import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PLAN_CATEGORIES } from './planConstants';
import { waitingSince } from './PlanFocusHero';
import type { PlanRow } from '@/types';

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

export function PlanIdeaDeck({ ideas, onPickDate, busy }: {
  ideas: readonly PlanRow[];
  onPickDate: (id: number, iso: string) => void;
  busy: boolean;
}) {
  const [index, setIndex] = useState(0);
  const dateRef = useRef<HTMLInputElement>(null);

  if (ideas.length === 0) return null;

  // Індекс може пережити зміну списку (задум дістав дату й пішов), тож
  // беремо його по колу, а не довіряємо збереженому числу.
  const position = index % ideas.length;
  const idea = ideas[position]!;
  const cat = PLAN_CATEGORIES[idea.category];
  const behind = Math.min(2, ideas.length - 1);

  return (
    <section className="pf-deck" aria-label="Задуми без дати">
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
        className="pf-card"
        style={{ '--plan-color': cat.color } as React.CSSProperties}
      >
        <span className="pf-card-cat">
          <cat.Icon size={13} /> {cat.label}
        </span>
        <h3 className="pf-card-title">
          <Link to={`/plans/${idea.id}`}>{idea.title}</Link>
        </h3>
        <p className="pf-card-why">Лежить без дати від {waitingSince(idea.created_at)}.</p>

        {/*
          * `.btn` — це і є головна дія порталу, `.btn-ghost` — тиха.
          * Перша редакція написала `.btn-primary`, класу, якого в CSS
          * немає ЖОДНОГО правила, і сторож `modalActions.test.ts` упіймав
          * це одразу: у нього записано, що два місця вже носили цей клас
          * і були неоформленими браузерними кнопками.
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
            Дати дату
          </button>
          {ideas.length > 1 && (
            <button
              type="button"
              className="btn btn-ghost pf-card-next"
              onClick={() => setIndex((current) => current + 1)}
            >
              Далі
            </button>
          )}
        </div>

        <input
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

      <p className="pf-deck-count">
        {position + 1} з {ideas.length}
      </p>
    </section>
  );
}
