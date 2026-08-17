// ============================================================
// «Наш шлях» усередині календарної вкладки «Наші свята».
// ------------------------------------------------------------
// Карта читає лише особисті події пари (`type='anniversary'`) і малює їх
// сузір'ям: одна подія — одна зірка, промінь тягнеться до попередньої за
// датою. Ані «сьогодні», ані поділу на минуле й майбутнє тут немає — небо
// не має напрямку читання, у ньому є тільки історія пари.
//
// Саме небо (промені, зірки, поводир) малює `ConstellationSky` — спільний
// компонент для цієї картки й повноекранного маршруту `/journey`. Тут лишилась
// тільки оболонка картки: шапка, порожній стан і вхід у повний екран.
// ============================================================
import { useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { HeartIcon } from '@/components/icons/NavIcon';
import { ArrowUpIcon, PlusIcon } from '@/components/icons/UiIcon';
import { generateArtifactDNA } from '@/features/home/artifact/artifactDNA';
import { useCrystalSeed } from '@/features/home/useHome';
import { ConstellationSky } from '@/features/journey/ConstellationSky';
import type { EventRow } from '@/types';
import nebulaUrl from '@/assets/journey/nebula.webp';
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

function isJourneyEvent(event: EventRow): boolean {
  return event.type === 'anniversary';
}

function crystalJourneyStyle(seed: string | null): CSSProperties {
  const rotation = seed ? generateArtifactDNA(seed).hueRotation : 0;
  const shift = (rotation / 360) * (JOURNEY_HUE_SPREAD * 2) - JOURNEY_HUE_SPREAD;
  const hue = (CRYSTAL_CORE_BASE_HUE + shift + 360) % 360;
  return {
    '--relationship-journey-neon': `hsl(${hue.toFixed(1)} 88% 72%)`,
    '--relationship-journey-neon-core': `hsl(${hue.toFixed(1)} 96% 88%)`,
    '--rj-nebula': `url(${nebulaUrl})`,
  } as CSSProperties;
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
  const { seed } = useCrystalSeed();
  const journeyStyle = useMemo(() => crystalJourneyStyle(seed), [seed]);
  const moments = useMemo(() => events.filter(isJourneyEvent), [events]);

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
        {/*
          Розгортання — окрема кнопка, а не дотик по карті: на самому небі вже
          живе дотик по зірці, і сплутати їх було б надто легко.
        */}
        <Link
          to="/journey"
          className="relationship-journey-expand"
          aria-label="Відкрити карту на весь екран"
          onClick={(clickEvent) => clickEvent.stopPropagation()}
        >
          <ArrowUpIcon size={16} />
        </Link>
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
              <ConstellationSky events={moments} onOpen={onOpen} />

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
