// ============================================================
// «Наш шлях» усередині календарної вкладки «Наші свята».
// ------------------------------------------------------------
// Карта читає лише особисті події пари (`type='anniversary'`). Звичайні
// моменти та великі віхи йдуть одним шляхом, але мають різну візуальну вагу.
// ============================================================
import { memo, useMemo, useState, type CSSProperties } from 'react';
import { EventIcon, SparkIcon } from '@/components/icons/EventIcon';
import { HeartIcon } from '@/components/icons/NavIcon';
import { PlusIcon } from '@/components/icons/UiIcon';
import { generateArtifactDNA } from '@/features/home/artifact/artifactDNA';
import { useCrystalSeed } from '@/features/home/useHome';
import type { EventRow } from '@/types';
import './relationshipJourney.css';
import './relationshipJourneyImportance.css';

const ROW_HEIGHT = 142;
const HISTORY_BATCH = 8;
const FUTURE_BATCH = 6;
const REGULAR_ACCENT = '#a77ac7';
const IMPORTANT_ACCENT = '#965fbd';
/** HSL hue базового `BASE_PALETTE.core[0]` (#6d4fa8) у crystalCluster.ts. */
const CRYSTAL_CORE_BASE_HUE = 260.2247191011;

interface JourneyPath {
  height: number;
  d: string;
}

function localDateKey(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

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

function nodeX(index: number): number {
  return index % 2 === 0 ? 72 : 28;
}

function makePath(xs: readonly number[]): JourneyPath {
  const rows = Math.max(xs.length, 1);
  const height = rows * ROW_HEIGHT + 92;
  const points = [{ x: 50, y: 0 }];
  xs.forEach((x, index) => points.push({ x, y: ROW_HEIGHT / 2 + index * ROW_HEIGHT }));
  points.push({ x: 50, y: height });

  let d = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]!;
    const current = points[index]!;
    const middleY = (previous.y + current.y) / 2;
    d += ` C ${previous.x} ${middleY}, ${current.x} ${middleY}, ${current.x} ${current.y}`;
  }
  return { height, d };
}

/**
 * Наскільки ДНК пари може відхилити стежку від фіолетового порталу.
 *
 * Було: повний оберт (`hueRotation` — це rng()×360), тобто стежка могла
 * вийти будь-якого кольору. Виміряно на живому екрані цієї пари — вона вийшла
 * салатовою посеред фіолетового світу. Відколи гама референсу стала базою
 * порталу, це не «своя барва», а чужа.
 *
 * Смуга лишає стежку впізнавано їхньою, але всередині палітри.
 */
const JOURNEY_HUE_SPREAD = 34;

function crystalJourneyStyle(seed: string | null): CSSProperties {
  const rotation = seed ? generateArtifactDNA(seed).hueRotation : 0;
  const shift = (rotation / 360) * (JOURNEY_HUE_SPREAD * 2) - JOURNEY_HUE_SPREAD;
  const hue = (CRYSTAL_CORE_BASE_HUE + shift + 360) % 360;
  return {
    '--relationship-journey-neon': `hsl(${hue.toFixed(1)} 88% 72%)`,
    '--relationship-journey-neon-core': `hsl(${hue.toFixed(1)} 96% 88%)`,
  } as CSSProperties;
}

const JourneyNode = memo(function JourneyNode({
  event,
  index,
  future,
  onOpen,
}: {
  event: EventRow;
  index: number;
  future: boolean;
  onOpen: (event: EventRow) => void;
}) {
  const major = Boolean(event.is_milestone);
  const accent = major ? IMPORTANT_ACCENT : REGULAR_ACCENT;
  const side = index % 2 === 0 ? 'left' : 'right';
  const style = { '--relationship-journey-accent': accent } as CSSProperties;

  return (
    <div
      className={`relationship-journey-node relationship-journey-node--${side} relationship-journey-node--${major ? 'major' : 'regular'}`}
      style={style}
    >
      <span className="relationship-journey-marker" aria-hidden="true">
        {major ? <SparkIcon size={19} /> : <EventIcon type="anniversary" size={16} />}
      </span>
      <article className="relationship-journey-card">
        <button
          type="button"
          className="relationship-journey-open"
          aria-label={`Відкрити подію «${event.title}»`}
          onClick={() => onOpen(event)}
        />
        <small>{major ? 'Велика подія' : 'Подія'}{future ? ' · попереду' : ''}</small>
        <strong>{event.title}</strong>
        <span>{dateLabel(event.date)}{event.yearly ? ' · щороку' : ''}</span>
        {event.description && <p>{event.description}</p>}
      </article>
    </div>
  );
});

function JourneyFog({ edge }: { edge: 'top' | 'bottom' }) {
  return (
    <div className={`relationship-journey-fog relationship-journey-fog--${edge}`} aria-hidden="true">
      <span />
      <span />
    </div>
  );
}

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
  const [historyLimit, setHistoryLimit] = useState(HISTORY_BATCH);
  const [futureLimit, setFutureLimit] = useState(FUTURE_BATCH);
  const { seed } = useCrystalSeed();
  const journeyStyle = useMemo(() => crystalJourneyStyle(seed), [seed]);
  const today = localDateKey();

  const moments = useMemo(
    () => events.filter(isJourneyEvent).slice().sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id),
    [events],
  );
  const past = useMemo(() => moments.filter((event) => event.date <= today), [moments, today]);
  const future = useMemo(() => moments.filter((event) => event.date > today), [moments, today]);
  const origin = past[0] ?? null;
  const history = origin ? past.slice(1) : past;
  const visibleHistory = history.slice(Math.max(0, history.length - historyLimit));
  const visibleFuture = future.slice(0, futureLimit);
  const hiddenHistory = history.length - visibleHistory.length;
  const hiddenFuture = future.length - visibleFuture.length;
  const historyOffset = history.length - visibleHistory.length;

  const route = useMemo(() => {
    const xs = visibleHistory.map((_event, index) => nodeX(historyOffset + index));
    xs.push(50);
    visibleFuture.forEach((_event, index) => xs.push(nodeX(history.length + 1 + index)));
    return makePath(xs);
  }, [history.length, historyOffset, visibleFuture, visibleHistory]);

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
          <JourneyFog edge="top" />

          {moments.length === 0 ? (
            <section className="relationship-journey-empty">
              <span aria-hidden="true"><HeartIcon size={25} /></span>
              <strong>Додайте першу подію</strong>
              <p>Початок стосунків, перша спільна поїздка, пропозиція або інший важливий момент з’явиться тут.</p>
              <button type="button" className="btn" onClick={onAdd}><PlusIcon size={14} /> Додати подію</button>
            </section>
          ) : (
            <>
              {origin && (
                <button
                  type="button"
                  className="relationship-journey-origin"
                  onClick={() => onOpen(origin)}
                  aria-label={`Відкрити початкову подію «${origin.title}»`}
                >
                  <span aria-hidden="true"><HeartIcon size={23} /></span>
                  <small>Початок шляху</small>
                  <strong>{origin.title}</strong>
                  <em>{dateLabel(origin.date)}</em>
                </button>
              )}

              {hiddenHistory > 0 && (
                <button
                  type="button"
                  className="relationship-journey-more"
                  onClick={() => setHistoryLimit((value) => value + HISTORY_BATCH)}
                >
                  Показати ще {Math.min(HISTORY_BATCH, hiddenHistory)} давніх подій
                </button>
              )}

              <div className="relationship-journey-route">
                <svg viewBox={`0 0 100 ${route.height}`} preserveAspectRatio="none" aria-hidden="true">
                  <path className="relationship-journey-path-base" d={route.d} />
                  <path className="relationship-journey-path-dash" d={route.d} />
                </svg>
                <div className="relationship-journey-nodes">
                  {visibleHistory.map((event, index) => (
                    <JourneyNode
                      key={event.id}
                      event={event}
                      index={historyOffset + index}
                      future={false}
                      onOpen={onOpen}
                    />
                  ))}

                  <div className="relationship-journey-now" aria-label="Сьогодні">
                    <span className="relationship-journey-marker" aria-hidden="true"><HeartIcon size={18} /></span>
                    <span><small>Сьогодні</small><strong>Ви тут</strong></span>
                  </div>

                  {visibleFuture.map((event, index) => (
                    <JourneyNode
                      key={event.id}
                      event={event}
                      index={history.length + 1 + index}
                      future
                      onOpen={onOpen}
                    />
                  ))}
                </div>
              </div>

              {hiddenFuture > 0 && (
                <button
                  type="button"
                  className="relationship-journey-more relationship-journey-more--future"
                  onClick={() => setFutureLimit((value) => value + FUTURE_BATCH)}
                >
                  Показати наступні {Math.min(FUTURE_BATCH, hiddenFuture)}
                </button>
              )}

              <JourneyFog edge="bottom" />
              <footer className="relationship-journey-future">
                <strong>Історія триває</strong>
                <p>Нові звичайні та великі події продовжуватимуть цей шлях.</p>
              </footer>
            </>
          )}
        </div>
      )}
    </details>
  );
}
