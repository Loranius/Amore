// ============================================================
// useCrystalSeen — скільки граней/росту бачили востаннє (localStorage)
// ------------------------------------------------------------
// Спільне для SVG- і 3D-рендерів кристала: SVG анімує «нові» грані
// поіндексно, 3D грає один цілісний спалах, якщо хоч щось зросло —
// обидва спираються на той самий знімок.
// ============================================================
import { useEffect, useState } from 'react';
import { CATEGORY_DEFS } from './crystalGeometry';
import type { CrystalDNA } from './useCrystal';

const SEEN_KEY = 'amore:crystalSeen';

function readSeen(): Record<string, number> | null {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : null;
  } catch {
    return null;
  }
}

/** Спеціальний ключ снепшоту — кількість великих життєвих подій (не категорія). */
export const MILESTONE_SEEN_KEY = '__milestoneCount';

export function useCrystalSeen(dna: CrystalDNA, isPending: boolean, milestoneCount = 0) {
  const [seenSnapshot] = useState(readSeen);
  const isFirstVisit = seenSnapshot === null;

  // Запам'ятовуємо поточний стан ПІСЛЯ того, як анімація росту встигла
  // відіграти — щоб наступний візит вважав його вже «баченим».
  useEffect(() => {
    if (isPending) return;
    const t = setTimeout(() => {
      const next: Record<string, number> = {};
      for (const cat of CATEGORY_DEFS) next[cat.key] = cat.facetsFor(cat.metric(dna));
      next[MILESTONE_SEEN_KEY] = milestoneCount;
      try {
        localStorage.setItem(SEEN_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
    }, 1600);
    return () => clearTimeout(t);
  }, [dna, isPending, milestoneCount]);

  return { seenSnapshot, isFirstVisit };
}
