// ============================================================
// evolutionPressure — модулі НІКОЛИ не чіпають геометрію напряму, вони
// лише породжують іменовані «тиски»; рушій (artifactNodes.ts) і рендерер
// (crystal3d/crystalCluster.ts::deriveClusterMaterial) самі вирішують,
// як тиск проявляється візуально.
// ============================================================
import type { ArtifactInput, EvolutionPressures, GrowthDomainId, DominantSystem } from './artifactTypes';

const DOMAIN_IDS: GrowthDomainId[] = ['exploration', 'memory', 'connection', 'creation', 'future'];

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** Pielou-подібний індекс рівномірності (0 = один домен домінує повністю, 1 = ідеально рівно). */
function computeEvenness(shares: Record<string, number>): number {
  const total = Object.values(shares).reduce((a, b) => a + b, 0);
  if (total <= 0) return 0;
  const n = Object.keys(shares).length;
  let entropy = 0;
  for (const v of Object.values(shares)) {
    if (v > 0) {
      const p = v / total;
      entropy -= p * Math.log(p);
    }
  }
  return Math.log(n) > 0 ? entropy / Math.log(n) : 0;
}

export function computeEvolutionPressures(input: ArtifactInput): EvolutionPressures {
  const { usage, countries, cities, milestones, wishes, achievedGoals, anniversaries, recipes, movies, books } =
    input;
  const photosClamped = Math.min(usage.photos, 120);

  // Подорожі → Expansion (структурний ефект — розширює distance гілок Exploration, artifactNodes.ts).
  const expansion = Math.min(1, (countries.length * 3 + cities.length) / 28);

  // Фото → Refinement (полірування/прозорість — глобальна властивість матеріалу).
  const refinement = clamp01(photosClamped / 120);

  // Спогади → Luminosity (внутрішнє світіння).
  const luminosity = Math.min(0.85, input.memoriesCount * 0.035);

  // Рецепти → Warmth (теплий відтінок).
  const warmth = Math.min(0.6, recipes.length * 0.05);

  // Фільми/книги — лишаються як є, не підняті до named-pressure словника.
  const movieMix = Math.min(0.7, movies.length * 0.01);
  const surfaceComplexity = Math.min(1, books.length * 0.08);

  // Цілі/річниці/тривалість стосунків → Stability (steadier + thicker), відмінна від фінансової density.
  const stability = clamp01(
    (achievedGoals.length / 8) * 0.5 +
      (Math.min(anniversaries.length, 4) / 4) * 0.3 +
      (Math.min(usage.daysTogether, 1000) / 1000) * 0.2,
  );

  // Фінанси → щільність/маса (лог-шкала, як і в v1).
  const density = 1 + Math.min(0.3, Math.log10(1 + usage.totalSaved) * 0.045);

  // Доменний «shares» — саме він, а не сирі рахунки модулів, годує
  // dominant/dominance/harmony І кожен доменний білдер (domainShare).
  const shares: Record<GrowthDomainId, number> = {
    exploration: countries.length * 3 + cities.length,
    memory: input.memoriesCount,
    connection: milestones.length * 6 + achievedGoals.length + anniversaries.length,
    creation: recipes.length + movies.length + books.length,
    future: wishes.length,
  };
  const total = Object.values(shares).reduce((a, b) => a + b, 0) || 1;

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

  // Рівномірність використання модулів → Harmony (замінює goals→symmetry у v1;
  // симетрія тепер обслуговує лише 'core' — доменні вузли отримують порядок
  // із клинів, а не з цього блендування, див. artifactNodes.ts::computeLean).
  const harmony = computeEvenness(shares);

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
