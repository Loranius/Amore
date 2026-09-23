import { Link } from 'react-router-dom';
import { formatDateUA } from '@/features/_shared/month';
import { PLAN_CATEGORIES } from './planConstants';
import { planCountdown, planDateLabel } from './planModel';
import { planProgress } from './planFocus';
import type { PlanRow } from '@/types';

// ============================================================
// Верх модуля «Плани»: один план, заради якого його відкривають.
// ------------------------------------------------------------
// Варіант C (ADR-0207). До нього верх екрана займала сітка місяця — 40%
// першого вікна на два факти, — а єдиний активний план пари лежав нижче
// дрібною карткою поруч із написом «Найближчі плани», хоч він там один.
//
// ЧОМУ СМУГА ПОСТУПУ, А НЕ ЩЕ ОДИН ВІДЛІК. «Ремонт хати» триває 549 днів.
// «−465 днів» не каже нічого, що видно оком; частка — каже. Але смуга є
// лише там, де вона чесна: `planProgress` мовчить про точний день і про
// період, який ще не почався (інакше нерухомий нуль місяцями читався б
// як зламаний елемент).
//
// КОЛІР ТУТ ОЗНАЧАЄ КАТЕГОРІЮ Й НІЧОГО БІЛЬШЕ (DESIGN.md, The Rare Colour
// Rule). Ґрунт картки лишається нейтральним: відтінок категорії входить
// у поверхню на 18% і тримає кант — це підказка, а не заливка. Попередня
// редакція модуля заливала бік плитки градієнтом на третину ширини, і
// саме це читалось як пляма.
// ============================================================

export function PlanFocusHero({ plan }: { plan: PlanRow }) {
  const cat = PLAN_CATEGORIES[plan.category];
  const countdown = planCountdown(plan);
  const progress = planProgress(plan);
  const date = planDateLabel(plan);

  return (
    <article
      className="pf-hero"
      style={{ '--plan-color': cat.color } as React.CSSProperties}
    >
      <Link
        className="pf-hero-open"
        to={`/plans/${plan.id}`}
        aria-label={`Відкрити «${plan.title}»`}
      />

      <span className="pf-hero-cat">
        <cat.Icon size={13} />
        {cat.label}
        {countdown !== null && <><span aria-hidden="true">·</span>{countdown.label}</>}
      </span>

      <h2 className="pf-hero-title">{plan.title}</h2>
      {date !== null && <p className="pf-hero-date">{date}</p>}

      {progress !== null && (
        <>
          {/*
            * Смуга — `progressbar` із числами, а не декорація: без
            * `aria-valuenow` вона для озвучення порожня, а саме вона
            * несе головний факт картки.
            */}
          <div
            className="pf-hero-bar"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-valuenow={progress.elapsed}
            aria-label={`Пройдено ${progress.elapsed} з ${progress.total} днів`}
          >
            <i style={{ inlineSize: `${(progress.ratio * 100).toFixed(1)}%` }} />
          </div>
          <p className="pf-hero-nums">
            <span>{dayCount(progress.elapsed)} позаду</span>
            <span>{progress.total - progress.elapsed} попереду</span>
          </p>
        </>
      )}
    </article>
  );
}

/**
 * «84 дні», «1 день», «5 днів» — українська форма, а не «84 день».
 *
 * Перша редакція демо надрукувала саме «84 день», і це помітили очима, а
 * не типізацією. Правило звичайне: 11–14 завжди «днів», далі за останньою
 * цифрою.
 */
function dayCount(days: number): string {
  const abs = Math.abs(days);
  const tens = abs % 100;
  const ones = abs % 10;
  if (tens >= 11 && tens <= 14) return `${days} днів`;
  if (ones === 1) return `${days} день`;
  if (ones >= 2 && ones <= 4) return `${days} дні`;
  return `${days} днів`;
}

export const __testing = { dayCount };

/**
 * Порожній фокус — окремий екранний стан, а не сховане місце.
 *
 * `PRODUCT.md` обіцяє живий модуль і парі, яка ще нічого не внесла. Тут
 * важливо не вибачатись, а показати наступний крок: єдине, чого бракує
 * плану, — дата, і задуми для неї вже є.
 */
export function PlanFocusEmpty({ ideas }: { ideas: number }) {
  return (
    <div className="pf-hero pf-hero--empty">
      <h2 className="pf-hero-title">Поки жодної дати</h2>
      <p className="pf-hero-date">
        {ideas > 0
          ? 'Задуми внизу чекають саме на неї — оберіть один.'
          : 'Додайте перший план, і він стане тут.'}
      </p>
    </div>
  );
}

/** Скільки днів задум уже чекає — для підпису в колоді. */
export function waitingSince(createdAt: string): string {
  return formatDateUA(createdAt.slice(0, 10));
}
