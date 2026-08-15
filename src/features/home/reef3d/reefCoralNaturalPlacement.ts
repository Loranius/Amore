import {
  BufferGeometry,
  Float32BufferAttribute,
  Quaternion,
  Vector3,
} from 'three';
import type {
  ReefColonyMorphotype,
  ReefColonyTier,
  ReefLayoutVec3,
} from '@/engine/species/reef';
import {
  buildReefLivingCanopyGeometry,
  REEF_LIVING_CANOPY_BUDGET,
  REEF_LIVING_CANOPY_PASS,
  REEF_LIVING_CANOPY_VERSION,
  type ReefLivingCanopyGeometryMetrics,
  type ReefLivingCanopyPlan,
} from './reefLivingCanopy';
import type {
  ReefAllocatedSurfaceSlot,
  ReefSurfacePoint,
} from './reefSurfaceSlots';

export const REEF_CORAL_NATURAL_PLACEMENT_VERSION = 'reef-coral-natural-placement-v1';
export const REEF_CORAL_SURFACE_BINDING_VERSION = 'reef-coral-surface-binding-v1';

const TAU = Math.PI * 2;
const WORLD_UP = new Vector3(0, 1, 0);
const WORLD_X = new Vector3(1, 0, 0);
const MAX_TERRAIN_EDGE_HEIGHT_DELTA = 0.16;

export const REEF_CORAL_TERRAIN_EDGE_OFFSETS = Object.freeze([
  [0.085, 0],
  [-0.085, 0],
  [0, 0.085],
  [0, -0.085],
  [0.06, 0.06],
  [-0.06, 0.06],
  [0.06, -0.06],
  [-0.06, -0.06],
] as const);

export interface ReefCoralNaturalVariation {
  radialScale: number;
  heightScale: number;
  yawOffsetRad: number;
  tiltRad: number;
  tiltAzimuthRad: number;
}

export interface ReefCoralSurfaceFrame {
  supportNormal: ReefLayoutVec3;
  growthAxis: ReefLayoutVec3;
  tiltRad: number;
}

export type ReefCoralTerrainSampler = (
  x: number,
  z: number,
) => Pick<ReefSurfacePoint, 'y'> | null;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function stableUnit(seed: number, label: string): number {
  let hash = (seed ^ 0x9e3779b9) >>> 0;
  for (let index = 0; index < label.length; index += 1) {
    hash ^= label.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  return (hash >>> 0) / 0xffffffff;
}

function tiltLimitRad(morphotype: ReefColonyMorphotype): number {
  switch (morphotype) {
    case 'branching': return 8.5 * Math.PI / 180;
    case 'soft-coral': return 9.5 * Math.PI / 180;
    case 'sea-fan': return 7.5 * Math.PI / 180;
    case 'plating': return 5.5 * Math.PI / 180;
    case 'massive': return 4.5 * Math.PI / 180;
    case 'encrusting': return 2.5 * Math.PI / 180;
  }
}

function scaleEnvelope(morphotype: ReefColonyMorphotype): {
  radial: readonly [number, number];
  height: readonly [number, number];
  yaw: number;
} {
  switch (morphotype) {
    case 'branching':
      return { radial: [0.91, 1.08], height: [0.88, 1.14], yaw: 0.72 };
    case 'soft-coral':
      return { radial: [0.9, 1.09], height: [0.87, 1.15], yaw: 0.78 };
    case 'sea-fan':
      return { radial: [0.92, 1.07], height: [0.9, 1.12], yaw: 0.96 };
    case 'plating':
      return { radial: [0.9, 1.08], height: [0.92, 1.1], yaw: 0.86 };
    case 'massive':
      return { radial: [0.91, 1.08], height: [0.92, 1.1], yaw: 0.62 };
    case 'encrusting':
      return { radial: [0.93, 1.07], height: [0.9, 1.1], yaw: 0.54 };
  }
}

/** Stable per-colony variation: same relationship seed keeps the same coral silhouette. */
export function reefCoralNaturalVariation(
  seed: number,
  morphotype: ReefColonyMorphotype,
): ReefCoralNaturalVariation {
  const envelope = scaleEnvelope(morphotype);
  const radialScale = envelope.radial[0]
    + stableUnit(seed, 'natural-radial-scale') * (envelope.radial[1] - envelope.radial[0]);
  const heightScale = envelope.height[0]
    + stableUnit(seed, 'natural-height-scale') * (envelope.height[1] - envelope.height[0]);
  const yawOffsetRad = (stableUnit(seed, 'natural-yaw') - 0.5) * envelope.yaw * 2;
  const tiltRad = tiltLimitRad(morphotype)
    * (0.18 + stableUnit(seed, 'natural-tilt') * 0.82);
  const tiltAzimuthRad = stableUnit(seed, 'natural-tilt-azimuth') * TAU;

  return {
    radialScale: round6(radialScale),
    heightScale: round6(heightScale),
    yawOffsetRad: round6(yawOffsetRad),
    tiltRad: round6(tiltRad),
    tiltAzimuthRad: round6(tiltAzimuthRad),
  };
}

/**
 * Applies only bounded size/facing variation. Placement remains append-stable
 * because every value depends on the accepted colony seed rather than array order.
 */
export function naturalizeReefLivingCanopyPlan(
  plan: ReefLivingCanopyPlan,
): ReefLivingCanopyPlan {
  const colonies = plan.colonies.map((colony) => {
    const variation = reefCoralNaturalVariation(colony.seed, colony.morphotype);
    const footprintRadius = round6(Math.max(
      0.055,
      colony.footprintRadius * variation.radialScale,
    ));

    return {
      ...colony,
      footprintRadius,
      targetHeight: round6(Math.max(0.045, colony.targetHeight * variation.heightScale)),
      facingRad: round6(colony.facingRad + variation.yawOffsetRad),
      request: {
        ...colony.request,
        footprintRadius,
      },
    };
  });

  return {
    ...plan,
    colonies,
    requests: colonies.map((colony) => colony.request),
  };
}

function normalizedSupportNormal(surfaceNormal: ReefLayoutVec3 | undefined): Vector3 {
  const normal = new Vector3(
    surfaceNormal?.x ?? 0,
    surfaceNormal?.y ?? 1,
    surfaceNormal?.z ?? 0,
  );
  if (normal.lengthSq() <= 1e-10) normal.copy(WORLD_UP);
  normal.normalize();
  if (normal.y < 0) normal.negate();
  return normal;
}

/**
 * Builds a small species-bounded lean around the real support normal. The lean
 * changes the coral's growth axis, while grounding is repaired against the real
 * support plane after the geometry is rotated.
 */
export function buildReefCoralSurfaceFrame({
  seed,
  morphotype,
  surfaceNormal,
}: {
  seed: number;
  morphotype: ReefColonyMorphotype;
  surfaceNormal?: ReefLayoutVec3 | undefined;
}): ReefCoralSurfaceFrame {
  const variation = reefCoralNaturalVariation(seed, morphotype);
  const supportNormal = normalizedSupportNormal(surfaceNormal);
  const helper = Math.abs(supportNormal.y) < 0.94 ? WORLD_UP : WORLD_X;
  const tangentA = new Vector3().crossVectors(helper, supportNormal).normalize();
  const tangentB = new Vector3().crossVectors(supportNormal, tangentA).normalize();
  const tiltDirection = tangentA.multiplyScalar(Math.cos(variation.tiltAzimuthRad))
    .addScaledVector(tangentB, Math.sin(variation.tiltAzimuthRad))
    .normalize();
  const growthAxis = supportNormal.clone()
    .multiplyScalar(Math.cos(variation.tiltRad))
    .addScaledVector(tiltDirection, Math.sin(variation.tiltRad))
    .normalize();

  return {
    supportNormal: {
      x: round6(supportNormal.x),
      y: round6(supportNormal.y),
      z: round6(supportNormal.z),
    },
    growthAxis: {
      x: round6(growthAxis.x),
      y: round6(growthAxis.y),
      z: round6(growthAxis.z),
    },
    tiltRad: variation.tiltRad,
  };
}

/** Rejects thin terrace lips and abrupt ledges around an otherwise valid root hit. */
export function hasReefCoralTerrainFootprintSupport({
  x,
  z,
  centerY,
  sample,
}: {
  x: number;
  z: number;
  centerY: number;
  sample: ReefCoralTerrainSampler;
}): boolean {
  for (const [offsetX, offsetZ] of REEF_CORAL_TERRAIN_EDGE_OFFSETS) {
    const neighbor = sample(x + offsetX, z + offsetZ);
    if (!neighbor) return false;
    if (Math.abs(neighbor.y - centerY) > MAX_TERRAIN_EDGE_HEIGHT_DELTA) return false;
  }
  return true;
}

function emptyMorphotypeCounts(): Record<ReefColonyMorphotype, number> {
  return {
    branching: 0,
    massive: 0,
    plating: 0,
    encrusting: 0,
    'soft-coral': 0,
    'sea-fan': 0,
  };
}

function copyAttribute(
  geometry: BufferGeometry,
  name: 'position' | 'normal' | 'color',
  target: number[],
): void {
  const attribute = geometry.getAttribute(name);
  if (!attribute) return;
  for (let index = 0; index < attribute.count; index += 1) {
    target.push(attribute.getX(index), attribute.getY(index), attribute.getZ(index));
  }
}

function moveGeometryToSurface({
  geometry,
  slot,
  seed,
  morphotype,
  tier,
  footprintRadius,
  surfaceNormal,
}: {
  geometry: BufferGeometry;
  slot: ReefAllocatedSurfaceSlot;
  seed: number;
  morphotype: ReefColonyMorphotype;
  tier: ReefColonyTier;
  footprintRadius: number;
  surfaceNormal?: ReefLayoutVec3 | undefined;
}): ReefCoralSurfaceFrame {
  const frame = buildReefCoralSurfaceFrame({ seed, morphotype, surfaceNormal });
  const supportNormal = normalizedSupportNormal(frame.supportNormal);
  const growthAxis = normalizedSupportNormal(frame.growthAxis);
  const rootLift = tier === 'micro' ? 0.006 : 0.012;
  const sourcePivot = new Vector3(
    slot.position.x,
    slot.position.y + rootLift,
    slot.position.z,
  );
  const targetPivot = new Vector3(slot.position.x, slot.position.y, slot.position.z)
    .addScaledVector(supportNormal, rootLift);
  const rotation = new Quaternion().setFromUnitVectors(WORLD_UP, growthAxis);

  geometry.translate(-sourcePivot.x, -sourcePivot.y, -sourcePivot.z);
  geometry.applyQuaternion(rotation);
  geometry.translate(targetPivot.x, targetPivot.y, targetPivot.z);

  const positions = geometry.getAttribute('position');
  let minimumSignedDistance = Number.POSITIVE_INFINITY;
  const point = new Vector3();
  const supportPoint = new Vector3(slot.position.x, slot.position.y, slot.position.z);
  for (let index = 0; index < positions.count; index += 1) {
    point.set(positions.getX(index), positions.getY(index), positions.getZ(index));
    minimumSignedDistance = Math.min(
      minimumSignedDistance,
      point.sub(supportPoint).dot(supportNormal),
    );
  }

  const minimumClearance = tier === 'micro' ? 0.0015 : 0.003;
  if (minimumSignedDistance < minimumClearance) {
    const repair = minimumClearance - minimumSignedDistance;
    geometry.translate(
      supportNormal.x * repair,
      supportNormal.y * repair,
      supportNormal.z * repair,
    );
  }

  geometry.userData.reefCoralSurfaceFrame = frame;
  geometry.userData.reefCoralSurfaceFootprintRadius = clamp(footprintRadius, 0, 10);
  return frame;
}

/**
 * Generates the visible canopy per colony, binds each colony to its real support
 * normal, then merges everything back into one draw call for mobile rendering.
 */
export function buildReefSurfaceBoundLivingCanopyGeometry({
  plan,
  slots,
  surfaceNormalByRequestId,
}: {
  plan: ReefLivingCanopyPlan;
  slots: readonly ReefAllocatedSurfaceSlot[];
  surfaceNormalByRequestId?: ReadonlyMap<string, ReefLayoutVec3>;
}): BufferGeometry {
  const slotByRequestId = new Map(slots.map((slot) => [slot.requestId, slot] as const));
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const morphotypeCounts = emptyMorphotypeCounts();
  let allocatedColonyCount = 0;
  let surfaceBoundColonyCount = 0;

  for (const colony of plan.colonies) {
    const slot = slotByRequestId.get(colony.request.id);
    if (!slot) continue;

    const singleCounts = emptyMorphotypeCounts();
    singleCounts[colony.morphotype] = 1;
    const singlePlan: ReefLivingCanopyPlan = {
      colonies: [colony],
      requests: [colony.request],
      morphotypeCounts: singleCounts,
    };
    const part = buildReefLivingCanopyGeometry({ plan: singlePlan, slots: [slot] });
    moveGeometryToSurface({
      geometry: part,
      slot,
      seed: colony.seed,
      morphotype: colony.morphotype,
      tier: colony.tier,
      footprintRadius: colony.footprintRadius,
      surfaceNormal: surfaceNormalByRequestId?.get(colony.request.id),
    });
    copyAttribute(part, 'position', positions);
    copyAttribute(part, 'normal', normals);
    copyAttribute(part, 'color', colors);
    morphotypeCounts[colony.morphotype] += 1;
    allocatedColonyCount += 1;
    if (surfaceNormalByRequestId?.has(colony.request.id)) surfaceBoundColonyCount += 1;
    part.dispose();
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  if (positions.length > 0) {
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  }

  const vertexCount = positions.length / 3;
  const triangleCount = vertexCount / 3;
  const metrics: ReefLivingCanopyGeometryMetrics = {
    sourceColonyCount: plan.colonies.length,
    allocatedColonyCount,
    unresolvedColonyCount: plan.colonies.length - allocatedColonyCount,
    morphotypeCounts,
    vertexCount,
    triangleCount,
    drawCalls: vertexCount > 0 ? 1 : 0,
    budgetExceeded: plan.colonies.length > REEF_LIVING_CANOPY_BUDGET.maximumColonies
      || vertexCount > REEF_LIVING_CANOPY_BUDGET.maximumVertices
      || triangleCount > REEF_LIVING_CANOPY_BUDGET.maximumTriangles,
  };

  geometry.userData.reefLivingCanopyVersion = REEF_LIVING_CANOPY_VERSION;
  geometry.userData.reefLivingCanopyPass = REEF_LIVING_CANOPY_PASS;
  geometry.userData.reefLivingCanopyMetrics = metrics;
  geometry.userData.reefLivingCanopyDrawCalls = metrics.drawCalls;
  geometry.userData.reefCoralNaturalPlacementVersion = REEF_CORAL_NATURAL_PLACEMENT_VERSION;
  geometry.userData.reefCoralSurfaceBindingVersion = REEF_CORAL_SURFACE_BINDING_VERSION;
  geometry.userData.reefCoralSurfaceBoundColonyCount = surfaceBoundColonyCount;
  return geometry;
}
