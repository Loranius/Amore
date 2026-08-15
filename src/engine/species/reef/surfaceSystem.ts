import { stableHash32 } from '../../evolution';
import { clamp01, round6, seededUnit } from './math';
import type { ReefCompositionManifest, ReefComposedYearStructure } from './composition';
import type { ReefCoreManifest } from './reefCore';

export const REEF_SURFACE_VERSION = 'reef-surface-v1' as const;
export const REEF_SURFACE_CORE_SAMPLES = 48;
export const REEF_SURFACE_PLATFORM_SAMPLES = 24;
export const REEF_SURFACE_YEAR_SAMPLES = 12;
export const REEF_SURFACE_MIN_SUITABILITY = 0.58;
export const REEF_SURFACE_MIN_NORMAL_Y = -0.35;
export const REEF_SURFACE_MAX_PATCHES = REEF_SURFACE_CORE_SAMPLES
  + REEF_SURFACE_PLATFORM_SAMPLES
  + REEF_SURFACE_YEAR_SAMPLES * 50;

const TAU = Math.PI * 2;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export type ReefSurfaceSourceKind = 'CORE' | 'PLATFORM' | 'YEAR_STRUCTURE';
export type ReefSurfaceClass =
  | 'CORE_CROWN'
  | 'CORE_SHOULDER'
  | 'CORE_SIDE'
  | 'PLATFORM_LEDGE'
  | 'BOULDER_CROWN'
  | 'BOULDER_SIDE'
  | 'COLUMN_CROWN'
  | 'COLUMN_SIDE'
  | 'RIDGE_CREST'
  | 'RIDGE_SIDE'
  | 'ARCH_CREST'
  | 'ARCH_SIDE'
  | 'ARCH_UNDERSIDE';

export interface ReefSurfacePoint { x: number; y: number; z: number }

export interface ReefSurfacePatch {
  id: string;
  seed: number;
  sourceKind: ReefSurfaceSourceKind;
  sourceId: string;
  sourceSignature: string;
  surfaceClass: ReefSurfaceClass;
  sampleIndex: number;
  position: ReefSurfacePoint;
  normal: ReefSurfacePoint;
  slopeDegrees: number;
  height01: number;
  exposure: number;
  stability: number;
  suitability: number;
  capacity: number;
  eligible: boolean;
  signature: string;
}

export interface ReefSurfaceDiagnostics {
  patchCount: number;
  eligiblePatchCount: number;
  rejectedUndersideCount: number;
  corePatchCount: number;
  platformPatchCount: number;
  yearPatchCount: number;
  averageSuitability: number;
  averageEligibleSuitability: number;
  totalCapacity: number;
  boundedForMobile: boolean;
}

export interface ReefSurfaceManifest {
  version: typeof REEF_SURFACE_VERSION;
  reefSeed: number;
  sourceCompositionSignature: string;
  patches: ReefSurfacePatch[];
  diagnostics: ReefSurfaceDiagnostics;
  signature: string;
}

export interface BuildReefSurfaceSystemInput {
  core: ReefCoreManifest;
  composition: ReefCompositionManifest;
}

interface SurfaceCandidate {
  id: string;
  seed: number;
  sourceKind: ReefSurfaceSourceKind;
  sourceId: string;
  sourceSignature: string;
  surfaceClass: ReefSurfaceClass;
  sampleIndex: number;
  position: ReefSurfacePoint;
  normal: ReefSurfacePoint;
  height01: number;
  exposure: number;
  stability: number;
  growth: number;
}

const hex32 = (value: number) => (value >>> 0).toString(16).padStart(8, '0');
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function normalize(point: ReefSurfacePoint): ReefSurfacePoint {
  const length = Math.hypot(point.x, point.y, point.z) || 1;
  return {
    x: round6(point.x / length),
    y: round6(point.y / length),
    z: round6(point.z / length),
  };
}

function rotateY(point: ReefSurfacePoint, radians: number): ReefSurfacePoint {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return {
    x: round6(point.x * cosine + point.z * sine),
    y: round6(point.y),
    z: round6(-point.x * sine + point.z * cosine),
  };
}

function classifyCore(y01: number): ReefSurfaceClass {
  if (y01 >= 0.76) return 'CORE_CROWN';
  if (y01 >= 0.42) return 'CORE_SHOULDER';
  return 'CORE_SIDE';
}

function coreCandidate(core: ReefCoreManifest, sampleIndex: number): SurfaceCandidate {
  const seed = stableHash32(`${core.identity.reefSeed}:surface:core:${sampleIndex}`);
  const y01 = 0.12 + ((sampleIndex + 0.5) / REEF_SURFACE_CORE_SAMPLES) * 0.82;
  const ny = y01 * 2 - 1;
  const horizontal = Math.sqrt(Math.max(0, 1 - ny * ny));
  const azimuth = sampleIndex * GOLDEN_ANGLE
    + lerp(-0.14, 0.14, seededUnit(seed, 'azimuth-jitter'));
  const nx = Math.cos(azimuth) * horizontal;
  const nz = Math.sin(azimuth) * horizontal;
  const { phaseA, phaseB, ruggedness, asymmetry, shoulderBias, leanX, leanZ } = core.morphology;
  const macroNoise = Math.sin(azimuth * 3 + phaseA + ny * 1.45) * 0.5
    + Math.cos(azimuth * 5 - phaseB + ny * 2.2) * 0.3
    + Math.sin(azimuth * 2 + phaseB * 0.7 - ny * 3.1) * 0.2;
  const verticalNoise = Math.sin(y01 * Math.PI * 3.2 + phaseB) * 0.55
    + Math.cos(azimuth * 4 + phaseA) * 0.45;
  const radialNoise = 1 + ruggedness * macroNoise * (0.78 + 0.22 * Math.sin(Math.PI * y01));
  const shoulder = 1 + (shoulderBias - 1) * Math.sin(Math.PI * y01) * 0.42;
  const sideBias = 1 + asymmetry * Math.cos(azimuth - phaseA);
  const crownCompression = 1 - Math.max(0, y01 - 0.78) * 0.16;

  let x = nx * core.dimensions.radiusX * radialNoise * shoulder * sideBias;
  let z = nz * core.dimensions.radiusZ * radialNoise * shoulder / sideBias;
  let y = y01 * core.dimensions.height;
  y *= 1 + ruggedness * 0.055 * verticalNoise;
  x += leanX * core.dimensions.height * y01;
  z += leanZ * core.dimensions.height * y01;
  x *= crownCompression;
  z *= crownCompression;
  y -= core.platform.thickness * 0.12;

  const normal = normalize({
    x: nx / Math.max(0.01, core.dimensions.radiusX),
    y: ny / Math.max(0.01, core.dimensions.height * 0.5),
    z: nz / Math.max(0.01, core.dimensions.radiusZ),
  });
  const exposure = clamp01(0.42 + y01 * 0.4 + Math.max(0, normal.y) * 0.18);
  const stability = clamp01(0.94 - ruggedness * 0.85 + (1 - y01) * 0.05);

  return {
    id: `reef:surface:core:${sampleIndex}`,
    seed,
    sourceKind: 'CORE',
    sourceId: 'reef:core',
    sourceSignature: core.signature,
    surfaceClass: classifyCore(y01),
    sampleIndex,
    position: { x: round6(x), y: round6(y), z: round6(z) },
    normal,
    height01: round6(y01),
    exposure: round6(exposure),
    stability: round6(stability),
    growth: core.age.growth,
  };
}

function platformCandidate(core: ReefCoreManifest, sampleIndex: number): SurfaceCandidate {
  const seed = stableHash32(`${core.identity.reefSeed}:surface:platform:${sampleIndex}`);
  const angle = sampleIndex * GOLDEN_ANGLE
    + lerp(-0.09, 0.09, seededUnit(seed, 'angle-jitter'));
  const radial01 = 0.62 + 0.32 * seededUnit(seed, 'radial-band');
  const phaseA = (core.platform.seed % 10_000) / 10_000 * TAU;
  const phaseB = ((core.platform.seed >>> 8) % 10_000) / 10_000 * TAU;
  const edgeNoise = 1 + core.platform.irregularity * (
    Math.sin(angle * 3 + phaseA) * 0.55
    + Math.cos(angle * 5 - phaseB) * 0.3
    + Math.sin(angle * 7 + phaseB) * 0.15
  );
  const roughness = core.platform.irregularity * 0.09 * (
    Math.cos(angle * 4 + phaseA) + Math.sin(angle * 6 - phaseB)
  );
  const local = {
    x: Math.cos(angle) * core.platform.radiusX * radial01 * edgeNoise,
    y: core.platform.thickness * 0.5 + roughness,
    z: Math.sin(angle) * core.platform.radiusZ * radial01 * edgeNoise,
  };
  const rotated = rotateY(local, core.platform.rotationRadians);
  const radialNormal = normalize({
    x: Math.cos(angle) * core.platform.irregularity * 0.22,
    y: 1,
    z: Math.sin(angle) * core.platform.irregularity * 0.22,
  });
  const normal = rotateY(radialNormal, core.platform.rotationRadians);

  return {
    id: `reef:surface:platform:${sampleIndex}`,
    seed,
    sourceKind: 'PLATFORM',
    sourceId: 'reef:platform',
    sourceSignature: hex32(stableHash32(`${core.identity.platformSeed}\u001f${core.platform.radiusX}\u001f${core.platform.radiusZ}`)),
    surfaceClass: 'PLATFORM_LEDGE',
    sampleIndex,
    position: rotated,
    normal,
    height01: round6(0.08 + radial01 * 0.12),
    exposure: round6(clamp01(0.58 + radial01 * 0.22)),
    stability: round6(clamp01(0.96 - core.platform.irregularity * 0.5)),
    growth: core.age.growth,
  };
}

function structureClass(
  structure: ReefComposedYearStructure,
  crown: boolean,
  underside = false,
): ReefSurfaceClass {
  if (structure.archetype === 'BOULDER') return crown ? 'BOULDER_CROWN' : 'BOULDER_SIDE';
  if (structure.archetype === 'COLUMN') return crown ? 'COLUMN_CROWN' : 'COLUMN_SIDE';
  if (structure.archetype === 'RIDGE') return crown ? 'RIDGE_CREST' : 'RIDGE_SIDE';
  if (underside) return 'ARCH_UNDERSIDE';
  return crown ? 'ARCH_CREST' : 'ARCH_SIDE';
}

function boulderCandidate(
  core: ReefCoreManifest,
  structure: ReefComposedYearStructure,
  sampleIndex: number,
  seed: number,
): SurfaceCandidate {
  const azimuth = sampleIndex * GOLDEN_ANGLE + seededUnit(seed, 'azimuth') * 0.18;
  const yNormal = -0.05 + 1.02 * ((sampleIndex + 0.5) / REEF_SURFACE_YEAR_SAMPLES);
  const horizontal = Math.sqrt(Math.max(0, 1 - yNormal * yNormal));
  const nx = Math.cos(azimuth) * horizontal;
  const nz = Math.sin(azimuth) * horizontal;
  const growth = structure.growth;
  const local = {
    x: nx * structure.shape.width * 0.5 * growth,
    y: structure.shape.height * 0.42 * growth + yNormal * structure.shape.height * 0.5 * growth,
    z: nz * structure.shape.depth * 0.5 * growth,
  };
  const normalLocal = normalize({
    x: nx / Math.max(0.01, structure.shape.width),
    y: yNormal / Math.max(0.01, structure.shape.height),
    z: nz / Math.max(0.01, structure.shape.depth),
  });
  const world = rotateY(local, structure.rotationY);
  const normal = rotateY(normalLocal, structure.rotationY);
  return structureCandidateBase(core, structure, sampleIndex, seed, world, normal,
    clamp01((yNormal + 0.2) / 1.2), yNormal > 0.52, false);
}

function columnCandidate(
  core: ReefCoreManifest,
  structure: ReefComposedYearStructure,
  sampleIndex: number,
  seed: number,
): SurfaceCandidate {
  const crown = sampleIndex % 4 === 0;
  const angle = sampleIndex * GOLDEN_ANGLE + seededUnit(seed, 'angle') * 0.15;
  const growth = structure.growth;
  const height01 = crown ? 0.96 : 0.48 + seededUnit(seed, 'height') * 0.42;
  const radiusX = structure.shape.width * 0.36 * growth;
  const radiusZ = structure.shape.depth * 0.36 * growth;
  const local = {
    x: Math.cos(angle) * radiusX,
    y: structure.shape.height * height01 * growth,
    z: Math.sin(angle) * radiusZ,
  };
  const normalLocal = crown
    ? normalize({ x: Math.cos(angle) * 0.25, y: 1, z: Math.sin(angle) * 0.25 })
    : normalize({ x: Math.cos(angle), y: 0.16 + (height01 - 0.5) * 0.18, z: Math.sin(angle) });
  return structureCandidateBase(
    core,
    structure,
    sampleIndex,
    seed,
    rotateY(local, structure.rotationY),
    rotateY(normalLocal, structure.rotationY),
    height01,
    crown,
    false,
  );
}

function ridgeCandidate(
  core: ReefCoreManifest,
  structure: ReefComposedYearStructure,
  sampleIndex: number,
  seed: number,
): SurfaceCandidate {
  const crown = sampleIndex % 3 !== 2;
  const side = sampleIndex % 2 === 0 ? -1 : 1;
  const t = (sampleIndex + 0.5) / REEF_SURFACE_YEAR_SAMPLES;
  const growth = structure.growth;
  const x = (t - 0.5) * structure.shape.width * growth;
  const crest = 1 - Math.abs(t - 0.5) * 1.35;
  const height01 = clamp01(0.56 + crest * 0.38 + seededUnit(seed, 'height') * 0.04);
  const local = {
    x,
    y: structure.shape.height * height01 * growth,
    z: side * structure.shape.depth * (crown ? 0.08 : 0.42) * growth,
  };
  const normalLocal = crown
    ? normalize({ x: (0.5 - t) * 0.34, y: 1, z: side * 0.16 })
    : normalize({ x: (0.5 - t) * 0.18, y: 0.28, z: side });
  return structureCandidateBase(
    core,
    structure,
    sampleIndex,
    seed,
    rotateY(local, structure.rotationY),
    rotateY(normalLocal, structure.rotationY),
    height01,
    crown,
    false,
  );
}

function archCandidate(
  core: ReefCoreManifest,
  structure: ReefComposedYearStructure,
  sampleIndex: number,
  seed: number,
): SurfaceCandidate {
  const t = 0.08 + 0.84 * ((sampleIndex + 0.5) / REEF_SURFACE_YEAR_SAMPLES);
  const growth = structure.growth;
  const crossSection = sampleIndex % 4;
  const normalY = crossSection === 0 ? 0.92 : crossSection === 1 ? 0.38 : crossSection === 2 ? -0.42 : 0.12;
  const normalZ = crossSection === 1 ? 0.92 : crossSection === 3 ? -0.98 : 0.22;
  const underside = normalY < -0.2;
  const crown = normalY > 0.7;
  const archY = Math.sin(Math.PI * t) * structure.shape.height * growth;
  const tubeRadius = Math.max(0.12, structure.shape.depth * 0.33) * growth;
  const local = {
    x: (t - 0.5) * structure.shape.width * growth,
    y: archY + normalY * tubeRadius,
    z: Math.sin(Math.PI * t) * structure.shape.curveDepth * structure.shape.depth * growth
      + normalZ * tubeRadius,
  };
  const normalLocal = normalize({
    x: (0.5 - t) * 0.18,
    y: normalY,
    z: normalZ,
  });
  return structureCandidateBase(
    core,
    structure,
    sampleIndex,
    seed,
    rotateY(local, structure.rotationY),
    rotateY(normalLocal, structure.rotationY),
    clamp01(archY / Math.max(0.01, structure.shape.height * growth)),
    crown,
    underside,
  );
}

function structureCandidateBase(
  core: ReefCoreManifest,
  structure: ReefComposedYearStructure,
  sampleIndex: number,
  seed: number,
  rotatedLocal: ReefSurfacePoint,
  normal: ReefSurfacePoint,
  height01: number,
  crown: boolean,
  underside: boolean,
): SurfaceCandidate {
  const world = {
    x: round6(structure.center.x + rotatedLocal.x),
    y: round6(-core.platform.thickness * 0.52 + rotatedLocal.y),
    z: round6(structure.center.z + rotatedLocal.z),
  };
  const radialDistance = Math.hypot(structure.center.x, structure.center.z);
  const coreExtent = Math.max(core.platform.radiusX, core.platform.radiusZ);
  const radialExposure = clamp01(radialDistance / Math.max(0.01, coreExtent * 2.2));
  const exposure = clamp01(
    0.4 + height01 * 0.25 + radialExposure * 0.22 + (crown ? 0.08 : 0) - (underside ? 0.32 : 0),
  );
  const stability = clamp01(
    0.92
      - structure.shape.erosion * 0.34
      - structure.shape.irregularity * 0.32
      + structure.importance * 0.08,
  );
  return {
    id: `reef:surface:year:${structure.yearIndex}:${sampleIndex}`,
    seed,
    sourceKind: 'YEAR_STRUCTURE',
    sourceId: structure.id,
    sourceSignature: structure.signature,
    surfaceClass: structureClass(structure, crown, underside),
    sampleIndex,
    position: world,
    normal,
    height01: round6(height01),
    exposure: round6(exposure),
    stability: round6(stability),
    growth: structure.growth,
  };
}

function yearCandidate(
  core: ReefCoreManifest,
  structure: ReefComposedYearStructure,
  sampleIndex: number,
): SurfaceCandidate {
  const seed = stableHash32(`${structure.seed}:surface:${sampleIndex}`);
  switch (structure.archetype) {
    case 'BOULDER': return boulderCandidate(core, structure, sampleIndex, seed);
    case 'COLUMN': return columnCandidate(core, structure, sampleIndex, seed);
    case 'RIDGE': return ridgeCandidate(core, structure, sampleIndex, seed);
    case 'ARCH': return archCandidate(core, structure, sampleIndex, seed);
  }
}

function slopeDegrees(normal: ReefSurfacePoint): number {
  return round6(Math.acos(Math.max(-1, Math.min(1, normal.y))) * 180 / Math.PI);
}

function suitabilityFor(candidate: SurfaceCandidate): ReefSurfacePatch {
  const slope = slopeDegrees(candidate.normal);
  const slopeScore = slope <= 65
    ? 1
    : slope <= 105
      ? lerp(1, 0.5, (slope - 65) / 40)
      : clamp01(0.5 - (slope - 105) / 75);
  const exposureScore = clamp01(1 - Math.abs(candidate.exposure - 0.68) / 0.68);
  const heightScore = clamp01(0.52 + candidate.height01 * 0.48);
  const suitability = round6(clamp01(
    slopeScore * 0.32
      + exposureScore * 0.24
      + candidate.stability * 0.24
      + heightScore * 0.20,
  ));
  const capacity = round6(clamp01(
    suitability
      * (0.62 + candidate.stability * 0.38)
      * clamp01(candidate.growth),
  ));
  const eligible = candidate.normal.y >= REEF_SURFACE_MIN_NORMAL_Y
    && candidate.stability >= 0.42
    && suitability >= REEF_SURFACE_MIN_SUITABILITY
    && capacity >= 0.08;
  const signature = hex32(stableHash32([
    REEF_SURFACE_VERSION,
    candidate.id,
    candidate.sourceSignature,
    candidate.position.x,
    candidate.position.y,
    candidate.position.z,
    candidate.normal.x,
    candidate.normal.y,
    candidate.normal.z,
    suitability,
    capacity,
    eligible ? 1 : 0,
  ].join('\u001f')));

  return {
    id: candidate.id,
    seed: candidate.seed,
    sourceKind: candidate.sourceKind,
    sourceId: candidate.sourceId,
    sourceSignature: candidate.sourceSignature,
    surfaceClass: candidate.surfaceClass,
    sampleIndex: candidate.sampleIndex,
    position: candidate.position,
    normal: candidate.normal,
    slopeDegrees: slope,
    height01: candidate.height01,
    exposure: candidate.exposure,
    stability: candidate.stability,
    suitability,
    capacity,
    eligible,
    signature,
  };
}

export function buildReefSurfaceSystem({
  core,
  composition,
}: BuildReefSurfaceSystemInput): ReefSurfaceManifest {
  const candidates: SurfaceCandidate[] = [];

  for (let index = 0; index < REEF_SURFACE_CORE_SAMPLES; index += 1) {
    candidates.push(coreCandidate(core, index));
  }
  for (let index = 0; index < REEF_SURFACE_PLATFORM_SAMPLES; index += 1) {
    candidates.push(platformCandidate(core, index));
  }
  composition.structures.forEach((structure) => {
    for (let index = 0; index < REEF_SURFACE_YEAR_SAMPLES; index += 1) {
      candidates.push(yearCandidate(core, structure, index));
    }
  });

  const patches = candidates.map(suitabilityFor);
  if (patches.length > REEF_SURFACE_MAX_PATCHES) {
    throw new Error(`Reef Phase 4 exceeded the mobile surface budget: ${patches.length}.`);
  }
  const eligible = patches.filter((patch) => patch.eligible);
  const sumSuitability = patches.reduce((total, patch) => total + patch.suitability, 0);
  const sumEligibleSuitability = eligible.reduce((total, patch) => total + patch.suitability, 0);
  const totalCapacity = patches.reduce((total, patch) => total + patch.capacity, 0);
  const diagnostics: ReefSurfaceDiagnostics = {
    patchCount: patches.length,
    eligiblePatchCount: eligible.length,
    rejectedUndersideCount: patches.filter((patch) => patch.normal.y < REEF_SURFACE_MIN_NORMAL_Y).length,
    corePatchCount: REEF_SURFACE_CORE_SAMPLES,
    platformPatchCount: REEF_SURFACE_PLATFORM_SAMPLES,
    yearPatchCount: patches.length - REEF_SURFACE_CORE_SAMPLES - REEF_SURFACE_PLATFORM_SAMPLES,
    averageSuitability: round6(patches.length > 0 ? sumSuitability / patches.length : 0),
    averageEligibleSuitability: round6(eligible.length > 0 ? sumEligibleSuitability / eligible.length : 0),
    totalCapacity: round6(totalCapacity),
    boundedForMobile: patches.length <= REEF_SURFACE_MAX_PATCHES,
  };
  const signature = hex32(stableHash32([
    REEF_SURFACE_VERSION,
    core.identity.reefSeed,
    composition.signature,
    ...patches.map((patch) => patch.signature),
  ].join('\u001f')));

  return {
    version: REEF_SURFACE_VERSION,
    reefSeed: core.identity.reefSeed,
    sourceCompositionSignature: composition.signature,
    patches,
    diagnostics,
    signature,
  };
}
