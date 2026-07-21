// ============================================================
// evolutionPressure — КРИСТАЛІЧНА (species) проєкція Evolution Engine.
// ------------------------------------------------------------
// Volume I: модулі НІКОЛИ не чіпають геометрію напряму — вони стають
// універсальними подіями (evolution/evolutionEvents.ts), а Pressure Solver
// перетворює історію на сили. Цей файл — species-шар кристала: проєктує
// Historical State у історично успадкований словник тисків, який споживають
// Growth Engine (mineralDeposition.ts) і рендер-матеріал
// (crystal3d/crystalCluster.ts::deriveClusterMaterial). Формули незмінні з
// попереднього покоління — та сама історія дає байт-в-байт ті самі тиски
// (закріплено характеризаційним тестом).
// Канонічні ж 10 сил (§11) — evolution/pressureSolver.ts::solveForces.
// ============================================================
import type { ArtifactInput, EvolutionPressures, GrowthDomainId, DominantSystem } from './artifactTypes';
import { buildEvolutionTimeline, historyAt, categoryShares, evenness } from './evolution';

const DOMAIN_IDS: GrowthDomainId[] = ['exploration', 'memory', 'connection', 'creation', 'future'];

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function computeEvolutionPressures(input: ArtifactInput): EvolutionPressures {
  const timeline = buildEvolutionTimeline(input);
  const c = historyAt(timeline, 0);
  const photosClamped = Math.min(c.photos, 120);

  // Подорожі → Expansion (структурний ефект — ймовірнісне поле росту назовні).
  const expansion = Math.min(1, (c.countries * 3 + c.cities) / 28);

  // Фото → Refinement (полірування/прозорість — глобальна властивість матеріалу).
  const refinement = clamp01(photosClamped / 120);

  // Спогади → Luminosity (внутрішнє світіння).
  const luminosity = Math.min(0.85, c.memories * 0.035);

  // Рецепти → Warmth (теплий відтінок).
  const warmth = Math.min(0.6, c.recipes * 0.05);

  // Фільми/книги — лишаються як є, не підняті до named-pressure словника.
  const movieMix = Math.min(0.7, c.movies * 0.01);
  const surfaceComplexity = Math.min(1, c.books * 0.08);

  // Цілі/річниці/тривалість стосунків → Stability (steadier + thicker), відмінна від фінансової density.
  const stability = clamp01(
    (c.goals / 8) * 0.5 + (Math.min(c.anniversaries, 4) / 4) * 0.3 + (Math.min(c.daysTogetherThen, 1000) / 1000) * 0.2,
  );

  // Фінанси → щільність/маса (лог-шкала, як і в v1).
  const density = 1 + Math.min(0.3, Math.log10(1 + c.totalSaved) * 0.045);

  // Доменний «shares» — categoryShares таймлайна: категорії Evolution Engine
  // мапляться 1:1 на Growth Domains кристала.
  const shares = categoryShares(c);
  const total = DOMAIN_IDS.reduce((acc, id) => acc + shares[id], 0) || 1;

  const domainShare = {} as Record<GrowthDomainId, number>;
  let dominant: DominantSystem = null;
  let dominance = 0;
  for (const id of DOMAIN_IDS) {
    const share = shares[id] / total;
    domainShare[id] = share;
    if (share > dominance) {
      dominance = share;
      dominant = id;
    }
  }

  // Рівномірність використання модулів → Harmony.
  const harmony = evenness(DOMAIN_IDS.map((id) => shares[id]));

  return {
    expansion,
    refinement,
    luminosity,
    warmth,
    stability,
    harmony,
    movieMix,
    surfaceComplexity,
    density,
    dominant,
    dominance,
    domainShare,
  };
}
