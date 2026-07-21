// ============================================================
// Crystal — SVG-візуалізація «ДНК» пари: грані ростуть із даних
// усього застосунку, а не показують прогрес-бар.
// ------------------------------------------------------------
// Форма кожної грані детермінована (crystalGeometry.ts) — рандом
// впливає лише на те, ЩО з'являється, а не як виглядають наявні
// грані. useCrystalSeen запам'ятовує, скільки граней бачили
// востаннє, щоб «матеріалізація» програвалась лише для нових —
// старі рендеряться вже усталеними (ефект «історія жила, поки
// портал був закритий»). Це фолбек для CrystalScene (3D) — якщо
// WebGL недоступний або сцена впала.
// ============================================================
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { useCrystalDNA } from './useCrystal';
import { useCrystalSeen } from './useCrystalSeen';
import { buildFacets, CATEGORY_DEFS, type Facet } from './crystalGeometry';
import { CrystalStats } from './CrystalStats';
import { PlacesModal } from './PlacesModal';

export function Crystal() {
  const { dna, isPending } = useCrystalDNA();
  const facets = useMemo(() => buildFacets(dna), [dna]);
  const [open, setOpen] = useState(false);
  const { seenSnapshot, isFirstVisit } = useCrystalSeen(dna, isPending);
  const reduceMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const isNewFacet = (f: Facet): boolean => {
    if (f.slotIndex === -1) return isFirstVisit;
    const seenCount = seenSnapshot?.[f.category] ?? 0;
    return f.slotIndex >= seenCount;
  };

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

      <CrystalStats dna={dna} isPending={isPending} />

      {open && <PlacesModal onClose={() => setOpen(false)} />}
    </>
  );
}
