export type ReefRenderQuality = 'high' | 'balanced' | 'low';

export interface ReefRendererCapabilities {
  coarsePointer: boolean;
  deviceMemory?: number;
  devicePixelRatio: number;
  hardwareConcurrency?: number;
  viewportWidth: number;
}

export interface ReefRenderProfile {
  quality: ReefRenderQuality;
  maxDpr: number;
  antialias: boolean;
  directionalLights: 1 | 2 | 3;
  lightShaftCount: number;
  causticCount: number;
  particleCount: number;
  distantVegetationCount: number;
  distantFishSchoolCount: number;
  seaGrassCount: number;
  lightweightFishLimit: number;
  showWhale: boolean;
  showMicroLife: boolean;
  showSessileLife: boolean;
  showBiofilm: boolean;
  useNativeFish: boolean;
}

const PROFILES: Readonly<Record<ReefRenderQuality, ReefRenderProfile>> = {
  high: Object.freeze({
    quality: 'high',
    maxDpr: 1.5,
    antialias: true,
    directionalLights: 3,
    lightShaftCount: 5,
    causticCount: 4,
    particleCount: 120,
    distantVegetationCount: 48,
    distantFishSchoolCount: 4,
    seaGrassCount: 52,
    lightweightFishLimit: 12,
    showWhale: true,
    showMicroLife: true,
    showSessileLife: true,
    showBiofilm: true,
    useNativeFish: true,
  }),
  balanced: Object.freeze({
    quality: 'balanced',
    maxDpr: 1.2,
    antialias: false,
    directionalLights: 2,
    lightShaftCount: 3,
    causticCount: 2,
    particleCount: 72,
    distantVegetationCount: 28,
    distantFishSchoolCount: 2,
    seaGrassCount: 28,
    lightweightFishLimit: 10,
    showWhale: false,
    showMicroLife: false,
    showSessileLife: true,
    showBiofilm: false,
    useNativeFish: false,
  }),
  low: Object.freeze({
    quality: 'low',
    maxDpr: 1,
    antialias: false,
    directionalLights: 1,
    lightShaftCount: 2,
    causticCount: 1,
    particleCount: 40,
    distantVegetationCount: 16,
    distantFishSchoolCount: 1,
    seaGrassCount: 16,
    lightweightFishLimit: 6,
    showWhale: false,
    showMicroLife: false,
    showSessileLife: false,
    showBiofilm: false,
    useNativeFish: false,
  }),
};

function finitePositive(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value > 0;
}

/**
 * Keeps the relationship-driven hero reef intact while scaling only ambient
 * decoration and renderer cost. Touch-sized viewports never select the full
 * desktop budget: dense phone screens pay for fragments even on fast devices.
 */
export function resolveReefRenderProfile(
  capabilities: ReefRendererCapabilities,
): ReefRenderProfile {
  const memory = finitePositive(capabilities.deviceMemory)
    ? capabilities.deviceMemory
    : undefined;
  const cores = finitePositive(capabilities.hardwareConcurrency)
    ? capabilities.hardwareConcurrency
    : undefined;
  const weakDevice = (memory !== undefined && memory <= 3)
    || (cores !== undefined && cores <= 4);
  const mobileViewport = capabilities.coarsePointer
    || capabilities.viewportWidth < 768;

  if (weakDevice) return PROFILES.low;
  if (mobileViewport) return PROFILES.balanced;
  return PROFILES.high;
}
