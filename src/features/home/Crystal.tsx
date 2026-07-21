// ============================================================
// Crystal — SVG-візуалізація «ДНК» пари: грані ростуть із даних
// усього застосунку, а не показують прогрес-бар.
// ------------------------------------------------------------
// Форма кожної грані детермінована (crystalGeometry.ts) — рандом
// впливає лише на те, ЩО з'являється, а не як виглядають наявні
// грані. localStorage запам'ятовує, скільки граней бачили востаннє,
// щоб «матеріалізація» програвалась лише для нових — старі
// рендеряться вже усталеними (ефект «історія жила, поки портал був
// закритий»).
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { useCrystalDNA } from './useCrystal';
import { buildFacets, CATEGORY_DEFS, type Facet } from './crystalGeometry';
import { PlacesModal } from './PlacesModal';

const SEEN_KEY = 'amore:crystalSeen';

function readSeen(): Record<string, number> | null {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : null;
  } catch {
    return null;
  }
}

interface StatItem {
  icon: string;
  label: string;
  value: number;
}

export function Crystal() {
  const { dna, isPending } = useCrystalDNA();
  const facets = useMemo(() => buildFacets(dna), [dna]);
  const [open, setOpen] = useState(false);
  const [seenSnapshot] = useState(readSeen);
  const isFirstVisit = seenSnapshot === null;
  const reduceMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Запам'ятовуємо поточну кількість граней ПІСЛЯ того, як анімація
  // матеріалізації встигла відіграти — щоб наступний візит вважав їх
  // уже «баченими».
  useEffect(() => {
    if (isPending) return;
    const t = setTimeout(() => {
      const next: Record<string, number> = {};
      for (const cat of CATEGORY_DEFS) next[cat.key] = cat.facetsFor(cat.metric(dna));
      try {
        localStorage.setItem(SEEN_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
    }, 1600);
    return () => clearTimeout(t);
  }, [dna, isPending]);

  const isNewFacet = (f: Facet): boolean => {
    if (f.slotIndex === -1) return isFirstVisit;
    const seenCount = seenSnapshot?.[f.category] ?? 0;
    return f.slotIndex >= seenCount;
  };

  const stats: StatItem[] = [
    { icon: '💞', label: 'разом, дн.', value: dna.daysTogether },
    { icon: '📍', label: 'місць', value: dna.places },
    { icon: '📷', label: 'фото', value: dna.photos },
    { icon: '🎬', label: 'переглянуто', value: dna.moviesWatched },
    { icon: '📚', label: 'прочитано', value: dna.booksRead },
    { icon: '💗', label: 'бажань', value: dna.wishesDone },
    { icon: '🎯', label: 'цілей', value: dna.goalsAchieved },
    { icon: '🎂', label: 'річниць', value: dna.anniversaries },
    { icon: '🍲', label: 'рецептів', value: dna.recipesSaved },
  ];

  return (
    <>
      <button
        type="button"
        className="crystal-wrap"
        onClick={() => setOpen(true)}
        aria-label="Кристал Amore — показати відвідані місця"
      >
        <svg viewBox="0 0 200 200" className="crystal-svg" aria-hidden="true">
          <defs>
            <radialGradient id="crystal-grad-core" cx="35%" cy="30%" r="75%">
              <stop offset="0%" stopColor="#fff7ea" />
              <stop offset="100%" stopColor="#f6c9da" />
            </radialGradient>
            {CATEGORY_DEFS.map((c) => (
              <radialGradient key={c.key} id={`crystal-grad-${c.key}`} cx="30%" cy="30%" r="80%">
                <stop offset="0%" stopColor={c.colorA} />
                <stop offset="100%" stopColor={c.colorB} />
              </radialGradient>
            ))}
          </defs>
          <g className={cn('crystal-spin', reduceMotion && 'crystal-anim-off')}>
            <g className={cn('crystal-breathe', reduceMotion && 'crystal-anim-off')}>
              {facets.map((f, i) => (
                <polygon
                  key={f.id}
                  points={f.points}
                  fill={`url(#${f.fillId})`}
                  className={cn(
                    'crystal-facet',
                    !reduceMotion && isNewFacet(f) && 'crystal-facet--enter',
                    reduceMotion && 'crystal-anim-off',
                  )}
                  style={{
                    ['--facet-i' as string]: i,
                    ['--glint-delay' as string]: `${(i % 9) * 0.6}s`,
                  }}
                />
              ))}
            </g>
          </g>
        </svg>
      </button>

      <div className="crystal-stats">
        {stats.map((s) => (
          <div key={s.label} className="crystal-stat-chip">
            <span className="crystal-stat-icon" aria-hidden="true">
              {s.icon}
            </span>
            <span className="crystal-stat-value">{isPending ? '…' : s.value.toLocaleString('uk-UA')}</span>
            <span className="crystal-stat-label">{s.label}</span>
          </div>
        ))}
      </div>

      {open && <PlacesModal onClose={() => setOpen(false)} />}
    </>
  );
}
