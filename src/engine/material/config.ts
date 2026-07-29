import type { CrystalMaterialConfig, CrystalMaterialQuality } from './types';

export interface CrystalMaterialQualityPreset {
  roughnessFloor: number;
  clearcoatScale: number;
  maxIridescence: number;
  reflectionScale: number;
  inclusionScale: number;
}

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
    reflectionScale: 0.82,
    inclusionScale: 0.72,
  },
  low: {
    roughnessFloor: 0.09,
    clearcoatScale: 0.72,
    maxIridescence: 0,
    reflectionScale: 0.52,
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
  rulesVersion: '1.0.0',
  quality: 'balanced',
  allowIridescence: true,
  allowProceduralReflection: true,
};
