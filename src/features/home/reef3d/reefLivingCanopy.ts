import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Vector3,
} from 'three';
import type {
  ReefColonyMorphotype,
  ReefColonyTier,
  ReefInfluenceSource,
  ReefLayoutVec3,
} from '@/engine/species/reef';
import type { ReefPreviewBuild } from './buildReefPreview';
import {
  REEF_OBJECT_ROTATION,
  reefObjectWorldPoint,
} from './reefObjectTransform';
import { REEF_PRESENTATION_PROFILE } from './reefPresentation';
import type {
  ReefAllocatedSurfaceSlot,
  ReefSurfaceSlotRequest,
} from './reefSurfaceSlots';

export const REEF_LIVING_CANOPY_VERSION = 'reef-living-canopy-v1';
export const REEF_LIVING_CANOPY_PASS = 'one-merged-six-morphotype-canopy';

export const REEF_LIVING_CANOPY_BUDGET = Object.freeze({
  maximumColonies: 144,
  maximumTriangles: 20_000,
  maximumVertices: 60_000,
  expectedDrawCalls: 1,
});

type ColorTuple = readonly [number, number, number];
type MutableMorphotypeCounts = Record<ReefColonyMorphotype, number>;

interface GeometryBuffers {
  positions: number[];
  colors: number[];
}

interface LocalPoint {
  x: number;
  y: number;
  z: number;
}

interface CanopyPlacement {
  root: ReefLayoutVec3;
  yaw: number;
  seed: number;
  palette: CanopyPalette;
}

interface CanopyPalette {
  root: ColorTuple;
  body: ColorTuple;
  tip: ColorTuple;
}

export interface ReefLivingCanopyColony {
  id: string;
  sourceColonyId: string;
  sourceModule: ReefInfluenceSource;
  morphotype: ReefColonyMorphotype;
  tier: ReefColonyTier;
  seed: number;
  emphasized: boolean;
  weight: number;
  maturity: number;
  footprintRadius: number;
  targetHeight: number;
  facingRad: number;
  request: ReefSurfaceSlotRequest;
}

export interface ReefLivingCanopyPlan {
  colonies: ReefLivingCanopyColony[];
  requests: ReefSurfaceSlotRequest[];
  morphotypeCounts: Record<ReefColonyMorphotype, number>;
}

export interface ReefLivingCanopyGeometryMetrics {
  sourceColonyCount: number;
  allocatedColonyCount: number;
  unresolvedColonyCount: number;
  morphotypeCounts: Record<ReefColonyMorphotype, number>;
  vertexCount: number;
  triangleCount: number;
  drawCalls: 0 | 1;
  budgetExceeded: boolean;
}

const PALETTES: Readonly<Record<ReefColonyMorphotype, CanopyPalette>> = Object.freeze({
  branching: {
    root: colorTuple('#873e4f'),
    body: colorTuple('#d45f72'),
    tip: colorTuple('#ffb09e'),
  },
  massive: {
    root: colorTuple('#8b4e42'),
    body: colorTuple('#d9785d'),
    tip: colorTuple('#ffc08c'),
  },
  plating: {
    root: colorTuple('#687547'),
    body: colorTuple('#a9b965'),
    tip: colorTuple('#e8dc8d'),
  },
  encrusting: {
    root: colorTuple('#7a3d5c'),
    body: colorTuple('#c96685'),
    tip: colorTuple('#f3a5b7'),
  },
  'soft-coral': {
    root: colorTuple('#594687'),
    body: colorTuple('#9670c4'),
    tip: colorTuple('#ddb1e7'),
  },
  'sea-fan': {
    root: colorTuple('#354d89'),
    body: colorTuple('#657ab8'),
    tip: colorTuple('#a8d4e4'),
  },
});

function colorTuple(value: string): ColorTuple {
  const color = new Color(value);
  return [color.r, color.g, color.b];
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
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

function emptyMorphotypeCounts(): MutableMorphotypeCounts {
  return {
    branching: 0,
    massive: 0,
    plating: 0,
    encrusting: 0,
    'soft-coral': 0,
    'sea-fan': 0,
  };
}

function shadeColor(color: ColorTuple, amount: number): ColorTuple {
  return [
    clamp(color[0] * amount, 0, 1),
    clamp(color[1] * amount, 0, 1),
    clamp(color[2] * amount, 0, 1),
  ];
}

function paletteFor(morphotype: ReefColonyMorphotype, seed: number): CanopyPalette {
  const source = PALETTES[morphotype];
  const variation = 0.92 + stableUnit(seed, 'canopy-palette') * 0.14;
  return {
    root: shadeColor(source.root, variation * 0.92),
    body: shadeColor(source.body, variation),
    tip: shadeColor(source.tip, Math.min(1.08, variation * 1.035)),
  };
}

/**
 * Rebuilds the exact chronological requests used by ReefObject's canonical
 * geometry. The richer canopy therefore lands on the same allocated surface
 * slots instead of inventing a second set of logical colonies.
 */
export function buildReefLivingCanopyPlan(build: ReefPreviewBuild): ReefLivingCanopyPlan {
  const instructionById = new Map(
    build.species.growth.map((instruction) => [instruction.id, instruction] as const),
  );
  const morphotypeCounts = emptyMorphotypeCounts();
  const colonies = build.layout.colonies.map((colony): ReefLivingCanopyColony => {
    const instruction = instructionById.get(colony.sourceInstructionId);
    const preferred = reefObjectWorldPoint({
      x: colony.position.x,
      y: colony.position.y * REEF_PRESENTATION_PROFILE.foundationVerticalScale
        + REEF_PRESENTATION_PROFILE.colonyRootLift,
      z: colony.position.z,
    });
    const request: ReefSurfaceSlotRequest = {
      id: `reef:colony-mesh-range:${colony.id}`,
      sequence: colony.sequence,
      ...(instruction ? { epochIndex: instruction.epochIndex } : {}),
      preferred,
      footprintRadius: Math.max(0.06, colony.footprintRadius),
    };
    morphotypeCounts[colony.morphotype] += 1;

    return {
      id: `reef:living-canopy:${colony.id}`,
      sourceColonyId: colony.id,
      sourceModule: instruction?.sourceModule ?? 'relationship',
      morphotype: colony.morphotype,
      tier: colony.tier,
      seed: colony.seed,
      emphasized: colony.emphasized,
      weight: colony.weight,
      maturity: colony.maturity,
      footprintRadius: colony.footprintRadius,
      targetHeight: colony.targetHeight,
      facingRad: colony.facingRad,
      request,
    };
  });

  return {
    colonies,
    requests: colonies.map((colony) => colony.request),
    morphotypeCounts,
  };
}

function appendTriangle(
  buffers: GeometryBuffers,
  first: ReefLayoutVec3,
  second: ReefLayoutVec3,
  third: ReefLayoutVec3,
  firstColor: ColorTuple,
  secondColor: ColorTuple = firstColor,
  thirdColor: ColorTuple = firstColor,
): void {
  for (const [point, color] of [
    [first, firstColor],
    [second, secondColor],
    [third, thirdColor],
  ] as const) {
    buffers.positions.push(point.x, point.y, point.z);
    buffers.colors.push(color[0], color[1], color[2]);
  }
}

function worldPoint(placement: CanopyPlacement, point: LocalPoint): ReefLayoutVec3 {
  const cosine = Math.cos(placement.yaw);
  const sine = Math.sin(placement.yaw);
  return {
    x: placement.root.x + point.x * cosine + point.z * sine,
    y: placement.root.y + point.y,
    z: placement.root.z - point.x * sine + point.z * cosine,
  };
}

function appendFacetedLobe(
  buffers: GeometryBuffers,
  placement: CanopyPlacement,
  label: string,
  centerX: number,
  baseY: number,
  centerZ: number,
  radiusX: number,
  height: number,
  radiusZ: number,
  sides = 6,
): void {
  const phase = stableUnit(placement.seed, `${label}:phase`) * Math.PI * 2;
  const bottom = worldPoint(placement, { x: centerX, y: baseY, z: centerZ });
  const top = worldPoint(placement, {
    x: centerX + (stableUnit(placement.seed, `${label}:top-x`) - 0.5) * radiusX * 0.18,
    y: baseY + height,
    z: centerZ + (stableUnit(placement.seed, `${label}:top-z`) - 0.5) * radiusZ * 0.18,
  });
  const ring = Array.from({ length: sides }, (_value, index) => {
    const angle = phase + index / sides * Math.PI * 2;
    const irregularity = 0.86
      + stableUnit(placement.seed, `${label}:edge:${index}`) * 0.24;
    return worldPoint(placement, {
      x: centerX + Math.cos(angle) * radiusX * irregularity,
      y: baseY + height * (
        0.34 + stableUnit(placement.seed, `${label}:height:${index}`) * 0.12
      ),
      z: centerZ + Math.sin(angle) * radiusZ * irregularity,
    });
  });

  for (let index = 0; index < sides; index += 1) {
    const next = (index + 1) % sides;
    appendTriangle(
      buffers,
      bottom,
      ring[next]!,
      ring[index]!,
      placement.palette.root,
      placement.palette.body,
      placement.palette.body,
    );
    appendTriangle(
      buffers,
      top,
      ring[index]!,
      ring[next]!,
      placement.palette.tip,
      placement.palette.body,
      placement.palette.body,
    );
  }
}

function appendPlate(
  buffers: GeometryBuffers,
  placement: CanopyPlacement,
  label: string,
  centerX: number,
  baseY: number,
  centerZ: number,
  radiusX: number,
  radiusZ: number,
  thickness: number,
  tiltX: number,
  tiltZ: number,
): void {
  const sides = 8;
  const phase = stableUnit(placement.seed, `${label}:phase`) * Math.PI * 2;
  const topCenter = worldPoint(placement, {
    x: centerX,
    y: baseY + thickness,
    z: centerZ,
  });
  const bottomCenter = worldPoint(placement, { x: centerX, y: baseY, z: centerZ });
  const topRing: ReefLayoutVec3[] = [];
  const bottomRing: ReefLayoutVec3[] = [];

  for (let index = 0; index < sides; index += 1) {
    const angle = phase + index / sides * Math.PI * 2;
    const irregularity = 0.84
      + stableUnit(placement.seed, `${label}:edge:${index}`) * 0.28;
    const x = Math.cos(angle) * radiusX * irregularity;
    const z = Math.sin(angle) * radiusZ * irregularity;
    const tilt = x * tiltX + z * tiltZ;
    topRing.push(worldPoint(placement, {
      x: centerX + x,
      y: baseY + thickness + tilt,
      z: centerZ + z,
    }));
    bottomRing.push(worldPoint(placement, {
      x: centerX + x,
      y: baseY + tilt,
      z: centerZ + z,
    }));
  }

  for (let index = 0; index < sides; index += 1) {
    const next = (index + 1) % sides;
    const topColor = index % 3 === 0 ? placement.palette.tip : placement.palette.body;
    appendTriangle(
      buffers,
      topCenter,
      topRing[index]!,
      topRing[next]!,
      placement.palette.body,
      topColor,
      topColor,
    );
    appendTriangle(
      buffers,
      bottomCenter,
      bottomRing[next]!,
      bottomRing[index]!,
      placement.palette.root,
    );
    appendTriangle(
      buffers,
      topRing[index]!,
      bottomRing[index]!,
      bottomRing[next]!,
      topColor,
      placement.palette.root,
      placement.palette.root,
    );
    appendTriangle(
      buffers,
      topRing[index]!,
      bottomRing[next]!,
      topRing[next]!,
      topColor,
      placement.palette.root,
      topColor,
    );
  }
}

function appendTaperedBranch(
  buffers: GeometryBuffers,
  placement: CanopyPlacement,
  label: string,
  start: LocalPoint,
  end: LocalPoint,
  radiusStart: number,
  radiusEnd: number,
): void {
  const sides = 5;
  const startVector = new Vector3(start.x, start.y, start.z);
  const endVector = new Vector3(end.x, end.y, end.z);
  const direction = endVector.clone().sub(startVector);
  if (direction.lengthSq() <= 1e-8) return;
  direction.normalize();
  const helper = Math.abs(direction.y) < 0.9
    ? new Vector3(0, 1, 0)
    : new Vector3(1, 0, 0);
  const axisA = new Vector3().crossVectors(direction, helper).normalize();
  const axisB = new Vector3().crossVectors(direction, axisA).normalize();
  const phase = stableUnit(placement.seed, `${label}:phase`) * Math.PI * 2;
  const startRing: ReefLayoutVec3[] = [];
  const endRing: ReefLayoutVec3[] = [];

  for (let side = 0; side < sides; side += 1) {
    const angle = phase + side / sides * Math.PI * 2;
    const radial = axisA.clone().multiplyScalar(Math.cos(angle))
      .addScaledVector(axisB, Math.sin(angle));
    startRing.push(worldPoint(placement, {
      x: start.x + radial.x * radiusStart,
      y: start.y + radial.y * radiusStart,
      z: start.z + radial.z * radiusStart,
    }));
    endRing.push(worldPoint(placement, {
      x: end.x + radial.x * radiusEnd,
      y: end.y + radial.y * radiusEnd,
      z: end.z + radial.z * radiusEnd,
    }));
  }

  const startCenter = worldPoint(placement, start);
  const endCenter = worldPoint(placement, end);
  for (let side = 0; side < sides; side += 1) {
    const next = (side + 1) % sides;
    appendTriangle(
      buffers,
      startRing[side]!,
      endRing[next]!,
      endRing[side]!,
      placement.palette.root,
      placement.palette.tip,
      placement.palette.tip,
    );
    appendTriangle(
      buffers,
      startRing[side]!,
      startRing[next]!,
      endRing[next]!,
      placement.palette.root,
      placement.palette.root,
      placement.palette.tip,
    );
    appendTriangle(
      buffers,
      startCenter,
      startRing[next]!,
      startRing[side]!,
      placement.palette.root,
    );
    appendTriangle(
      buffers,
      endCenter,
      endRing[side]!,
      endRing[next]!,
      placement.palette.tip,
    );
  }
}

function appendMassiveColony(
  buffers: GeometryBuffers,
  placement: CanopyPlacement,
  width: number,
  height: number,
): void {
  appendFacetedLobe(
    buffers,
    placement,
    'massive:center',
    0,
    0,
    0,
    width * 0.67,
    height,
    width * 0.58,
    7,
  );
  for (let index = 0; index < 4; index += 1) {
    const angle = stableUnit(placement.seed, 'massive-phase') * Math.PI * 2
      + index / 4 * Math.PI * 2;
    const radius = width * (0.27 + stableUnit(placement.seed, `massive-radius:${index}`) * 0.07);
    appendFacetedLobe(
      buffers,
      placement,
      `massive:satellite:${index}`,
      Math.cos(angle) * width * 0.38,
      0,
      Math.sin(angle) * width * 0.32,
      radius,
      height * (0.48 + stableUnit(placement.seed, `massive-height:${index}`) * 0.18),
      radius * 0.9,
    );
  }
}

function appendBranchingColony(
  buffers: GeometryBuffers,
  placement: CanopyPlacement,
  width: number,
  height: number,
): void {
  appendFacetedLobe(
    buffers,
    placement,
    'branching:foot',
    0,
    0,
    0,
    width * 0.42,
    Math.max(0.07, height * 0.14),
    width * 0.36,
  );
  const phase = stableUnit(placement.seed, 'branching-phase') * Math.PI * 2;
  for (let index = 0; index < 5; index += 1) {
    const angle = phase + index / 5 * Math.PI * 2;
    const radialStart = index === 0 ? 0 : width * 0.12;
    const radialEnd = width * (
      0.28 + stableUnit(placement.seed, `branching-lean:${index}`) * 0.26
    );
    appendTaperedBranch(
      buffers,
      placement,
      `branching:arm:${index}`,
      {
        x: Math.cos(angle) * radialStart,
        y: height * 0.07,
        z: Math.sin(angle) * radialStart,
      },
      {
        x: Math.cos(angle) * radialEnd,
        y: height * (0.7 + stableUnit(placement.seed, `branching-height:${index}`) * 0.3),
        z: Math.sin(angle) * radialEnd,
      },
      Math.max(0.018, width * 0.12),
      Math.max(0.007, width * 0.045),
    );
  }
}

function appendPlatingColony(
  buffers: GeometryBuffers,
  placement: CanopyPlacement,
  width: number,
  height: number,
): void {
  appendFacetedLobe(
    buffers,
    placement,
    'plating:foot',
    0,
    0,
    0,
    width * 0.28,
    Math.max(0.07, height * 0.24),
    width * 0.24,
  );
  for (let index = 0; index < 3; index += 1) {
    const level = (index + 1) / 3;
    const direction = index % 2 === 0 ? 1 : -1;
    const radius = width * (0.88 - index * 0.12);
    appendPlate(
      buffers,
      placement,
      `plating:plate:${index}`,
      direction * width * index * 0.08,
      height * (0.13 + level * 0.22),
      -direction * width * index * 0.045,
      radius,
      radius * (0.7 + stableUnit(placement.seed, `plating-depth:${index}`) * 0.14),
      Math.max(0.018, width * 0.07),
      (stableUnit(placement.seed, `plating-tilt-x:${index}`) - 0.5) * 0.1,
      (stableUnit(placement.seed, `plating-tilt-z:${index}`) - 0.5) * 0.1,
    );
  }
}

function appendEncrustingColony(
  buffers: GeometryBuffers,
  placement: CanopyPlacement,
  width: number,
  height: number,
): void {
  const phase = stableUnit(placement.seed, 'micro-phase') * Math.PI * 2;
  for (let index = 0; index < 5; index += 1) {
    const center = index === 0 ? 0 : width * (0.35 + index * 0.055);
    const angle = phase + index / 5 * Math.PI * 2;
    const radius = width * (index === 0 ? 0.34 : 0.2);
    appendFacetedLobe(
      buffers,
      placement,
      `micro:polyp:${index}`,
      Math.cos(angle) * center,
      0,
      Math.sin(angle) * center,
      radius,
      height * (index === 0 ? 1 : 0.62 + stableUnit(placement.seed, `micro-height:${index}`) * 0.18),
      radius,
      6,
    );
  }
}

function appendSoftCoral(
  buffers: GeometryBuffers,
  placement: CanopyPlacement,
  width: number,
  height: number,
): void {
  appendFacetedLobe(
    buffers,
    placement,
    'soft:foot',
    0,
    0,
    0,
    width * 0.46,
    Math.max(0.08, height * 0.16),
    width * 0.4,
  );
  const phase = stableUnit(placement.seed, 'soft-phase') * Math.PI * 2;
  for (let index = 0; index < 6; index += 1) {
    const angle = phase + index / 6 * Math.PI * 2;
    const startRadius = width * (index === 0 ? 0 : 0.13);
    const lean = width * (0.24 + stableUnit(placement.seed, `soft-lean:${index}`) * 0.2);
    appendTaperedBranch(
      buffers,
      placement,
      `soft:lobe:${index}`,
      {
        x: Math.cos(angle) * startRadius,
        y: height * 0.08,
        z: Math.sin(angle) * startRadius,
      },
      {
        x: Math.cos(angle + 0.16) * lean,
        y: height * (0.62 + stableUnit(placement.seed, `soft-height:${index}`) * 0.34),
        z: Math.sin(angle + 0.16) * lean,
      },
      Math.max(0.026, width * 0.15),
      Math.max(0.014, width * 0.075),
    );
  }
}

function appendFanMembrane(
  buffers: GeometryBuffers,
  placement: CanopyPlacement,
  width: number,
  height: number,
): LocalPoint[] {
  const arcCount = 7;
  const thickness = Math.max(0.012, width * 0.035);
  const root: LocalPoint = { x: 0, y: height * 0.04, z: 0 };
  const arc = Array.from({ length: arcCount }, (_value, index): LocalPoint => {
    const t = index / (arcCount - 1);
    const angle = -1.12 + t * 2.24;
    return {
      x: Math.sin(angle) * width,
      y: height * (0.2 + Math.cos(angle) * 0.8),
      z: (stableUnit(placement.seed, `fan-edge:${index}`) - 0.5) * thickness * 0.45,
    };
  });
  const frontRoot = worldPoint(placement, { ...root, z: thickness * 0.5 });
  const backRoot = worldPoint(placement, { ...root, z: -thickness * 0.5 });
  const front = arc.map((point) => worldPoint(placement, {
    ...point,
    z: point.z + thickness * 0.5,
  }));
  const back = arc.map((point) => worldPoint(placement, {
    ...point,
    z: point.z - thickness * 0.5,
  }));

  for (let index = 0; index < arc.length - 1; index += 1) {
    appendTriangle(
      buffers,
      frontRoot,
      front[index]!,
      front[index + 1]!,
      placement.palette.root,
      placement.palette.tip,
      placement.palette.tip,
    );
    appendTriangle(
      buffers,
      backRoot,
      back[index + 1]!,
      back[index]!,
      placement.palette.root,
      placement.palette.tip,
      placement.palette.tip,
    );
    appendTriangle(
      buffers,
      front[index]!,
      back[index]!,
      back[index + 1]!,
      placement.palette.body,
    );
    appendTriangle(
      buffers,
      front[index]!,
      back[index + 1]!,
      front[index + 1]!,
      placement.palette.body,
    );
  }
  appendTriangle(
    buffers,
    frontRoot,
    back[0]!,
    front[0]!,
    placement.palette.root,
  );
  appendTriangle(
    buffers,
    frontRoot,
    backRoot,
    back[0]!,
    placement.palette.root,
  );
  const last = arc.length - 1;
  appendTriangle(
    buffers,
    frontRoot,
    front[last]!,
    back[last]!,
    placement.palette.root,
  );
  appendTriangle(
    buffers,
    frontRoot,
    back[last]!,
    backRoot,
    placement.palette.root,
  );
  return arc;
}

function appendSeaFan(
  buffers: GeometryBuffers,
  placement: CanopyPlacement,
  width: number,
  height: number,
): void {
  appendFacetedLobe(
    buffers,
    placement,
    'fan:foot',
    0,
    0,
    0,
    width * 0.24,
    Math.max(0.07, height * 0.12),
    width * 0.2,
  );
  const arc = appendFanMembrane(buffers, placement, width, height);
  for (const index of [0, 2, 4, 6]) {
    const end = arc[index];
    if (!end) continue;
    appendTaperedBranch(
      buffers,
      placement,
      `fan:rib:${index}`,
      { x: 0, y: height * 0.035, z: 0 },
      end,
      Math.max(0.012, width * 0.045),
      Math.max(0.005, width * 0.018),
    );
  }
}

function appendColony(
  buffers: GeometryBuffers,
  colony: ReefLivingCanopyColony,
  slot: ReefAllocatedSurfaceSlot,
): void {
  const emphasisScale = colony.emphasized ? 1.1 : 1;
  const maturityScale = 0.82 + colony.maturity * 0.22 + colony.weight * 0.08;
  const micro = colony.tier === 'micro';
  const width = micro
    ? clamp(colony.footprintRadius * 0.92, 0.065, 0.145)
    : clamp(colony.footprintRadius * 0.88 * maturityScale * emphasisScale, 0.18, 0.54);
  const height = micro
    ? clamp(colony.targetHeight * 0.82, 0.055, 0.13)
    : clamp(colony.targetHeight * (0.96 + colony.maturity * 0.18) * emphasisScale, 0.24, 0.92);
  const placement: CanopyPlacement = {
    root: {
      x: slot.position.x,
      y: slot.position.y + (micro ? 0.006 : 0.012),
      z: slot.position.z,
    },
    yaw: colony.facingRad + REEF_OBJECT_ROTATION[1]
      + (stableUnit(colony.seed, 'canopy-facing') - 0.5) * 0.18,
    seed: colony.seed,
    palette: paletteFor(colony.morphotype, colony.seed),
  };

  if (colony.morphotype === 'massive') {
    appendMassiveColony(buffers, placement, width, height * 0.78);
  } else if (colony.morphotype === 'branching') {
    appendBranchingColony(buffers, placement, width, height);
  } else if (colony.morphotype === 'plating') {
    appendPlatingColony(buffers, placement, width, height * 0.78);
  } else if (colony.morphotype === 'encrusting') {
    appendEncrustingColony(buffers, placement, width, height);
  } else if (colony.morphotype === 'soft-coral') {
    appendSoftCoral(buffers, placement, width, height);
  } else {
    appendSeaFan(buffers, placement, width, height);
  }
}

/** Builds one static, vertex-coloured mesh around the accepted living ranges. */
export function buildReefLivingCanopyGeometry({
  plan,
  slots,
}: {
  plan: ReefLivingCanopyPlan;
  slots: readonly ReefAllocatedSurfaceSlot[];
}): BufferGeometry {
  const buffers: GeometryBuffers = { positions: [], colors: [] };
  const slotByRequestId = new Map(slots.map((slot) => [slot.requestId, slot] as const));
  const renderedCounts = emptyMorphotypeCounts();
  let allocatedColonyCount = 0;

  for (const colony of plan.colonies) {
    const slot = slotByRequestId.get(colony.request.id);
    if (!slot) continue;
    appendColony(buffers, colony, slot);
    renderedCounts[colony.morphotype] += 1;
    allocatedColonyCount += 1;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(buffers.positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(buffers.colors, 3));
  if (buffers.positions.length > 0) {
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  }

  const vertexCount = buffers.positions.length / 3;
  const triangleCount = vertexCount / 3;
  const metrics: ReefLivingCanopyGeometryMetrics = {
    sourceColonyCount: plan.colonies.length,
    allocatedColonyCount,
    unresolvedColonyCount: plan.colonies.length - allocatedColonyCount,
    morphotypeCounts: renderedCounts,
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
  return geometry;
}
