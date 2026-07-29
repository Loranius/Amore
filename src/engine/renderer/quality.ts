import type { CrystalMaterialQuality } from '../material';

export interface CrystalRendererCapabilities {
  webgl: boolean;
  webgl2: boolean;
  deviceMemoryGb: number | null;
  hardwareConcurrency: number | null;
  devicePixelRatio: number;
}

/** Pure conservative quality selection. It never upgrades on unknown hardware. */
export function resolveCrystalRendererQuality(
  capabilities: CrystalRendererCapabilities,
): CrystalMaterialQuality {
  if (!capabilities.webgl) return 'fallback';

  const memory = capabilities.deviceMemoryGb;
  const cores = capabilities.hardwareConcurrency;
  const dpr = Number.isFinite(capabilities.devicePixelRatio)
    ? Math.max(1, capabilities.devicePixelRatio)
    : 2;

  if ((memory !== null && memory <= 4) || (cores !== null && cores <= 4) || dpr >= 3) {
    return 'low';
  }

  if (
    capabilities.webgl2
    && memory !== null
    && memory >= 8
    && cores !== null
    && cores >= 8
    && dpr <= 2
  ) {
    return 'high';
  }

  return 'balanced';
}
