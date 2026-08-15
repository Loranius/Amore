import {
  BufferGeometry,
  CatmullRomCurve3,
  Float32BufferAttribute,
  Vector3,
} from 'three';
import type { ReefGrowthArchPlacement } from '@/engine/species/reef';
import {
  reefArchFootPoints,
} from './reefLimestoneArch';
import {
  sampleReefTerracedFoundation,
  type ReefTerracedFoundationProfile,
} from './reefTerracedFoundation';

export const REEF_ARCH_COLUMN_VISUAL_VERSION = 'reef-arch-column-visual-v1';
export const REEF_ARCH_COLUMN_VISUAL_PASS = 'continuous-grounded-limestone-portal-arch';

const TAU = Math.PI * 2;
const RADIAL_SEGMENTS = 7;
const PILLAR_SEGMENTS = 6;
const CROWN_SEGMENTS = 14;

type Point = Readonly<{ x: number; y: number; z: number }>;

type GeometryBuffers = {
  positions: number[];
  uvs: number[];
};

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

function appendTriangle(
  buffers: GeometryBuffers,
  first: Point,
  second: Point,
  third: Point,
  uvScale: number,
): void {
  for (const point of [first, second, third]) {
    buffers.positions.push(point.x, point.y, point.z);
    buffers.uvs.push(
      0.5 + point.x * uvScale + point.z * uvScale * 0.22,
      point.y * uvScale * 0.78 + point.z * uvScale * 0.08,
    );
  }
}

function appendSweep({
  buffers,
  curve,
  segmentCount,
  seed,
  label,
  radiusAt,
  depthScaleAt,
  uvScale,
}: {
  buffers: GeometryBuffers;
  curve: CatmullRomCurve3;
  segmentCount: number;
  seed: number;
  label: string;
  radiusAt: (progress: number) => number;
  depthScaleAt: (progress: number) => number;
  uvScale: number;
}): void {
  const centers = curve.getSpacedPoints(segmentCount);
  const frames = curve.computeFrenetFrames(segmentCount, false);
  const rings: Vector3[][] = [];
  const phase = stableUnit(seed, `${label}:facet-phase`) * TAU / RADIAL_SEGMENTS;

  for (let segment = 0; segment <= segmentCount; segment += 1) {
    const progress = segment / segmentCount;
    const center = centers[segment]!;
    const normal = frames.normals[segment]!;
    const binormal = frames.binormals[segment]!;
    const radius = radiusAt(progress);
    const depthScale = depthScaleAt(progress);
    const ring: Vector3[] = [];

    for (let radial = 0; radial < RADIAL_SEGMENTS; radial += 1) {
      const angle = phase + radial / RADIAL_SEGMENTS * TAU;
      const weather = 0.9
        + stableUnit(seed, `${label}:weather:${segment}:${radial}`) * 0.18;
      const broadChip = radial === ((segment + Math.floor(seed % RADIAL_SEGMENTS)) % RADIAL_SEGMENTS)
        ? 0.9
        : 1;
      ring.push(
        center.clone()
          .addScaledVector(
            normal,
            Math.cos(angle) * radius * weather * broadChip,
          )
          .addScaledVector(
            binormal,
            Math.sin(angle) * radius * depthScale * weather,
          ),
      );
    }
    rings.push(ring);
  }

  for (let segment = 0; segment < segmentCount; segment += 1) {
    const current = rings[segment]!;
    const next = rings[segment + 1]!;
    for (let radial = 0; radial < RADIAL_SEGMENTS; radial += 1) {
      const nextRadial = (radial + 1) % RADIAL_SEGMENTS;
      appendTriangle(
        buffers,
        current[radial]!,
        current[nextRadial]!,
        next[radial]!,
        uvScale,
      );
      appendTriangle(
        buffers,
        current[nextRadial]!,
        next[nextRadial]!,
        next[radial]!,
        uvScale,
      );
    }
  }

  const firstRing = rings[0]!;
  const lastRing = rings[segmentCount]!;
  const firstCenter = centers[0]!;
  const lastCenter = centers[segmentCount]!;
  for (let radial = 0; radial < RADIAL_SEGMENTS; radial += 1) {
    const nextRadial = (radial + 1) % RADIAL_SEGMENTS;
    appendTriangle(
      buffers,
      firstCenter,
      firstRing[nextRadial]!,
      firstRing[radial]!,
      uvScale,
    );
    appendTriangle(
      buffers,
      lastCenter,
      lastRing[radial]!,
      lastRing[nextRadial]!,
      uvScale,
    );
  }
}

function pillarCurve({
  x,
  bottomY,
  topY,
  topX,
  depth,
  seed,
  label,
}: {
  x: number;
  bottomY: number;
  topY: number;
  topX: number;
  depth: number;
  seed: number;
  label: string;
}): CatmullRomCurve3 {
  const drift = (stableUnit(seed, `${label}:drift`) - 0.5) * Math.abs(topX - x + 0.04) * 0.45;
  const depthDrift = (stableUnit(seed, `${label}:depth`) - 0.5) * depth * 0.55;
  return new CatmullRomCurve3([
    new Vector3(x, bottomY, 0),
    new Vector3(x + drift * 0.28, bottomY + (topY - bottomY) * 0.28, depthDrift * 0.2),
    new Vector3(x + drift * 0.56, bottomY + (topY - bottomY) * 0.58, depthDrift * 0.48),
    new Vector3(topX, topY, depthDrift),
  ], false, 'centripetal');
}

/**
 * Visual-only year arch. The accepted support geometry remains in
 * reefLimestoneArch.ts for raycasts and attachment slots; this mesh is focused
 * solely on making the structure read immediately as two grounded columns and
 * one continuous eroded crown instead of a stack of levitating rock shelves.
 */
export function buildReefArchColumnVisualGeometry({
  arch,
  profile,
}: {
  arch: ReefGrowthArchPlacement;
  profile: ReefTerracedFoundationProfile;
}): BufferGeometry {
  const buffers: GeometryBuffers = { positions: [], uvs: [] };
  const [leftFoot, rightFoot] = reefArchFootPoints(arch);
  const leftY = sampleReefTerracedFoundation(profile, leftFoot.x, leftFoot.z).height;
  const rightY = sampleReefTerracedFoundation(profile, rightFoot.x, rightFoot.z).height;
  const direction = stableUnit(arch.seed, 'arch-column:crown-direction') < 0.5 ? -1 : 1;
  const asymmetry = direction * arch.height * (
    0.025 + stableUnit(arch.seed, 'arch-column:shoulder-asymmetry') * 0.045
  );
  const embed = arch.thickness * 0.56;
  const leftBottomY = leftY - embed;
  const rightBottomY = rightY - embed;
  const leftTopY = leftY + arch.height * 0.55 + asymmetry;
  const rightTopY = rightY + arch.height * 0.55 - asymmetry;
  const leftBaseX = -arch.span * 0.5;
  const rightBaseX = arch.span * 0.5;
  const leftTopX = -arch.span * 0.405
    + direction * arch.span * 0.018;
  const rightTopX = arch.span * 0.405
    + direction * arch.span * 0.018;
  const crownSkew = direction * arch.span * (
    0.045 + stableUnit(arch.seed, 'arch-column:crown-skew') * 0.055
  );
  const apexY = Math.max(leftY, rightY) + arch.height * (
    0.95 + stableUnit(arch.seed, 'arch-column:apex-height') * 0.045
  );
  const crownDepth = arch.curveDepth * (
    0.8 + stableUnit(arch.seed, 'arch-column:crown-depth') * 0.35
  );

  const leftCurve = pillarCurve({
    x: leftBaseX,
    bottomY: leftBottomY,
    topY: leftTopY,
    topX: leftTopX,
    depth: arch.curveDepth,
    seed: arch.seed,
    label: 'arch-column:left',
  });
  const rightCurve = pillarCurve({
    x: rightBaseX,
    bottomY: rightBottomY,
    topY: rightTopY,
    topX: rightTopX,
    depth: arch.curveDepth,
    seed: arch.seed,
    label: 'arch-column:right',
  });

  const pillarRadius = (progress: number) => arch.thickness * (
    1.78 - progress * 0.48
    + Math.sin(progress * Math.PI) * 0.08
  );
  const pillarDepth = (progress: number) => 0.9 + progress * 0.05;
  const uvScale = 0.72 / Math.max(0.18, arch.thickness);

  appendSweep({
    buffers,
    curve: leftCurve,
    segmentCount: PILLAR_SEGMENTS,
    seed: arch.seed,
    label: 'arch-column:left',
    radiusAt: pillarRadius,
    depthScaleAt: pillarDepth,
    uvScale,
  });
  appendSweep({
    buffers,
    curve: rightCurve,
    segmentCount: PILLAR_SEGMENTS,
    seed: arch.seed,
    label: 'arch-column:right',
    radiusAt: pillarRadius,
    depthScaleAt: pillarDepth,
    uvScale,
  });

  const leftHaunch = new Vector3(
    leftTopX + arch.span * 0.12,
    leftTopY + (apexY - leftTopY) * 0.58,
    crownDepth * 0.66,
  );
  const rightHaunch = new Vector3(
    rightTopX - arch.span * 0.12,
    rightTopY + (apexY - rightTopY) * 0.58,
    crownDepth * 0.62,
  );
  const crownCurve = new CatmullRomCurve3([
    new Vector3(leftTopX, leftTopY, 0),
    leftHaunch,
    new Vector3(crownSkew, apexY, crownDepth),
    rightHaunch,
    new Vector3(rightTopX, rightTopY, 0),
  ], false, 'centripetal');

  appendSweep({
    buffers,
    curve: crownCurve,
    segmentCount: CROWN_SEGMENTS,
    seed: arch.seed,
    label: 'arch-column:crown',
    radiusAt: (progress) => arch.thickness * (
      1.31
      - Math.sin(progress * Math.PI) * 0.24
      + Math.sin(progress * TAU * 2 + stableUnit(arch.seed, 'arch-column:crown-wave') * TAU) * 0.045
    ),
    depthScaleAt: (progress) => 0.9 + Math.sin(progress * Math.PI) * 0.08,
    uvScale,
  });

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(buffers.positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(buffers.uvs, 2));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.reefArchColumnVisualVersion = REEF_ARCH_COLUMN_VISUAL_VERSION;
  geometry.userData.reefArchColumnVisualPass = REEF_ARCH_COLUMN_VISUAL_PASS;
  geometry.userData.reefSourceArchId = arch.id;
  geometry.userData.reefArchColumnApexHeight = apexY;
  geometry.userData.reefArchColumnOpeningWidth = Math.max(
    0,
    rightTopX - leftTopX - arch.thickness * 2.25,
  );
  geometry.userData.reefArchColumnEmbeddedDepth = embed;
  geometry.userData.reefArchColumnDrawCalls = 1;
  return geometry;
}
