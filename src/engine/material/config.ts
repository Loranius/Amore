import type { CrystalMaterialConfig, CrystalMaterialQuality } from './types';

export interface CrystalMaterialQualityPreset {
  roughnessFloor: number;
  clearcoatScale: number;
  maxIridescence: number;
  reflectionScale: number;
  inclusionScale: number;
}

/**
 * What each tier is allowed to spend.
 *
 * `reflectionScale` is the odd one out and was raised on the lower tiers
 * (2026-08-03) rather than left with its siblings. Every other scale here gates
 * something that genuinely costs: `inclusionScale` gates procedural noise, which
 * is per-pixel work, and `clearcoatScale` gates a second specular lobe. The rim
 * and sky terms are a handful of ALU operations on a normal that has already
 * been fetched — and since an environment map is off by decision rather than by
 * omission (`render/envMap.ts`), they are the *only* reflection the crystal has.
 * Scaling them down on a weaker device saved almost nothing and cost the shell
 * the one cue that separates glass from tinted plastic.
 */
export const CRYSTAL_MATERIAL_QUALITY_PRESETS: Record<CrystalMaterialQuality, CrystalMaterialQualityPreset> = {
  high: {
    roughnessFloor: 0.035,
    clearcoatScale: 1,
    maxIridescence: 0.58,
    reflectionScale: 1,
    inclusionScale: 1,
  },
  balanced: {
    roughnessFloor: 0.055,
    clearcoatScale: 0.92,
    maxIridescence: 0.36,
    reflectionScale: 0.94,
    inclusionScale: 0.72,
  },
  low: {
    roughnessFloor: 0.09,
    clearcoatScale: 0.72,
    maxIridescence: 0,
    reflectionScale: 0.8,
    inclusionScale: 0.35,
  },
  fallback: {
    roughnessFloor: 0.18,
    clearcoatScale: 0.42,
    maxIridescence: 0,
    reflectionScale: 0,
    inclusionScale: 0,
  },
};

export const DEFAULT_CRYSTAL_MATERIAL_CONFIG: CrystalMaterialConfig = {
  // 1.1.0: the shell became semi-transparent, the stone gained procedural
  // striations and veils, and the inner light now grows with the wishes that
  // were granted rather than merely taking their colour (ADR-0007).
  // 1.7.0: rank is carried by value. The role ladder mixed hue toward
  // `secondary`, which equals `primary` whenever a couple's events carry no
  // warm channel, and the `micro` value step was applied inside the albedo cap
  // that then divided it back out. Both were inert; the step now follows the
  // cap and every body's shell changes with its role.
  rulesVersion: '1.7.0',
  quality: 'balanced',
  allowIridescence: true,
  allowProceduralReflection: true,
};
