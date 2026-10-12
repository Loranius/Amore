// ============================================================
// «Нитка часу» — галерея спогадів (ADR-0249).
// ------------------------------------------------------------
// Вертикальна лінія, найновіший спогад нагорі. Вузли чергуються
// обабіч, кадр притиснутий до нитки, підпис — по другий бік. Відстань між
// вузлами — це час між спогадами (`memoryThread.ts`), а довга перерва
// стає тихим підписом на нитці.
//
// Праворуч — повзунок років. Він читає ті самі зарубки, що й нитка, і
// підсвічує рік, який зараз під пальцем: шукати тут означає не вводити
// слова, а перекинутись у потрібний рік і погортати.
//
// Один рух на весь екран, і він має причину: новий спогад, складений
// поки екран відкритий, ПІДІЙМАЄТЬСЯ на своє місце нагорі нитки. Решта
// не рухається — архів, який при кожному відкритті влітає, читається як
// заставка, а не як власні спогади.
// ============================================================
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { Photo } from '@/components/ui/Photo';
import { pluralUA } from '@/lib/utils';
import { formatMemoryDate } from './memoriesDate';
import { placeLabel } from './momentPlace';
import {
  FRAME_WIDTH,
  buildThread,
  threadFan,
  threadYears,
  type ThreadItem,
} from './memoryThread';
import type { Moment } from './useMoments';

/** Ширина кадру на екрані в CSS-пікселях: 0.8 від колонки ~170px. */
const FRAME_CSS_WIDTH = 140;
/** Лист віяла видно смужкою під затемненням — повна якість тут марна. */
const LEAF_CSS_WIDTH = 96;
const LEAF_QUALITY = 55;

const yearAnchor = (year: number) => `mt-year-${year}`;

export function MemoryThread({
  moments,
  shown,
  onNeed,
}: {
  /** Увесь архів, найновіший перший. Роки повзунка рахуються з нього. */
  moments: readonly Moment[];
  /** Скільки спогадів уже намальовано (пачками, `memoriesPaging.ts`). */
  shown: number;
  /** Повзунок просить рік, до якого нитка ще не догорнута. */
  onNeed: (count: number) => void;
}) {
  const items = useMemo(
    () => buildThread(moments.slice(0, shown)
      .map((m) => ({ id: m.id, memory_date: m.memory_date, photoCount: m.photos.length }))),
    [moments, shown],
  );
  const years = useMemo(
    () => threadYears(moments.map((m) => ({ id: m.id, memory_date: m.memory_date, photoCount: m.photos.length }))),
    [moments],
  );
  const byId = useMemo(() => new Map(moments.map((m) => [m.id, m])), [moments]);
  const freshestId = moments[0]?.id;

  // ── Новий спогад підіймається ─────────────────────────────
  // Перший набір id — це архів, з яким екран відкрився; рухатись має лише
  // те, що з'явилось ПІСЛЯ.
  const known = useRef<Set<number> | null>(null);
  if (known.current === null) known.current = new Set(moments.map((m) => m.id));
  const fresh = moments.filter((m) => !known.current!.has(m.id)).map((m) => m.id);
  useEffect(() => {
    for (const id of fresh) known.current!.add(id);
  });

  // ── Повзунок років ────────────────────────────────────────
  const [activeYear, setActiveYear] = useState<number | null>(years[0]?.year ?? null);
  const listRef = useRef<HTMLOListElement>(null);
  const pendingYear = useRef<number | null>(null);

  // Рік під пальцем — той, чий вузол перетинає смугу на третині висоти.
  useEffect(() => {
    const list = listRef.current;
    if (!list || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const year = Number((entry.target as HTMLElement).dataset.year);
        if (Number.isFinite(year)) setActiveYear(year);
      }
    }, { rootMargin: '-30% 0px -65% 0px' });
    list.querySelectorAll('[data-year]').forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [items]);

  // Рік, до якого нитка ще не була догорнута, прокручується ПІСЛЯ того, як
  // його вузли намалювались.
  useEffect(() => {
    if (pendingYear.current === null) return;
    const target = document.getElementById(yearAnchor(pendingYear.current));
    if (!target) return;
    pendingYear.current = null;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [items]);

  const jumpTo = (year: number, firstIndex: number) => {
    setActiveYear(year);
    if (firstIndex >= shown) {
      pendingYear.current = year;
      onNeed(firstIndex + 1);
      return;
    }
    document.getElementById(yearAnchor(year))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="mt" data-rail={years.length > 1 ? 'true' : undefined}>
      <ol ref={listRef} className="mt-list">
        {renderItems(items, byId, freshestId, new Set(fresh))}
      </ol>

      {years.length > 1 && (
        <nav className="mt-rail" aria-label="Роки спогадів">
          {years.map(({ year, firstIndex, count }) => (
            <button
              key={year}
              type="button"
              className="mt-rail-year"
              aria-current={activeYear === year ? 'true' : undefined}
              aria-label={`${year} рік: ${count} ${pluralUA(count, ['спогад', 'спогади', 'спогадів'])}`}
              onClick={() => jumpTo(year, firstIndex)}
            >
              {year}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}

/**
 * Відступ не малюється окремим елементом: він стає верхнім полем
 * наступного пункту. Інакше список для читача екрана складався б
 * наполовину з порожніх рядків.
 */
function renderItems(
  items: readonly ThreadItem[],
  byId: ReadonlyMap<number, Moment>,
  freshestId: number | undefined,
  fresh: ReadonlySet<number>,
) {
  const out: ReactElement[] = [];
  let gap = 0;
  for (const item of items) {
    if (item.kind === 'gap') {
      gap = item.px;
      continue;
    }
    const style = gap ? ({ '--mt-gap': `${gap}px` } as CSSProperties) : undefined;
    gap = 0;
    if (item.kind === 'year') {
      out.push(
        <li key={`y${item.year}`} id={yearAnchor(item.year)} className="mt-year" style={style}>
          <h2>{item.year}</h2>
        </li>,
      );
    } else if (item.kind === 'pause') {
      out.push(
        <li key={`p${out.length}`} className="mt-pause" style={style}>
          <span>{item.label}</span>
        </li>,
      );
    } else {
      const moment = byId.get(item.id);
      if (!moment) continue;
      out.push(
        <ThreadNode
          key={item.id}
          moment={moment}
          side={item.side}
          size={item.size}
          year={item.year}
          isFreshest={item.id === freshestId}
          isNew={fresh.has(item.id)}
          style={style}
        />,
      );
    }
  }
  return out;
}

function ThreadNode({
  moment,
  side,
  size,
  year,
  isFreshest,
  isNew,
  style,
}: {
  moment: Moment;
  side: 'left' | 'right';
  size: 's' | 'm' | 'l';
  year: number;
  isFreshest: boolean;
  isNew: boolean;
  style: CSSProperties | undefined;
}) {
  const title = moment.title.trim();
  const date = formatMemoryDate(moment.memory_date, 'day');
  const place = moment.place ? placeLabel(moment.place) : '';
  const note = moment.note?.trim() ?? '';
  // Обкладинка йде першою (`orderPhotos`), у віяло лягає решта.
  const rest = moment.photos.slice(1);
  const leaves = threadFan(rest.length, side);

  return (
    <li
      className={`mt-node mt-node--${side}${isNew ? ' is-new' : ''}${isFreshest ? ' is-freshest' : ''}`}
      data-year={year}
      style={{ ...style, '--mt-frame': FRAME_WIDTH[size] } as CSSProperties}
    >
      <Link to={`/memories/${moment.id}`} className="mt-link">
        <span className="mt-stack">
          {leaves.map((leaf, i) => {
            const photo = rest[i];
            if (!photo) return null;
            return (
              <span
                key={photo.id}
                className="mt-leaf"
                style={{ transform: `rotate(${leaf.rotate}deg) scale(${leaf.scale})` }}
                aria-hidden="true"
              >
                <Photo
                  src={photo.photo_url}
                  cssWidth={LEAF_CSS_WIDTH}
                  quality={LEAF_QUALITY}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                />
              </span>
            );
          })}
          <span className={`mt-frame mt-frame--${size}`}>
            {moment.cover ? (
              <Photo
                src={moment.cover.photo_url}
                cssWidth={FRAME_CSS_WIDTH}
                alt=""
                loading="lazy"
                decoding="async"
                draggable={false}
              />
            ) : (
              // Спогад без фото створити не можна, але видалення останнього
              // знімка лишає саме такий стан — порожня рамка чесніша за
              // зламану іконку.
              <span className="mt-blank" aria-hidden="true" />
            )}
            {moment.photos.length > 1 && (
              <span className="mt-count" aria-hidden="true">{moment.photos.length}</span>
            )}
          </span>
        </span>

        <span className="mt-dot" aria-hidden="true" />

        {/* Без назви дата підіймається на місце заголовка: два однакові
            рядки поспіль читались би як помилка, а не як «назви немає». */}
        <span className="mt-caption">
          <b>{title || date}</b>
          <i>{[title ? date : '', place].filter(Boolean).join(' · ')}</i>
          {note && <q>{note}</q>}
        </span>
      </Link>
    </li>
  );
}
