// ============================================================
// Лабораторія дерева — той самий вхід, що й у кристала.
// ------------------------------------------------------------
// Дерево дістало закон росту (ADR-0090), а подивитись на нього не було
// де: живий портал у пісочниці не піднімається (немає `.env.local`), і
// всі числа доводилось брати з побудованої структури, а не з екрана.
//
// Тут немає ані Supabase, ані входу. Артефакт синтетичний, вік задається
// рядком запиту, а сцена та сама — `TreeInWorld` експортовано з
// прев'ю-сцени порталу, тож лабораторія показує ТЕ САМЕ дерево, а не
// схоже на нього.
//
// Сторінка не входить у збірку продукту: лише dev-сервер.
// ============================================================
import { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { buildArtifactFromSnapshot } from '@/engine/evolution/adapters';
import { buildTreeLabPreviewFromArtifact } from '@/features/home/crystal3d/treeLab/buildTreeLabPreview';
import { TreeInWorld } from '@/features/home/crystal3d/evolution/TreeInWorld';
import { applyEvolutionSandboxSources } from '@/features/home/evolutionSandbox';
import '@/index.css';

const START = '1990-01-01';
const DAYS_PER_YEAR = 365.2425;

/**
 * Синтетична пара заданого віку.
 *
 * Дата початку СТАЛА, а рухається «сьогодні». Інакше кожен вік був би
 * іншою парою з іншим насінням — саме на цьому вже вийшов хибний вимір
 * пропорції кристала (ADR-0089 §1).
 */
function artifactFor(years: number) {
  const asOf = new Date(
    Date.parse(`${START}T00:00:00.000Z`) + years * DAYS_PER_YEAR * 86_400_000,
  ).toISOString();
  const sources = applyEvolutionSandboxSources({
    enabled: true,
    values: {
      relationshipDays: Math.round(years * DAYS_PER_YEAR),
      calendarEvents: Math.round(years * 6),
      completedPlans: Math.round(years * 4),
      fulfilledWishes: Math.round(years * 5),
      visitedPlaces: Math.round(years * 7),
      memories: Math.round(years * 12),
      finishedMedia: Math.round(years * 9),
      sharedDaysOff: Math.round(years * 30),
    },
    asOf,
    relationshipStartedAt: START,
    snapshot: {
      calendarEvents: [], plans: [], wishlistItems: [],
      mapPlaces: [], memories: [], memoryLinks: [], media: [],
    },
  });
  const artifact = buildArtifactFromSnapshot({
    coupleId: 'amore-couple:tree-lab',
    asOf,
    snapshot: sources.snapshot,
    engineConfig: {
      engineVersion: '1.0.0',
      relationshipStartedAt: START,
      timeZone: 'Europe/Kyiv',
      leapDayPolicy: 'feb-28',
    },
  }).blueprint;
  return { artifact, asOf };
}

function TreeLab() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const years = Math.max(1, Math.min(80, Number(params.get('years') ?? 4) || 4));
  const theme = params.get('theme') === 'light' ? 'light' : 'dark';
  const [error, setError] = useState<string | null>(null);

  const build = useMemo(() => {
    try {
      const { artifact, asOf } = artifactFor(years);
      return buildTreeLabPreviewFromArtifact({
        artifact,
        asOf,
        lod: 'high',
        rulesVersion: 'tree-lab-v1',
        asOfPolicy: 'fixed-fixture',
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      return null;
    }
  }, [years]);

  if (error !== null) return <pre style={{ color: '#f88', padding: 16 }}>{error}</pre>;
  if (build === null) return null;

  return (
    <MemoryRouter>
      <TreeInWorld build={build} theme={theme} />
    </MemoryRouter>
  );
}

const host = document.getElementById('root');
if (host) {
  document.documentElement.dataset['artifact'] = 'tree';
  createRoot(host).render(<TreeLab />);
}
