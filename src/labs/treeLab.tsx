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
/**
 * Профілі заповнення модулів — ті самі, якими йде розгортка 0-40.
 *
 * Лабораторія довго вміла показувати лише одну пару, а розгортка тим часом
 * міряла п'ять; найгірші просідання траплялись САМЕ в інших профілях, і
 * подивитись на них не було як. Числа — подій на рік у кожному модулі.
 */
const FILL_PROFILES = {
  порожня: { cal: 0, plan: 0, wish: 0, place: 0, mem: 0, media: 0, off: 0 },
  тиха: { cal: 1, plan: 0, wish: 1, place: 0, mem: 2, media: 0, off: 4 },
  середня: { cal: 4, plan: 2, wish: 2, place: 3, mem: 8, media: 4, off: 15 },
  активна: { cal: 12, plan: 8, wish: 9, place: 14, mem: 24, media: 18, off: 45 },
  лабораторна: { cal: 6, plan: 4, wish: 5, place: 7, mem: 12, media: 9, off: 30 },
} as const;

type FillProfile = keyof typeof FILL_PROFILES;

function artifactFor(years: number, fill: FillProfile = 'лабораторна') {
  const asOf = new Date(
    Date.parse(`${START}T00:00:00.000Z`) + years * DAYS_PER_YEAR * 86_400_000,
  ).toISOString();
  const profile = FILL_PROFILES[fill];
  const sources = applyEvolutionSandboxSources({
    enabled: true,
    values: {
      relationshipDays: Math.round(years * DAYS_PER_YEAR),
      calendarEvents: Math.round(years * profile.cal),
      completedPlans: Math.round(years * profile.plan),
      fulfilledWishes: Math.round(years * profile.wish),
      visitedPlaces: Math.round(years * profile.place),
      memories: Math.round(years * profile.mem),
      finishedMedia: Math.round(years * profile.media),
      sharedDaysOff: Math.round(years * profile.off),
    },
    asOf,
    relationshipStartedAt: START,
    snapshot: {
      calendarEvents: [], plans: [], wishlistItems: [],
      mapPlaces: [], memories: [], memoryLinks: [], media: [],
    },
  });
  const artifact = buildArtifactFromSnapshot({
    coupleId: fill === 'лабораторна' ? 'amore-couple:tree-lab' : `amore:sweep:${fill}`,
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
  /*
   * Рівень деталізації задається запитом, бо телефон бачить `medium`, а не
   * `high` — і саме на `medium` живуть інші числа: стеля трикутників 18 000
   * замість 24 000, стеля листя 660 замість 720 і чотирирядкова пластинка
   * листка замість п'ятирядкової. Дивитись на `high` і робити висновок про
   * телефон — це те саме, що міряти одне дерево, а висновок писати про інше.
   */
  const lod = params.get('lod') === 'medium' ? 'medium'
    : params.get('lod') === 'low' ? 'low'
    : 'high';
  const fillParam = params.get('fill') ?? '';
  const fill: FillProfile = (Object.keys(FILL_PROFILES) as FillProfile[])
    .includes(fillParam as FillProfile) ? fillParam as FillProfile : 'лабораторна';
  const [error, setError] = useState<string | null>(null);

  const build = useMemo(() => {
    try {
      const { artifact, asOf } = artifactFor(years, fill);
      return buildTreeLabPreviewFromArtifact({
        artifact,
        asOf,
        lod,
        rulesVersion: 'tree-lab-v1',
        asOfPolicy: 'fixed-fixture',
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      return null;
    }
  }, [years, lod, fill]);

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
