// ============================================================
// artifactDNA — генерується ОДИН раз із persisted couple-seed (settings.
// crystal_seed), ніколи з живих даних. Той самий mulberry32-детермінізм,
// що вже використовує геометрія: той самий seed завжди дає ту саму ДНК.
// ------------------------------------------------------------
// Реєстр seed-офсетів (щоб нові додавання не колізували з існуючими):
//   +5100 + i*173   — core-гілка i (artifactNodes.ts)
//   +7789 + id*97   — milestone (artifactNodes.ts)
//   +3311 + id*53   — wish (artifactNodes.ts)
//   +90210          — генерація ArtifactDNA (цей файл)
// ============================================================
import { mulberry32, hashSeedString } from '../mulberry32';
import type { ArtifactDNA, GrowthDomainId } from './artifactTypes';

const DOMAIN_IDS: GrowthDomainId[] = ['exploration', 'memory', 'connection', 'creation', 'future'];

export function generateArtifactDNA(seed: string): ArtifactDNA {
  const seedNum = hashSeedString(seed);
  const rng = mulberry32(seedNum + 90210);
  const attractorCount = 3 + Math.floor(rng() * 3);
  const attractorDirections = Array.from({ length: attractorCount }, () => rng() * Math.PI * 2);

  // Fisher-Yates тим самим rng-потоком, одразу після attractorDirections —
  // append-only порядок draw (mulberry32 послідовний генератор).
  const domainOrder = [...DOMAIN_IDS];
  for (let i = domainOrder.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = domainOrder[i]!;
    domainOrder[i] = domainOrder[j]!;
    domainOrder[j] = tmp;
  }

  return {
    seedNum,
    attractorDirections,
    mutationProbability: 0.04 + rng() * 0.1,
    asymmetryBias: rng(),
    compactnessBias: rng(),
    hueRotation: rng() * 360,
    hiddenPotential: rng(),
    domainOrder,
  };
}
