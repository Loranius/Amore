// ============================================================
// «Наш шлях» усередині календарної вкладки «Наші свята».
// ------------------------------------------------------------
// Карта читає лише особисті події пари (`type='anniversary'`) і малює їх
// сузір'ям: одна подія — одна зірка, промінь тягнеться до попередньої за
// датою. Ані «сьогодні», ані поділу на минуле й майбутнє тут немає — небо
// не має напрямку читання, у ньому є тільки історія пари.
//
// Геометрія рахується в `constellationLayout.ts`; цей файл лише малює.
// ============================================================
import { memo, useMemo, useState, type CSSProperties } from 'react';
import { HeartIcon } from '@/components/icons/NavIcon';
import { PlusIcon } from '@/components/icons/UiIcon';
import { generateArtifactDNA } from '@/features/home/artifact/artifactDNA';
import { useCrystalSeed } from '@/features/home/useHome';
import type { EventRow, EventSignificance } from '@/types';
import {
  buildConstellation,
  type ConstellationStar,
} from './constellationLayout';
import './relationshipJourney.css';

/** HSL hue базового `BASE_PALETTE.core[0]` (#6d4fa8) у crystalCluster.ts. */
const CRYSTAL_CORE_BASE_HUE = 260.2247191011;

/**
 * Наскільки ДНК пари може відхилити сузір'я від фіолетового порталу.
 *
 * Було: повний оберт (`hueRotation` — це rng()×360), тобто небо могло вийти
 * будь-якого кольору. Виміряно на живому екрані цієї пари — воно вийшло
 * салатовим посеред фіолетового світу. Відколи гама референсу стала базою
 * порталу, це не «своя барва», а чужа.
 *
 * Смуга лишає небо впізнавано їхнім, але всередині палітри.
 */
const JOURNEY_HUE_SPREAD = 34;

/** Пауза між появою сусідніх зірок, с. */
const BIRTH_STEP = 0.16;

function isJourneyEvent(event: EventRow): boolean {
  return event.type === 'anniversary';
}

function dateLabel(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function crystalJourneyStyle(seed: string | null): CSSProperties {
  const rotation = seed ? generateArtifactDNA(seed).hueRotation : 0;
  const shift = (rotation / 360) * (JOURNEY_HUE_SPREAD * 2) - JOURNEY_HUE_SPREAD;
  const hue = (CRYSTAL_CORE_BASE_HUE + shift + 360) % 360;
  return {
    '--relationship-journey-neon': `hsl(${hue.toFixed(1)} 88% 72%)`,
    '--relationship-journey-neon-core': `hsl(${hue.toFixed(1)} 96% 88%)`,
  } as CSSProperties;
}

function starTone(star: ConstellationStar): string {
  return star.core ? 'core' : star.level;
}

function starCaption(star: ConstellationStar, significance: EventSignificance): string {
  if (star.core) return significance === 'marriage' ? 'Одруження' : 'Початок відносин';
  if (significance === 'relationship_start') return 'Початок відносин';
  return star.level === 'important' ? 'Важлива подія' : 'Подія';
}

const ConstellationStarButton = memo(function ConstellationStarButton({
  star,
  event,
  width,
  height,
  onOpen,
}: {
  star: ConstellationStar;
  event: EventRow;
  width: number;
  height: number;
  onOpen: (event: EventRow) => void;
}) {
  const style = {
    left: `${(star.x / width) * 100}%`,
    top: `${(star.y / height) * 100}%`,
    '--star-size': `${(star.radius * 2 / width) * 100}%`,
    '--star-delay': `${(star.order * BIRTH_STEP).toFixed(2)}s`,
  } as CSSProperties;

  return (
    <button
      type="button"
      className={`rj-star rj-star--${starTone(star)}`}
      style={style}
      onClick={() => onOpen(event)}
      aria-label={`${starCaption(star, event.significance)}: ${event.title}, ${dateLabel(event.date)}`}
    >
      <span className="rj-star-body" aria-hidden="true" />
    </button>
  );
});

export function RelationshipJourney({
  events,
  onOpen,
  onAdd,
}: {
  events: EventRow[];
  onOpen: (event: EventRow) => void;
  onAdd: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const { seed } = useCrystalSeed();
  const journeyStyle = useMemo(() => crystalJourneyStyle(seed), [seed]);

  const moments = useMemo(() => events.filter(isJourneyEvent), [events]);
  const byId = useMemo(() => new Map(moments.map((event) => [event.id, event])), [moments]);
  const sky = useMemo(
    () => buildConstellation(
      moments.map((event) => ({
        id: event.id,
        date: event.date,
        significance: event.significance,
      })),
    ),
    [moments],
  );

  return (
    <details
      className="relationship-journey"
      style={journeyStyle}
      open={expanded}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>
        <span className="relationship-journey-summary-icon" aria-hidden="true"><HeartIcon size={19} /></span>
        <span className="relationship-journey-summary-copy">
          <small>Карта подій стосунків</small>
          <strong>Наш шлях</strong>
        </span>
        <span className="relationship-journey-summary-count">{moments.length}</span>
      </summary>

      {expanded && (
        <div className="relationship-journey-shell">
          {moments.length === 0 ? (
            <section className="relationship-journey-empty">
              <span aria-hidden="true"><HeartIcon size={25} /></span>
              <strong>Додайте першу подію</strong>
              <p>Початок стосунків, перша спільна поїздка, пропозиція або інший важливий момент з’явиться тут.</p>
              <button type="button" className="btn" onClick={onAdd}><PlusIcon size={14} /> Додати подію</button>
            </section>
          ) : (
            <>
              <div
                className="rj-sky"
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
                  Підписи окремим шаром, а не всередині кнопки: їх треба
                  ставити в координатах неба, щоб затиснути в кадр. Усередині
                  кнопки відлік іде від диска зірки, і крайній підпис виїжджав.
                */}
                <div className="rj-labels" aria-hidden="true">
                  {sky.stars.map((star) => (
                    <span
                      key={star.id}
                      className={`rj-label rj-label--${starTone(star)}${star.labelAbove ? ' rj-label--above' : ''}`}
                      style={{
                        left: `${(star.labelX / sky.width) * 100}%`,
                        top: `${((star.labelAbove ? star.y - star.radius : star.y + star.radius) / sky.height) * 100}%`,
                        '--star-delay': `${(star.order * BIRTH_STEP).toFixed(2)}s`,
                      } as CSSProperties}
                    >
                      {byId.get(star.id)!.title}
                    </span>
                  ))}
                </div>

                <div className="rj-stars">
                  {sky.stars.map((star) => (
                    <ConstellationStarButton
                      key={star.id}
                      star={star}
                      event={byId.get(star.id)!}
                      width={sky.width}
                      height={sky.height}
                      onOpen={onOpen}
                    />
                  ))}
                </div>
              </div>

              <footer className="relationship-journey-future">
                <strong>Історія триває</strong>
                <p>Кожна нова подія засвітить свою зірку й дотягне промінь до попередньої.</p>
              </footer>
            </>
          )}
        </div>
      )}
    </details>
  );
}
