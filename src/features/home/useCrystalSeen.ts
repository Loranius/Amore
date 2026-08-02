// ============================================================
// useClusterGrowthFlash — який ріст процедурного кластера вже бачили
// ------------------------------------------------------------
// 3D грає один цілісний спалах, якщо з'явився новий ключ гілки.
// ============================================================
import { useEffect, useState } from 'react';

const CLUSTER_SEEN_KEY = 'amore:clusterSeenKeys';

function readClusterSeen(): Set<string> | null {
  try {
    const raw = localStorage.getItem(CLUSTER_SEEN_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
}

/**
 * «Щось виросло» для процедурного кластера: немає фіксованих категорій,
 * тому порівнюємо СПИСОК ключів гілок із тим, що бачили минулого разу —
 * зʼявився хоч один новий ключ (нова країна/місто/спогад/бажання) ⇒ спалах.
 */
export function useClusterGrowthFlash(branchKeys: readonly string[], isPending: boolean): { grew: boolean } {
  const [seenKeys] = useState(readClusterSeen);
  const isFirstVisit = seenKeys === null;
  const grew = !isPending && (isFirstVisit || branchKeys.some((k) => !seenKeys.has(k)));

  useEffect(() => {
    if (isPending) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(CLUSTER_SEEN_KEY, JSON.stringify(branchKeys));
      } catch {
        /* ignore */
      }
    }, 1600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending, branchKeys.join('|')]);

  return { grew };
}
