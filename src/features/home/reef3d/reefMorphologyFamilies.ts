import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Vector3,
} from 'three';
import type {
  ReefColonyMorphotype,
  ReefLayoutVec3,
} from '@/engine/species/reef';
import {
  REEF_LIVING_CANOPY_BUDGET,
  type ReefLivingCanopyColony,
  type ReefLivingCanopyPlan,
} from './reefLivingCanopy';
import { REEF_OBJECT_ROTATION } from './reefObjectTransform';
import type { ReefAllocatedSurfaceSlot } from './reefSurfaceSlots';

export const REEF_MORPHOLOGY_FAMILIES_VERSION = 'reef-morphology-families-v1';
export const REEF_MORPHOLOGY_FAMILIES_PASS = 'distinct-mature-families-with-hierarchy';

export interface ReefMorphologyFamiliesMetrics {
  sourceColonyCount: number;
  allocatedColonyCount: number;
  unresolvedColonyCount: number;
  dominantColonyCount: number;
  morphotypeCounts: Record<ReefColonyMorphotype, number>;
  vertexCount: number;
  triangleCount: number;
  drawCalls: 0 | 1;
  budgetExceeded: boolean;
}

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

interface MorphologyPalette {
  root: ColorTuple;
  body: ColorTuple;
  tip: ColorTuple;
}

interface MorphologyPlacement {
  root: ReefLayoutVec3;
  yaw: number;
  seed: number;
  palette: MorphologyPalette;
}

interface MorphologyScale {
  width: number;
  height: number;
  prominence: number;
  dominant: boolean;
}

const TAU = Math.PI * 2;

const PALETTES: Readonly<Record<ReefColonyMorphotype, MorphologyPalette>> = Object.freeze({
  branching: {
    root: colorTuple('#80384a'),
    body: colorTuple('#ce586e'),
    tip: colorTuple('#ffb7a6'),
  },
  massive: {
    root: colorTuple('#83493d'),
    body: colorTuple('#cb6e57'),
    tip: colorTuple('#f4ad82'),
  },
  plating: {
    root: colorTuple('#626f42'),
    body: colorTuple('#9eaf5f'),
    tip: colorTuple('#dcd483'),
  },
  encrusting: {
    root: colorTuple('#733650'),
    body: colorTuple('#ba5878'),
    tip: colorTuple('#e895aa'),
  },
  'soft-coral': {
    root: colorTuple('#53407f'),
    body: colorTuple('#8c66b7'),
    tip: colorTuple('#cfa4da'),
  },
  'sea-fan': {
    root: colorTuple('#314780'),
    body: colorTuple('#5c71ad'),
    tip: colorTuple('#9bc8dc'),
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

function paletteFor(morphotype: ReefColonyMorphotype, seed: number): MorphologyPalette {
  const source = PALETTES[morphotype];
  const variation = 0.91 + stableUnit(seed, 'morphology:palette') * 0.15;
  return {
    root: shadeColor(source.root, variation * 0.9),
    body: shadeColor(source.body, variation),
    tip: shadeColor(source.tip, Math.min(1.08, variation * 1.04)),
  };
}

/**
 * Stable renderer-only hierarchy. It depends only on immutable colony identity
 * facts, so adding future portal events cannot demote or resize an older colony.
 */
export function reefMorphologyProminence(colony: ReefLivingCanopyColony): number {
  if (colony.emphasized) return 1;
  const identity = stableUnit(colony.seed, 'morphology:prominence');
  return clamp(identity * (0.94 + colony.maturity * 0.06), 0, 0.965);
}

function morphologyScale(colony: ReefLivingCanopyColony): MorphologyScale {
  const prominence = reefMorphologyProminence(colony);
  const dominant = prominence >= 0.94;
  const secondary = prominence >= 0.68;
  const hierarchyScale = dominant ? 1.48 : secondary ? 1.16 : 0.92;
  const maturityScale = 0.86 + colony.maturity * 0.18 + colony.weight * 0.06;
  const footprint = Math.max(0.06, colony.footprintRadius);
  const targetHeight = Math.max(0.05, colony.targetHeight);

  switch (colony.morphotype) {
    case 'branching':
      return {
        width: clamp(footprint * 1.14 * maturityScale * hierarchyScale, 0.24, 0.88),
        height: clamp(targetHeight * 1.18 * hierarchyScale, 0.38, 1.28),
        prominence,
        dominant,
      };
    case 'massive': {
      const width = clamp(footprint * 1.42 * maturityScale * hierarchyScale, 0.31, 1.02);
      return {
        width,
        height: clamp(Math.min(targetHeight * 0.62 * hierarchyScale, width * 0.7), 0.2, 0.68),
        prominence,
        dominant,
      };
    }
    case 'plating':
      return {
        width: clamp(footprint * 1.58 * maturityScale * hierarchyScale, 0.34, 1.08),
        height: clamp(targetHeight * 0.7 * hierarchyScale, 0.22, 0.7),
        prominence,
        dominant,
      };
    case 'encrusting':
      return {
        width: clamp(footprint * 1.72 * maturityScale * (dominant ? 1.2 : 1), 0.15, 0.5),
        height: clamp(targetHeight * 0.34, 0.038, 0.115),
        prominence,
        dominant,
      };
    case 'soft-coral':
      return {
        width: clamp(footprint * 1.02 * maturityScale * (dominant ? 1.22 : 1), 0.19, 0.62),
        height: clamp(targetHeight * 1.02 * (dominant ? 1.2 : 1), 0.28, 0.94),
        prominence,
        dominant,
      };
    case 'sea-fan':
      return {
        width: clamp(footprint * 1.32 * maturityScale * (dominant ? 1.24 : 1), 0.26, 0.78),
        height: clamp(targetHeight * 1.04 * (dominant ? 1.18 : 1), 0.3, 1.02),
        prominence,
        dominant,
      };
  }
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

function worldPoint(placement: MorphologyPlacement, point: LocalPoint): ReefLayoutVec3 {
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
  placement: MorphologyPlacement,
  label: string,
  centerX: number,
  baseY: number,
  centerZ: number,
  radiusX: number,
  height: number,
  radiusZ: number,
  sides = 6,
): void {
  const phase = stableUnit(placement.seed, `${label}:phase`) * TAU;
  const bottom = worldPoint(placement, { x: centerX, y: baseY, z: centerZ });
  const top = worldPoint(placement, {
    x: centerX + (stableUnit(placement.seed, `${label}:top-x`) - 0.5) * radiusX * 0.16,
    y: baseY + height,
    z: centerZ + (stableUnit(placement.seed, `${label}:top-z`) - 0.5) * radiusZ * 0.16,
  });
  const ring = Array.from({ length: sides }, (_value, index) => {
    const angle = phase + index / sides * TAU;
    const irregularity = 0.84 + stableUnit(placement.seed, `${label}:edge:${index}`) * 0.3;
    return worldPoint(placement, {
      x: centerX + Math.cos(angle) * radiusX * irregularity,
      y: baseY + height * (0.32 + stableUnit(placement.seed, `${label}:ring-y:${index}`) * 0.13),
      z: centerZ + Math.sin(angle) * radiusZ * irregularity,
    });
  });

  for (let index = 0; index < sides; index += 1) {
    const next = (index + 1) % sides;
    appendTriangle(buffers, bottom, ring[next]!, ring[index]!, placement.palette.root, placement.palette.body, placement.palette.body);
    appendTriangle(buffers, top, ring[index]!, ring[next]!, placement.palette.tip, placement.palette.body, placement.palette.body);
  }
}

function appendDome(
  buffers: GeometryBuffers,
  placement: MorphologyPlacement,
  label: string,
  centerX: number,
  baseY: number,
  centerZ: number,
  radiusX: number,
  height: number,
  radiusZ: number,
  sides: number,
): void {
  const phase = stableUnit(placement.seed, `${label}:phase`) * TAU;
  const bottomCenter = worldPoint(placement, { x: centerX, y: baseY, z: centerZ });
  const top = worldPoint(placement, {
    x: centerX + (stableUnit(placement.seed, `${label}:top-x`) - 0.5) * radiusX * 0.12,
    y: baseY + height,
    z: centerZ + (stableUnit(placement.seed, `${label}:top-z`) - 0.5) * radiusZ * 0.12,
  });
  const lower: ReefLayoutVec3[] = [];
  const shoulder: ReefLayoutVec3[] = [];

  for (let index = 0; index < sides; index += 1) {
    const angle = phase + index / sides * TAU;
    const edge = 0.9 + stableUnit(placement.seed, `${label}:edge:${index}`) * 0.2;
    const shoulderScale = 0.68 + stableUnit(placement.seed, `${label}:shoulder:${index}`) * 0.12;
    lower.push(worldPoint(placement, {
      x: centerX + Math.cos(angle) * radiusX * edge,
      y: baseY + height * (0.14 + stableUnit(placement.seed, `${label}:lower-y:${index}`) * 0.08),
      z: centerZ + Math.sin(angle) * radiusZ * edge,
    }));
    shoulder.push(worldPoint(placement, {
      x: centerX + Math.cos(angle) * radiusX * edge * shoulderScale,
      y: baseY + height * (0.6 + stableUnit(placement.seed, `${label}:shoulder-y:${index}`) * 0.1),
      z: centerZ + Math.sin(angle) * radiusZ * edge * shoulderScale,
    }));
  }

  for (let index = 0; index < sides; index += 1) {
    const next = (index + 1) % sides;
    appendTriangle(buffers, bottomCenter, lower[next]!, lower[index]!, placement.palette.root, placement.palette.root, placement.palette.root);
    appendTriangle(buffers, lower[index]!, lower[next]!, shoulder[next]!, placement.palette.root, placement.palette.body, placement.palette.body);
    appendTriangle(buffers, lower[index]!, shoulder[next]!, shoulder[index]!, placement.palette.root, placement.palette.body, placement.palette.body);
    appendTriangle(buffers, top, shoulder[index]!, shoulder[next]!, placement.palette.tip, placement.palette.body, placement.palette.body);
  }
}

function appendPlate(
  buffers: GeometryBuffers,
  placement: MorphologyPlacement,
  label: string,
  centerX: number,
  baseY: number,
  centerZ: number,
  radiusX: number,
  radiusZ: number,
  thickness: number,
  tiltX: number,
  tiltZ: number,
  sides: number,
): void {
  const phase = stableUnit(placement.seed, `${label}:phase`) * TAU;
  const topCenter = worldPoint(placement, { x: centerX, y: baseY + thickness, z: centerZ });
  const bottomCenter = worldPoint(placement, { x: centerX, y: baseY, z: centerZ });
  const topRing: ReefLayoutVec3[] = [];
  const bottomRing: ReefLayoutVec3[] = [];

  for (let index = 0; index < sides; index += 1) {
    const angle = phase + index / sides * TAU;
    const scallop = 0.8 + stableUnit(placement.seed, `${label}:rim:${index}`) * 0.34;
    const x = Math.cos(angle) * radiusX * scallop;
    const z = Math.sin(angle) * radiusZ * scallop;
    const rimWave = (stableUnit(placement.seed, `${label}:rim-y:${index}`) - 0.5) * thickness * 0.9;
    const tilt = x * tiltX + z * tiltZ + rimWave;
    topRing.push(worldPoint(placement, { x: centerX + x, y: baseY + thickness + tilt, z: centerZ + z }));
    bottomRing.push(worldPoint(placement, { x: centerX + x, y: baseY + tilt, z: centerZ + z }));
  }

  for (let index = 0; index < sides; index += 1) {
    const next = (index + 1) % sides;
    const edgeColor = index % 3 === 0 ? placement.palette.tip : placement.palette.body;
    appendTriangle(buffers, topCenter, topRing[index]!, topRing[next]!, placement.palette.body, edgeColor, edgeColor);
    appendTriangle(buffers, bottomCenter, bottomRing[next]!, bottomRing[index]!, placement.palette.root);
    appendTriangle(buffers, topRing[index]!, bottomRing[index]!, bottomRing[next]!, edgeColor, placement.palette.root, placement.palette.root);
    appendTriangle(buffers, topRing[index]!, bottomRing[next]!, topRing[next]!, edgeColor, placement.palette.root, edgeColor);
  }
}

function appendTaperedBranch(
  buffers: GeometryBuffers,
  placement: MorphologyPlacement,
  label: string,
  start: LocalPoint,
  end: LocalPoint,
  radiusStart: number,
  radiusEnd: number,
  sides: number,
): void {
  const startVector = new Vector3(start.x, start.y, start.z);
  const endVector = new Vector3(end.x, end.y, end.z);
  const direction = endVector.clone().sub(startVector);
  if (direction.lengthSq() <= 1e-8) return;
  direction.normalize();
  const helper = Math.abs(direction.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0);
  const axisA = new Vector3().crossVectors(direction, helper).normalize();
  const axisB = new Vector3().crossVectors(direction, axisA).normalize();
  const phase = stableUnit(placement.seed, `${label}:phase`) * TAU;
  const startRing: ReefLayoutVec3[] = [];
  const endRing: ReefLayoutVec3[] = [];

  for (let side = 0; side < sides; side += 1) {
    const angle = phase + side / sides * TAU;
    const radial = axisA.clone().multiplyScalar(Math.cos(angle)).addScaledVector(axisB, Math.sin(angle));
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
    appendTriangle(buffers, startRing[side]!, endRing[next]!, endRing[side]!, placement.palette.root, placement.palette.tip, placement.palette.tip);
    appendTriangle(buffers, startRing[side]!, startRing[next]!, endRing[next]!, placement.palette.root, placement.palette.root, placement.palette.tip);
    appendTriangle(buffers, startCenter, startRing[next]!, startRing[side]!, placement.palette.root);
    appendTriangle(buffers, endCenter, endRing[side]!, endRing[next]!, placement.palette.tip);
  }
}

function appendBranchingColony(
  buffers: GeometryBuffers,
  placement: MorphologyPlacement,
  scale: MorphologyScale,
): void {
  const { width, height } = scale;
  appendFacetedLobe(buffers, placement, 'branching:foot', 0, 0, 0, width * 0.34, height * 0.11, width * 0.3, 6);

  appendTaperedBranch(
    buffers,
    placement,
    'branching:trunk',
    { x: 0, y: height * 0.05, z: 0 },
    {
      x: (stableUnit(placement.seed, 'branching:trunk-x') - 0.5) * width * 0.12,
      y: height * 0.92,
      z: (stableUnit(placement.seed, 'branching:trunk-z') - 0.5) * width * 0.12,
    },
    width * 0.095,
    width * 0.032,
    4,
  );

  const phase = stableUnit(placement.seed, 'branching:phase') * TAU;
  for (let index = 0; index < 3; index += 1) {
    const angle = phase + index / 3 * TAU + (stableUnit(placement.seed, `branching:angle:${index}`) - 0.5) * 0.42;
    const startY = height * (0.18 + index * 0.12);
    const elbowRadius = width * (0.28 + stableUnit(placement.seed, `branching:elbow:${index}`) * 0.12);
    const elbow: LocalPoint = {
      x: Math.cos(angle) * elbowRadius,
      y: height * (0.5 + stableUnit(placement.seed, `branching:elbow-y:${index}`) * 0.13),
      z: Math.sin(angle) * elbowRadius,
    };
    const endAngle = angle + (stableUnit(placement.seed, `branching:fork-angle:${index}`) - 0.5) * 0.72;
    const endRadius = width * (0.5 + stableUnit(placement.seed, `branching:end:${index}`) * 0.2);
    const end: LocalPoint = {
      x: Math.cos(endAngle) * endRadius,
      y: height * (0.72 + stableUnit(placement.seed, `branching:end-y:${index}`) * 0.22),
      z: Math.sin(endAngle) * endRadius,
    };

    appendTaperedBranch(
      buffers,
      placement,
      `branching:arm:${index}`,
      { x: 0, y: startY, z: 0 },
      elbow,
      width * 0.075,
      width * 0.047,
      4,
    );
    appendTaperedBranch(
      buffers,
      placement,
      `branching:fork:${index}`,
      elbow,
      end,
      width * 0.046,
      width * 0.018,
      4,
    );
  }
}

function appendMassiveColony(
  buffers: GeometryBuffers,
  placement: MorphologyPlacement,
  scale: MorphologyScale,
): void {
  const { width, height } = scale;
  appendDome(buffers, placement, 'massive:core', 0, 0, 0, width * 0.58, height, width * 0.52, 7);
  const phase = stableUnit(placement.seed, 'massive:phase') * TAU;
  for (let index = 0; index < 3; index += 1) {
    const angle = phase + index / 3 * TAU + (stableUnit(placement.seed, `massive:angle:${index}`) - 0.5) * 0.35;
    const offset = width * (0.28 + stableUnit(placement.seed, `massive:offset:${index}`) * 0.08);
    const radius = width * (0.27 + stableUnit(placement.seed, `massive:radius:${index}`) * 0.05);
    appendDome(
      buffers,
      placement,
      `massive:lobe:${index}`,
      Math.cos(angle) * offset,
      0,
      Math.sin(angle) * offset,
      radius,
      height * (0.56 + stableUnit(placement.seed, `massive:height:${index}`) * 0.17),
      radius * (0.82 + stableUnit(placement.seed, `massive:depth:${index}`) * 0.12),
      5,
    );
  }
}

function appendPlatingColony(
  buffers: GeometryBuffers,
  placement: MorphologyPlacement,
  scale: MorphologyScale,
): void {
  const { width, height } = scale;
  appendDome(buffers, placement, 'plating:foot', 0, 0, 0, width * 0.2, height * 0.18, width * 0.17, 5);
  appendTaperedBranch(
    buffers,
    placement,
    'plating:pedestal',
    { x: 0, y: height * 0.05, z: 0 },
    {
      x: (stableUnit(placement.seed, 'plating:pedestal-x') - 0.5) * width * 0.12,
      y: height * 0.52,
      z: (stableUnit(placement.seed, 'plating:pedestal-z') - 0.5) * width * 0.12,
    },
    width * 0.08,
    width * 0.045,
    4,
  );
  appendPlate(
    buffers,
    placement,
    'plating:table',
    width * 0.04,
    height * 0.5,
    -width * 0.02,
    width * 0.78,
    width * 0.58,
    Math.max(0.018, width * 0.055),
    (stableUnit(placement.seed, 'plating:tilt-x') - 0.5) * 0.08,
    (stableUnit(placement.seed, 'plating:tilt-z') - 0.5) * 0.08,
    10,
  );
  appendPlate(
    buffers,
    placement,
    'plating:secondary',
    -width * 0.18,
    height * 0.27,
    width * 0.09,
    width * 0.46,
    width * 0.34,
    Math.max(0.014, width * 0.04),
    (stableUnit(placement.seed, 'plating:lower-tilt-x') - 0.5) * 0.1,
    (stableUnit(placement.seed, 'plating:lower-tilt-z') - 0.5) * 0.1,
    8,
  );
}

function appendEncrustingColony(
  buffers: GeometryBuffers,
  placement: MorphologyPlacement,
  scale: MorphologyScale,
): void {
  const { width, height } = scale;
  const angle = stableUnit(placement.seed, 'encrusting:offset-angle') * TAU;
  appendPlate(
    buffers,
    placement,
    'encrusting:mat-a',
    0,
    0.004,
    0,
    width * 0.72,
    width * 0.5,
    Math.max(0.012, height * 0.26),
    (stableUnit(placement.seed, 'encrusting:tilt-x') - 0.5) * 0.035,
    (stableUnit(placement.seed, 'encrusting:tilt-z') - 0.5) * 0.035,
    7,
  );
  appendPlate(
    buffers,
    placement,
    'encrusting:mat-b',
    Math.cos(angle) * width * 0.24,
    0.009,
    Math.sin(angle) * width * 0.2,
    width * 0.45,
    width * 0.34,
    Math.max(0.01, height * 0.2),
    (stableUnit(placement.seed, 'encrusting:tilt-bx') - 0.5) * 0.04,
    (stableUnit(placement.seed, 'encrusting:tilt-bz') - 0.5) * 0.04,
    6,
  );
  appendDome(
    buffers,
    placement,
    'encrusting:old-growth-knob',
    -Math.cos(angle) * width * 0.18,
    0,
    -Math.sin(angle) * width * 0.16,
    width * 0.18,
    height,
    width * 0.15,
    5,
  );
}

function appendSoftCoral(
  buffers: GeometryBuffers,
  placement: MorphologyPlacement,
  scale: MorphologyScale,
): void {
  const { width, height } = scale;
  appendFacetedLobe(buffers, placement, 'soft:foot', 0, 0, 0, width * 0.42, height * 0.13, width * 0.36, 6);
  const phase = stableUnit(placement.seed, 'soft:phase') * TAU;
  for (let index = 0; index < 5; index += 1) {
    const angle = phase + index / 5 * TAU;
    const startRadius = index === 0 ? 0 : width * 0.1;
    const endRadius = width * (0.22 + stableUnit(placement.seed, `soft:end:${index}`) * 0.18);
    appendTaperedBranch(
      buffers,
      placement,
      `soft:lobe:${index}`,
      { x: Math.cos(angle) * startRadius, y: height * 0.06, z: Math.sin(angle) * startRadius },
      {
        x: Math.cos(angle + 0.12) * endRadius,
        y: height * (0.62 + stableUnit(placement.seed, `soft:height:${index}`) * 0.3),
        z: Math.sin(angle + 0.12) * endRadius,
      },
      width * 0.13,
      width * 0.065,
      5,
    );
  }
}

function appendSeaFan(
  buffers: GeometryBuffers,
  placement: MorphologyPlacement,
  scale: MorphologyScale,
): void {
  const { width, height } = scale;
  appendFacetedLobe(buffers, placement, 'fan:foot', 0, 0, 0, width * 0.2, height * 0.1, width * 0.17, 6);
  const arcCount = 6;
  const thickness = Math.max(0.012, width * 0.032);
  const root: LocalPoint = { x: 0, y: height * 0.05, z: 0 };
  const arc = Array.from({ length: arcCount }, (_value, index): LocalPoint => {
    const t = index / (arcCount - 1);
    const angle = -1.08 + t * 2.16;
    return {
      x: Math.sin(angle) * width,
      y: height * (0.18 + Math.cos(angle) * 0.8),
      z: (stableUnit(placement.seed, `fan:edge:${index}`) - 0.5) * thickness * 0.42,
    };
  });
  const frontRoot = worldPoint(placement, { ...root, z: thickness * 0.5 });
  const backRoot = worldPoint(placement, { ...root, z: -thickness * 0.5 });
  const front = arc.map((point) => worldPoint(placement, { ...point, z: point.z + thickness * 0.5 }));
  const back = arc.map((point) => worldPoint(placement, { ...point, z: point.z - thickness * 0.5 }));

  for (let index = 0; index < arc.length - 1; index += 1) {
    appendTriangle(buffers, frontRoot, front[index]!, front[index + 1]!, placement.palette.root, placement.palette.tip, placement.palette.tip);
    appendTriangle(buffers, backRoot, back[index + 1]!, back[index]!, placement.palette.root, placement.palette.tip, placement.palette.tip);
    appendTriangle(buffers, front[index]!, back[index]!, back[index + 1]!, placement.palette.body);
    appendTriangle(buffers, front[index]!, back[index + 1]!, front[index + 1]!, placement.palette.body);
  }
  appendTriangle(buffers, frontRoot, back[0]!, front[0]!, placement.palette.root);
  appendTriangle(buffers, frontRoot, backRoot, back[0]!, placement.palette.root);
  const last = arc.length - 1;
  appendTriangle(buffers, frontRoot, front[last]!, back[last]!, placement.palette.root);
  appendTriangle(buffers, frontRoot, back[last]!, backRoot, placement.palette.root);

  for (const index of [0, 2, 5]) {
    const end = arc[index];
    if (!end) continue;
    appendTaperedBranch(
      buffers,
      placement,
      `fan:rib:${index}`,
      root,
      end,
      width * 0.04,
      width * 0.016,
      5,
    );
  }
}

function appendColony(
  buffers: GeometryBuffers,
  colony: ReefLivingCanopyColony,
  slot: ReefAllocatedSurfaceSlot,
): boolean {
  const scale = morphologyScale(colony);
  const rootLift = colony.morphotype === 'encrusting' ? 0.004 : 0.01;
  const placement: MorphologyPlacement = {
    root: {
      x: slot.position.x,
      y: slot.position.y + rootLift,
      z: slot.position.z,
    },
    yaw: colony.facingRad + REEF_OBJECT_ROTATION[1]
      + (stableUnit(colony.seed, 'morphology:facing') - 0.5) * 0.34,
    seed: colony.seed,
    palette: paletteFor(colony.morphotype, colony.seed),
  };

  switch (colony.morphotype) {
    case 'branching':
      appendBranchingColony(buffers, placement, scale);
      break;
    case 'massive':
      appendMassiveColony(buffers, placement, scale);
      break;
    case 'plating':
      appendPlatingColony(buffers, placement, scale);
      break;
    case 'encrusting':
      appendEncrustingColony(buffers, placement, scale);
      break;
    case 'soft-coral':
      appendSoftCoral(buffers, placement, scale);
      break;
    case 'sea-fan':
      appendSeaFan(buffers, placement, scale);
      break;
  }
  return scale.dominant;
}

/**
 * Stage 3 production geometry: one draw call, but six unmistakably different
 * colony habits. Four reef-building families carry the strongest silhouette;
 * soft coral and sea fan remain supporting biodiversity rather than placeholders.
 */
export function buildReefMorphologyFamiliesGeometry({
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
  let dominantColonyCount = 0;

  for (const colony of plan.colonies) {
    const slot = slotByRequestId.get(colony.request.id);
    if (!slot) continue;
    if (appendColony(buffers, colony, slot)) dominantColonyCount += 1;
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
  const metrics: ReefMorphologyFamiliesMetrics = {
    sourceColonyCount: plan.colonies.length,
    allocatedColonyCount,
    unresolvedColonyCount: plan.colonies.length - allocatedColonyCount,
    dominantColonyCount,
    morphotypeCounts: renderedCounts,
    vertexCount,
    triangleCount,
    drawCalls: vertexCount > 0 ? 1 : 0,
    budgetExceeded: plan.colonies.length > REEF_LIVING_CANOPY_BUDGET.maximumColonies
      || vertexCount > REEF_LIVING_CANOPY_BUDGET.maximumVertices
      || triangleCount > REEF_LIVING_CANOPY_BUDGET.maximumTriangles,
  };

  geometry.userData.reefMorphologyFamiliesVersion = REEF_MORPHOLOGY_FAMILIES_VERSION;
  geometry.userData.reefMorphologyFamiliesPass = REEF_MORPHOLOGY_FAMILIES_PASS;
  geometry.userData.reefMorphologyFamiliesMetrics = metrics;
  geometry.userData.reefLivingCanopyDrawCalls = metrics.drawCalls;
  return geometry;
}
