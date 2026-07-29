import { round6 } from './math';
import type {
  CrystalSpeciesBlueprint,
  LegacyCrystalDomain,
  LegacyCrystalPressureProjection,
} from './types';

const LEGACY_DOMAINS: readonly LegacyCrystalDomain[] = [
  'exploration',
  'memory',
  'connection',
  'creation',
  'future',
];

function normalizeDomainShares(
  raw: Record<LegacyCrystalDomain, number>,
): Record<LegacyCrystalDomain, number> {
  const total = LEGACY_DOMAINS.reduce((sum, domain) => sum + raw[domain], 0);
  if (total <= 0) {
    return {
      exploration: 0,
      memory: 0,
      connection: 0,
      creation: 0,
      future: 0,
    };
  }

  return {
    exploration: round6(raw.exploration / total),
    memory: round6(raw.memory / total),
    connection: round6(raw.connection / total),
    creation: round6(raw.creation / total),
    future: round6(raw.future / total),
  };
}

function dominantLegacyDomain(
  shares: Record<LegacyCrystalDomain, number>,
): { domain: LegacyCrystalDomain | null; share: number } {
  let domain: LegacyCrystalDomain | null = null;
  let share = 0;
  for (const candidate of LEGACY_DOMAINS) {
    if (shares[candidate] > share) {
      domain = candidate;
      share = shares[candidate];
    }
  }
  return { domain, share: round6(share) };
}

/**
 * Compatibility-only projection for the current crystal material and legacy
 * Growth Engine. This is intentionally one-way: legacy fields never leak back
 * into the new Crystal Species contract.
 */
export function projectCrystalToLegacyPressures(
  crystal: CrystalSpeciesBlueprint,
): LegacyCrystalPressureProjection {
  const shares = crystal.pressures.channelShare;
  const domainShare = normalizeDomainShares({
    exploration: shares.exploration,
    memory: shares.remembrance,
    connection: shares.stability + shares.significance,
    creation: shares.culture,
    future: shares.achievement,
  });
  const dominant = dominantLegacyDomain(domainShare);

  return {
    expansion: crystal.pressures.expansion,
    refinement: crystal.pressures.refinement,
    luminosity: crystal.pressures.luminosity,
    warmth: crystal.pressures.warmth,
    stability: crystal.pressures.stability,
    harmony: crystal.pressures.harmony,
    movieMix: round6(Math.min(0.7, crystal.pressures.warmth * 0.52 + shares.culture * 0.18)),
    brilliance: crystal.pressures.brilliance,
    surfaceComplexity: crystal.pressures.surfaceComplexity,
    density: crystal.pressures.density,
    dominant: dominant.domain,
    dominance: dominant.share,
    domainShare,
  };
}
