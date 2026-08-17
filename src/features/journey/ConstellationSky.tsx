// ============================================================
// Небо «Нашого шляху» — промені, зірки й поводир до назви.
// ------------------------------------------------------------
// Живе окремо від сторінок, бо подач у цієї карти дві: компактна картка у
// вкладці «Події» і повний екран `/journey`. Дублювати цю розмітку не можна —
// саме так з'являються два описи однієї речі, які потім розходяться.
//
// **Полотно однакове в обох подачах.** Пропорція приходить із розкладки
// (`CONSTELLATION_WIDTH/HEIGHT`), а не з місця показу: якби повний екран мав
// власні пропорції, `buildConstellation` дав би інші координати, і пара
// побачила б два різні сузір'я замість одного більшого.
//
// Геометрія рахується в `constellationLayout.ts`; цей файл лише малює.
// ============================================================
import { memo, useMemo, useState, type CSSProperties } from 'react';
import type { EventRow, EventSignificance } from '@/types';
import {
  buildConstellation,
  type ConstellationStar,
} from '@/features/calendar/constellationLayout';
// Стиль класів `rj-*` живе в модулі календаря разом із карткою. Імпорт саме
// звідси — щоб опис зірки, променя й поводиря лишався один на обидві подачі.
import '@/features/calendar/relationshipJourney.css';

/** Пауза між появою сусідніх зірок, с. */
const BIRTH_STEP = 0.16;

export function journeyDateLabel(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Дата під назвою — без «р.» у кінці.
 *
 * Локаль додає його завжди, і чотирнадцять знаків замість одинадцяти рівно на
 * стільки й переносили рядок: «22 травня 2022 р.» ламалось надвоє під зіркою.
 */
export function shortDateLabel(date: string): string {
  return journeyDateLabel(date).replace(/\s*р\.$/, '');
}

function starTone(star: ConstellationStar): string {
  return star.core ? 'core' : star.level;
}

function starCaption(star: ConstellationStar, significance: EventSignificance): string {
  if (star.core) return significance === 'marriage' ? 'Одруження' : 'Початок відносин';
  if (significance === 'relationship_start') return 'Початок відносин';
  return star.level === 'important' ? 'Важлива подія' : 'Подія';
}

const StarButton = memo(function StarButton({
  star,
  event,
  width,
  height,
  named,
  onName,
  onOpen,
}: {
  star: ConstellationStar;
  event: EventRow;
  width: number;
  height: number;
  named: boolean;
  onName: (id: number) => void;
  onOpen: (event: EventRow) => void;
}) {
  const style = {
    left: `${(star.x / width) * 100}%`,
    top: `${(star.y / height) * 100}%`,
    '--star-size': `${((star.radius * 2) / width) * 100}%`,
    '--star-delay': `${(star.order * BIRTH_STEP).toFixed(2)}s`,
  } as CSSProperties;

  return (
    <button
      type="button"
      className={`rj-star rj-star--${starTone(star)}${named ? ' rj-star--named' : ''}`}
      style={style}
      aria-pressed={named}
      onClick={() => (named ? onOpen(event) : onName(star.id))}
      aria-label={`${starCaption(star, event.significance)}: ${event.title}, ${journeyDateLabel(event.date)}`}
    >
      <span className="rj-star-body" aria-hidden="true" />
    </button>
  );
});

export function ConstellationSky({
  events,
  onOpen,
}: {
  events: EventRow[];
  onOpen: (event: EventRow) => void;
}) {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const byId = useMemo(() => new Map(events.map((event) => [event.id, event])), [events]);
  const sky = useMemo(
    () => buildConstellation(
      events.map((event) => ({
        id: event.id,
        date: event.date,
        significance: event.significance,
        titleLength: event.title.length,
      })),
    ),
    [events],
  );

  const selected = useMemo(() => {
    if (selectedId === null) return null;
    const star = sky.stars.find((candidate) => candidate.id === selectedId);
    const event = star ? byId.get(star.id) : undefined;
    return star && event ? { star, event } : null;
  }, [byId, selectedId, sky.stars]);

  return (
    <div
      className="rj-sky"
      onClick={(clickEvent) => {
        if (clickEvent.target === clickEvent.currentTarget) setSelectedId(null);
      }}
      style={{ '--rj-ratio': `${sky.width} / ${sky.height}` } as CSSProperties}
    >
      <svg
        className="rj-beams"
        viewBox={`0 0 ${sky.width} ${sky.height}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {sky.edges.map((edge, index) => (
          <line
            key={`${edge.fromId}-${edge.toId}`}
            className="rj-beam"
            x1={edge.x1}
            y1={edge.y1}
            x2={edge.x2}
            y2={edge.y2}
            pathLength={1}
            style={{ '--beam-delay': `${((index + 1) * BIRTH_STEP).toFixed(2)}s` } as CSSProperties}
          />
        ))}
      </svg>

      {/*
        Назва не висить постійно — її показує дотик, по одній за раз. Сім
        підписів у кадрі телефона налазять одне на одного за будь-якого
        розведення (шість проходів, усі виміряні), а одна ламана-поводир
        завжди має куди лягти.
      */}
      <svg
        className="rj-leaders"
        viewBox={`0 0 ${sky.width} ${sky.height}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {selected && (
          <g className={`rj-leader rj-leader--${starTone(selected.star)}`}>
            <polyline
              className="rj-leader-line"
              points={[
                `${selected.star.leader.startX},${selected.star.leader.startY}`,
                `${selected.star.leader.bendX},${selected.star.leader.bendY}`,
                `${selected.star.leader.endX},${selected.star.leader.endY}`,
              ].join(' ')}
              pathLength={1}
            />
            <text
              className="rj-leader-title"
              x={selected.star.leader.endX}
              y={selected.star.leader.endY - 0.9}
              textAnchor={selected.star.leader.align}
            >
              {selected.event.title}
            </text>
            <text
              className="rj-leader-date"
              x={selected.star.leader.endX}
              y={selected.star.leader.endY + 2.9}
              textAnchor={selected.star.leader.align}
            >
              {shortDateLabel(selected.event.date)}
            </text>
          </g>
        )}
      </svg>

      <div className="rj-stars">
        {sky.stars.map((star) => (
          <StarButton
            key={star.id}
            star={star}
            event={byId.get(star.id)!}
            width={sky.width}
            height={sky.height}
            named={selectedId === star.id}
            onName={setSelectedId}
            onOpen={onOpen}
          />
        ))}
      </div>
    </div>
  );
}
