import { stableHash32 } from '../../evolution';
import { clamp01, round6, seededUnit } from './math';
import type { ReefCompositionManifest } from './composition';
import type { ReefCoralColoniesManifest, ReefCoralColony } from './coralColonies';
import type { ReefCoreManifest } from './reefCore';
import type { ReefSurfacePoint } from './surfaceSystem';

export const REEF_ACCRETION_VERSION = 'reef-accretion-v1' as const;
export const REEF_ACCRETION_MAX_LAYERS = 128;
export const REEF_ACCRETION_SHEET_LIMIT = 48;
export const REEF_ACCRETION_SKELETON_LIMIT = 16;
export const REEF_ACCRETION_PLATE_STACK_LIMIT = 16;
export const REEF_ACCRETION_STRUCTURE_SKIRT_LIMIT = 32;
export const REEF_ACCRETION_MINERAL_LIMIT = 16;

export type ReefAccretionKind =
  | 'ENCRUSTING_SHEET'
  | 'SKELETON_BASE'
  | 'PLATE_STACK'
  | 'STRUCTURE_SKIRT'
  | 'MINERAL_TRANSITION';

export interface ReefAccretionLayer {
  id: string;
  seed: number;
  kind: ReefAccretionKind;
  sourceId: string;
  anchorId: string;
  birthYear: number;
  position: ReefSurfacePoint;
  normal: ReefSurfacePoint;
  tangentRotation: number;
  radiusX: number;
  radiusZ: number;
  thickness: number;
  elevation: number;
  growth: number;
  burial: number;
  toneIndex: number;
  stackIndex: number;
  identitySignature: string;
  signature: string;
}

export interface ReefAccretionDiagnostics {
  layerCount: number;
  visibleLayerCount: number;
  coveredSourceCount: number;
  averageGrowth: number;
  boundedForMobile: boolean;
  kindCounts: Record<ReefAccretionKind, number>;
}

export interface ReefAccretionManifest {
  version: typeof REEF_ACCRETION_VERSION;
  reefSeed: number;
  sourceCompositionSignature: string;
  sourceColonySignature: string;
  layers: ReefAccretionLayer[];
  diagnostics: ReefAccretionDiagnostics;
  signature: string;
}

export interface BuildReefAccretionInput {
  core: ReefCoreManifest;
  composition: ReefCompositionManifest;
  colonies: ReefCoralColoniesManifest;
}

interface AccretionSpec {
  id: string;
  seed: number;
  kind: ReefAccretionKind;
  sourceId: string;
  anchorId: string;
  birthYear: number;
  position: ReefSurfacePoint;
  normal: ReefSurfacePoint;
  tangentRotation: number;
  radiusX: number;
  radiusZ: number;
  thickness: number;
  elevation: number;
  growth: number;
  burial: number;
  toneIndex: number;
  stackIndex: number;
}

const hex32 = (value: number) => (value >>> 0).toString(16).padStart(8, '0');
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function ageSince(core: ReefCoreManifest, birthYear: number): number {
  return Math.max(0, core.age.ageYears - birthYear);
}

function phaseGrowth(age: number, delay: number, duration: number): number {
  return round6(clamp01((age - delay) / Math.max(0.001, duration)));
}

function identitySignature(spec: AccretionSpec): string {
  return hex32(stableHash32([
    REEF_ACCRETION_VERSION,
    spec.id,
    spec.seed,
    spec.kind,
    spec.sourceId,
    spec.anchorId,
    spec.birthYear,
    spec.position.x,
    spec.position.z,
    spec.normal.x,
    spec.normal.y,
    spec.normal.z,
    spec.tangentRotation,
    spec.radiusX,
    spec.radiusZ,
    spec.thickness,
    spec.elevation,
    spec.toneIndex,
    spec.stackIndex,
  ].join('\u001f')));
}

function finalize(spec: AccretionSpec): ReefAccretionLayer {
  const identity = identitySignature(spec);
  const signature = hex32(stableHash32([
    identity,
    spec.position.y,
    spec.growth,
    spec.burial,
  ].join('\u001f')));
  return {
    ...spec,
    identitySignature: identity,
    signature,
  };
}

function sheetFor(core: ReefCoreManifest, colony: ReefCoralColony): ReefAccretionLayer {
  const seed = stableHash32(`${colony.seed}:accretion:sheet`);
  const age = ageSince(core, colony.birthYear);
  const stretch = lerp(0.88, 1.16, seededUnit(seed, 'stretch'));
  const growth = round6(clamp01(
    phaseGrowth(age, 0, 2.4) * 0.72 + colony.growth * 0.28,
  ));
  return finalize({
    id: `reef:accretion:sheet:${colony.id}`,
    seed,
    kind: 'ENCRUSTING_SHEET',
    sourceId: colony.sourceId,
    anchorId: colony.patchId,
    birthYear: colony.birthYear,
    position: colony.position,
    normal: colony.normal,
    tangentRotation: round6(colony.tangentRotation + lerp(-0.22, 0.22, seededUnit(seed, 'rotation'))),
    radiusX: round6(colony.radius * 1.72 * stretch),
    radiusZ: round6(colony.radius * 1.36 / stretch),
    thickness: round6(0.045 + colony.radius * 0.12),
    elevation: round6(0.008 + colony.radius * 0.015),
    growth,
    burial: round6(clamp01(0.18 + age * 0.08)),
    toneIndex: Math.floor(seededUnit(seed, 'tone') * 4),
    stackIndex: 0,
  });
}

function skeletonFor(core: ReefCoreManifest, colony: ReefCoralColony): ReefAccretionLayer {
  const seed = stableHash32(`${colony.seed}:accretion:skeleton`);
  const age = ageSince(core, colony.birthYear);
  const squash = lerp(0.82, 1.14, seededUnit(seed, 'squash'));
  return finalize({
    id: `reef:accretion:skeleton:${colony.id}`,
    seed,
    kind: 'SKELETON_BASE',
    sourceId: colony.sourceId,
    anchorId: colony.patchId,
    birthYear: colony.birthYear,
    position: colony.position,
    normal: colony.normal,
    tangentRotation: round6(colony.tangentRotation + lerp(-0.34, 0.34, seededUnit(seed, 'rotation'))),
    radiusX: round6(colony.radius * 1.28 * squash),
    radiusZ: round6(colony.radius * 1.18 / squash),
    thickness: round6(0.07 + colony.radius * 0.16),
    elevation: round6(0.012 + colony.radius * 0.02),
    growth: phaseGrowth(age, 0.7, 3.4),
    burial: round6(clamp01(0.25 + age * 0.11)),
    toneIndex: Math.floor(seededUnit(seed, 'tone') * 4),
    stackIndex: 0,
  });
}

function mineralFor(core: ReefCoreManifest, colony: ReefCoralColony): ReefAccretionLayer {
  const seed = stableHash32(`${colony.seed}:accretion:mineral`);
  const age = ageSince(core, colony.birthYear);
  const longAxis = lerp(1.05, 1.34, seededUnit(seed, 'long-axis'));
  return finalize({
    id: `reef:accretion:mineral:${colony.id}`,
    seed,
    kind: 'MINERAL_TRANSITION',
    sourceId: colony.sourceId,
    anchorId: colony.patchId,
    birthYear: colony.birthYear,
    position: colony.position,
    normal: colony.normal,
    tangentRotation: round6(colony.tangentRotation + lerp(0.48, 1.12, seededUnit(seed, 'rotation'))),
    radiusX: round6(colony.radius * 2.08 * longAxis),
    radiusZ: round6(colony.radius * 1.34 / longAxis),
    thickness: round6(0.028 + colony.radius * 0.075),
    elevation: 0.004,
    growth: phaseGrowth(age, 1.15, 4.2),
    burial: round6(clamp01(0.34 + age * 0.1)),
    toneIndex: Math.floor(seededUnit(seed, 'tone') * 4),
    stackIndex: 0,
  });
}

function plateStackFor(
  core: ReefCoreManifest,
  colony: ReefCoralColony,
  stackIndex: number,
): ReefAccretionLayer {
  const seed = stableHash32(`${colony.seed}:accretion:plate-stack:${stackIndex}`);
  const age = ageSince(core, colony.birthYear);
  const scale = stackIndex === 1 ? 0.88 : 0.70;
  const delay = stackIndex === 1 ? 0.75 : 1.65;
  const stretch = lerp(0.88, 1.12, seededUnit(seed, 'stretch'));
  return finalize({
    id: `reef:accretion:plate:${colony.id}:${stackIndex}`,
    seed,
    kind: 'PLATE_STACK',
    sourceId: colony.sourceId,
    anchorId: colony.patchId,
    birthYear: colony.birthYear,
    position: colony.position,
    normal: colony.normal,
    tangentRotation: round6(colony.tangentRotation + lerp(-0.45, 0.45, seededUnit(seed, 'rotation'))),
    radiusX: round6(colony.radius * scale * stretch),
    radiusZ: round6(colony.radius * scale * 0.86 / stretch),
    thickness: round6(0.035 + colony.radius * 0.08),
    elevation: round6(colony.height * (0.58 + stackIndex * 0.23)),
    growth: phaseGrowth(age, delay, 2.8),
    burial: 0,
    toneIndex: Math.floor(seededUnit(seed, 'tone') * 4),
    stackIndex,
  });
}

function structureSkirtFor(
  core: ReefCoreManifest,
  structure: ReefCompositionManifest['structures'][number],
): ReefAccretionLayer {
  const seed = stableHash32(`${structure.seed}:accretion:structure-skirt`);
  const structureAge = Math.max(0, core.age.ageYears - structure.yearIndex);
  const stretch = lerp(0.78, 1.18, seededUnit(seed, 'stretch'));
  const radius = structure.footprintRadius;
  const groundY = -core.platform.thickness * 0.52;
  return finalize({
    id: `reef:accretion:skirt:${structure.id}`,
    seed,
    kind: 'STRUCTURE_SKIRT',
    sourceId: structure.id,
    anchorId: structure.id,
    birthYear: structure.yearIndex,
    position: {
      x: structure.center.x,
      y: round6(groundY + 0.018),
      z: structure.center.z,
    },
    normal: { x: 0, y: 1, z: 0 },
    tangentRotation: round6(structure.rotationY + lerp(-0.22, 0.22, seededUnit(seed, 'rotation'))),
    radiusX: round6(radius * 1.34 * stretch),
    radiusZ: round6(radius * 1.02 / stretch),
    thickness: round6(0.075 + radius * 0.11),
    elevation: 0,
    growth: phaseGrowth(structureAge, 0.35, 3.2),
    burial: round6(clamp01(0.32 + structureAge * 0.08)),
    toneIndex: Math.floor(seededUnit(seed, 'tone') * 4),
    stackIndex: 0,
  });
}

function chronologicalColonies(colonies: readonly ReefCoralColony[]): ReefCoralColony[] {
  return [...colonies].sort((left, right) => (
    left.birthYear - right.birthYear
      || left.sourceId.localeCompare(right.sourceId)
      || left.id.localeCompare(right.id)
  ));
}

export function buildReefAccretion({
  core,
  composition,
  colonies,
}: BuildReefAccretionInput): ReefAccretionManifest {
  const layers: ReefAccretionLayer[] = [];
  const orderedColonies = chronologicalColonies(colonies.colonies);

  orderedColonies
    .slice(0, REEF_ACCRETION_SHEET_LIMIT)
    .forEach((colony) => layers.push(sheetFor(core, colony)));

  orderedColonies
    .filter((colony) => seededUnit(colony.seed, 'accretion-skeleton-eligible') < 0.72)
    .slice(0, REEF_ACCRETION_SKELETON_LIMIT)
    .forEach((colony) => layers.push(skeletonFor(core, colony)));

  const plateLayers: ReefAccretionLayer[] = [];
  orderedColonies
    .filter((colony) => colony.morphotype === 'PLATE')
    .forEach((colony) => {
      for (let stackIndex = 1; stackIndex <= 2; stackIndex += 1) {
        if (plateLayers.length >= REEF_ACCRETION_PLATE_STACK_LIMIT) break;
        plateLayers.push(plateStackFor(core, colony, stackIndex));
      }
    });
  layers.push(...plateLayers);

  composition.structures
    .slice()
    .sort((left, right) => left.yearIndex - right.yearIndex)
    .slice(0, REEF_ACCRETION_STRUCTURE_SKIRT_LIMIT)
    .forEach((structure) => layers.push(structureSkirtFor(core, structure)));

  orderedColonies
    .filter((colony) => seededUnit(colony.seed, 'accretion-mineral-eligible') < 0.64)
    .slice(0, REEF_ACCRETION_MINERAL_LIMIT)
    .forEach((colony) => layers.push(mineralFor(core, colony)));

  if (layers.length > REEF_ACCRETION_MAX_LAYERS) {
    throw new Error(`Reef Phase 6 exceeded the mobile accretion budget: ${layers.length}.`);
  }

  const kindCounts: Record<ReefAccretionKind, number> = {
    ENCRUSTING_SHEET: 0,
    SKELETON_BASE: 0,
    PLATE_STACK: 0,
    STRUCTURE_SKIRT: 0,
    MINERAL_TRANSITION: 0,
  };
  layers.forEach((layer) => { kindCounts[layer.kind] += 1; });
  const visible = layers.filter((layer) => layer.growth > 0.015);
  const averageGrowth = round6(
    layers.length > 0
      ? layers.reduce((sum, layer) => sum + layer.growth, 0) / layers.length
      : 0,
  );
  const diagnostics: ReefAccretionDiagnostics = {
    layerCount: layers.length,
    visibleLayerCount: visible.length,
    coveredSourceCount: new Set(layers.map((layer) => layer.sourceId)).size,
    averageGrowth,
    boundedForMobile: layers.length <= REEF_ACCRETION_MAX_LAYERS,
    kindCounts,
  };
  const signature = hex32(stableHash32([
    REEF_ACCRETION_VERSION,
    core.identity.reefSeed,
    composition.signature,
    colonies.signature,
    ...layers.map((layer) => layer.signature),
  ].join('\u001f')));

  return {
    version: REEF_ACCRETION_VERSION,
    reefSeed: core.identity.reefSeed,
    sourceCompositionSignature: composition.signature,
    sourceColonySignature: colonies.signature,
    layers,
    diagnostics,
    signature,
  };
}
