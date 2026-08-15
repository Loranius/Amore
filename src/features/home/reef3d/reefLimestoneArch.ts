import {
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  Float32BufferAttribute,
  Vector3,
} from 'three';
import type { ReefGrowthArchPlacement } from '@/engine/species/reef';
import {
  sampleReefTerracedFoundation,
  type ReefTerracedFoundationProfile,
} from './reefTerracedFoundation';

export const REEF_LIMESTONE_ARCH_VERSION = 'reef-limestone-arch-v3';
export const REEF_LIMESTONE_ARCH_PASS = 'continuous-grounded-limestone-arch-columns';

const TAU = Math.PI * 2;
const RADIAL_SEGMENTS = 7;
const PILLAR_SEGMENTS = 6;
const CROWN_SEGMENTS = 14;
const SHELF_SEGMENTS = 7;
const PROTRUSION_COUNT = 7;
const ATTACHMENT_PROGRESS = [0.18, 0.5, 0.82] as const;
const EROSION_AMPLITUDE = 0.31;

type Point = Readonly<{ x: number; y: number; z: number }>;
type ColorTuple = readonly [number, number, number];

export interface ReefArchFootPoint {
  x: number;
  z: number;
}

export interface ReefArchCoralAttachmentSlot {
  id: string;
  position: { x: number; y: number; z: number };
  radius: number;
  availableFromEpoch: number;
}

interface GeometryBuffers {
  positions: number[];
  colors: number[];
  uvs: number[];
}

interface ArchColumnShape {
  leftY: number;
  rightY: number;
  leftTop: Vector3;
  rightTop: Vector3;
  apexY: number;
  crownSkew: number;
  centerlineAsymmetry: number;
  crownCurve: CatmullRomCurve3;
  leftPillarCurve: CatmullRomCurve3;
  rightPillarCurve: CatmullRomCurve3;
}

const ARCH_COLORS = {
  lower: colorTuple('#8f826b'),
  body: colorTuple('#aa9b7d'),
  warm: colorTuple('#b8aa89'),
  upper: colorTuple('#c9ba96'),
  shelf: colorTuple('#d7c69f'),
  shelfEdge: colorTuple('#9e9278'),
  underside: colorTuple('#746c5d'),
} as const;

function colorTuple(value: string): ColorTuple {
  const color = new Color(value);
  return [color.r, color.g, color.b];
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

export function reefArchWorldPointFromLocal(
  arch: ReefGrowthArchPlacement,
  localX: number,
  localZ: number,
): ReefArchFootPoint {
  const cosine = Math.cos(arch.rotationY);
  const sine = Math.sin(arch.rotationY);
  return {
    x: arch.center.x + localX * cosine + localZ * sine,
    z: arch.center.z - localX * sine + localZ * cosine,
  };
}

export function reefArchFootPoints(
  arch: ReefGrowthArchPlacement,
): readonly [ReefArchFootPoint, ReefArchFootPoint] {
  return [
    reefArchWorldPointFromLocal(arch, -arch.span * 0.5, 0),
    reefArchWorldPointFromLocal(arch, arch.span * 0.5, 0),
  ];
}

function appendTriangle(
  buffers: GeometryBuffers,
  first: Point,
  second: Point,
  third: Point,
  color: ColorTuple,
): void {
  for (const point of [first, second, third]) {
    buffers.positions.push(point.x, point.y, point.z);
    buffers.colors.push(color[0], color[1], color[2]);
    buffers.uvs.push(
      point.x * 0.52 + point.z * 0.09 + 0.5,
      point.y * 0.46 + point.z * 0.08,
    );
  }
}

function surfaceColor(
  seed: number,
  label: string,
  segment: number,
  radial: number,
  progress: number,
): ColorTuple {
  const value = stableUnit(seed, `${label}:color:${segment}:${radial}`);
  if (progress < 0.14 && value < 0.62) return ARCH_COLORS.lower;
  if (value > 0.8) return ARCH_COLORS.upper;
  if (value > 0.55) return ARCH_COLORS.warm;
  return ARCH_COLORS.body;
}

function appendSweep({
  buffers,
  curve,
  segmentCount,
  seed,
  label,
  radiusAt,
  depthScaleAt,
  radii,
}: {
  buffers: GeometryBuffers;
  curve: CatmullRomCurve3;
  segmentCount: number;
  seed: number;
  label: string;
  radiusAt: (progress: number) => number;
  depthScaleAt: (progress: number) => number;
  radii: number[];
}): void {
  const centers = curve.getSpacedPoints(segmentCount);
  const frames = curve.computeFrenetFrames(segmentCount, false);
  const phase = stableUnit(seed, `${label}:facet-phase`) * TAU / RADIAL_SEGMENTS;
  const scarFacet = Math.floor(stableUnit(seed, `${label}:scar-facet`) * RADIAL_SEGMENTS);
  const scarProgress = 0.22 + stableUnit(seed, `${label}:scar-progress`) * 0.56;
  const rings: Vector3[][] = [];

  for (let segment = 0; segment <= segmentCount; segment += 1) {
    const progress = segment / segmentCount;
    const center = centers[segment]!;
    const normal = frames.normals[segment]!;
    const binormal = frames.binormals[segment]!;
    const radius = radiusAt(progress);
    const depthScale = depthScaleAt(progress);
    radii.push(radius);
    const ring: Vector3[] = [];

    for (let radial = 0; radial < RADIAL_SEGMENTS; radial += 1) {
      const angle = phase + radial / RADIAL_SEGMENTS * TAU;
      const facetVariation = 0.88
        + stableUnit(seed, `${label}:facet:${segment}:${radial}`) * 0.2;
      const radialDistance = Math.min(
        Math.abs(radial - scarFacet),
        RADIAL_SEGMENTS - Math.abs(radial - scarFacet),
      );
      const scarRadialWeight = Math.max(0, 1 - radialDistance / 1.55);
      const scarLongitudinalWeight = Math.max(
        0,
        1 - Math.abs(progress - scarProgress) / 0.17,
      );
      const erosion = 1 - scarRadialWeight * scarLongitudinalWeight * EROSION_AMPLITUDE;
      ring.push(
        center.clone()
          .addScaledVector(
            normal,
            Math.cos(angle) * radius * facetVariation * erosion,
          )
          .addScaledVector(
            binormal,
            Math.sin(angle) * radius * depthScale * facetVariation * erosion,
          ),
      );
    }
    rings.push(ring);
  }

  for (let segment = 0; segment < segmentCount; segment += 1) {
    const current = rings[segment]!;
    const next = rings[segment + 1]!;
    const progress = segment / segmentCount;
    for (let radial = 0; radial < RADIAL_SEGMENTS; radial += 1) {
      const nextRadial = (radial + 1) % RADIAL_SEGMENTS;
      const color = surfaceColor(seed, label, segment, radial, progress);
      appendTriangle(
        buffers,
        current[radial]!,
        current[nextRadial]!,
        next[radial]!,
        color,
      );
      appendTriangle(
        buffers,
        current[nextRadial]!,
        next[nextRadial]!,
        next[radial]!,
        color,
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
      ARCH_COLORS.lower,
    );
    appendTriangle(
      buffers,
      lastCenter,
      lastRing[radial]!,
      lastRing[nextRadial]!,
      ARCH_COLORS.lower,
    );
  }
}

function buildArchColumnShape(
  arch: ReefGrowthArchPlacement,
  profile: ReefTerracedFoundationProfile,
): ArchColumnShape {
  const [leftFoot, rightFoot] = reefArchFootPoints(arch);
  const leftY = sampleReefTerracedFoundation(profile, leftFoot.x, leftFoot.z).height;
  const rightY = sampleReefTerracedFoundation(profile, rightFoot.x, rightFoot.z).height;
  const direction = stableUnit(arch.seed, 'arch-column:direction') < 0.5 ? -1 : 1;
  const shoulderBias = direction * (
    0.038 + stableUnit(arch.seed, 'arch-column:shoulder-bias') * 0.028
  );
  const leftTopY = leftY + arch.height * (0.58 + shoulderBias);
  const rightTopY = rightY + arch.height * (0.58 - shoulderBias);
  const leftTopX = -arch.span * (
    0.405 + stableUnit(arch.seed, 'arch-column:left-inset') * 0.018
  );
  const rightTopX = arch.span * (
    0.405 + stableUnit(arch.seed, 'arch-column:right-inset') * 0.018
  );
  const leftTopZ = (stableUnit(arch.seed, 'arch-column:left-depth') - 0.5)
    * arch.thickness
    * 0.62;
  const rightTopZ = (stableUnit(arch.seed, 'arch-column:right-depth') - 0.5)
    * arch.thickness
    * 0.62;
  const crownSkew = direction * arch.span * (
    0.11 + stableUnit(arch.seed, 'arch-column:crown-skew') * 0.05
  );
  const crownDepth = arch.curveDepth * (
    0.82 + stableUnit(arch.seed, 'arch-column:crown-depth') * 0.34
  );
  const apexY = Math.max(leftY, rightY) + arch.height * (
    0.96 + stableUnit(arch.seed, 'arch-column:apex-height') * 0.035
  );
  const embed = arch.thickness * 0.62;
  const leftTop = new Vector3(leftTopX, leftTopY, leftTopZ);
  const rightTop = new Vector3(rightTopX, rightTopY, rightTopZ);

  const leftPillarCurve = new CatmullRomCurve3([
    new Vector3(-arch.span * 0.5, leftY - embed, 0),
    new Vector3(
      -arch.span * 0.49,
      leftY + arch.height * 0.18,
      leftTopZ * 0.2,
    ),
    new Vector3(
      -arch.span * 0.465,
      leftY + arch.height * 0.39,
      leftTopZ * 0.55,
    ),
    leftTop,
  ], false, 'centripetal');
  const rightPillarCurve = new CatmullRomCurve3([
    new Vector3(arch.span * 0.5, rightY - embed, 0),
    new Vector3(
      arch.span * 0.49,
      rightY + arch.height * 0.18,
      rightTopZ * 0.2,
    ),
    new Vector3(
      arch.span * 0.465,
      rightY + arch.height * 0.39,
      rightTopZ * 0.55,
    ),
    rightTop,
  ], false, 'centripetal');

  const leftHaunch = new Vector3(
    leftTopX + arch.span * 0.13,
    leftTopY + (apexY - leftTopY) * 0.6,
    leftTopZ * 0.35 + crownDepth * 0.68,
  );
  const rightHaunch = new Vector3(
    rightTopX - arch.span * 0.13,
    rightTopY + (apexY - rightTopY) * 0.6,
    rightTopZ * 0.35 + crownDepth * 0.64,
  );
  const crownCurve = new CatmullRomCurve3([
    leftTop,
    leftHaunch,
    new Vector3(crownSkew, apexY, crownDepth),
    rightHaunch,
    rightTop,
  ], false, 'centripetal');

  return {
    leftY,
    rightY,
    leftTop,
    rightTop,
    apexY,
    crownSkew,
    centerlineAsymmetry: Math.abs(crownSkew) + arch.span * 0.06,
    crownCurve,
    leftPillarCurve,
    rightPillarCurve,
  };
}

function appendFacetedMass(
  buffers: GeometryBuffers,
  center: Point,
  radiusX: number,
  radiusY: number,
  radiusZ: number,
  seed: number,
  label: string,
): void {
  const sides = 6;
  const phase = stableUnit(seed, `${label}:phase`) * TAU;
  const top = new Vector3(
    center.x + (stableUnit(seed, `${label}:top-x`) - 0.5) * radiusX * 0.16,
    center.y + radiusY,
    center.z + (stableUnit(seed, `${label}:top-z`) - 0.5) * radiusZ * 0.16,
  );
  const bottom = new Vector3(center.x, center.y - radiusY, center.z);
  const equator = Array.from({ length: sides }, (_value, index) => {
    const angle = phase + index / sides * TAU;
    const irregularity = 0.86 + stableUnit(seed, `${label}:side:${index}`) * 0.22;
    return new Vector3(
      center.x + Math.cos(angle) * radiusX * irregularity,
      center.y + (stableUnit(seed, `${label}:height:${index}`) - 0.5) * radiusY * 0.14,
      center.z + Math.sin(angle) * radiusZ * irregularity,
    );
  });

  for (let index = 0; index < sides; index += 1) {
    const current = equator[index]!;
    const next = equator[(index + 1) % sides]!;
    appendTriangle(buffers, top, next, current, ARCH_COLORS.warm);
    appendTriangle(buffers, bottom, current, next, ARCH_COLORS.lower);
  }
}

function crownRadiusAt(arch: ReefGrowthArchPlacement, progress: number): number {
  const wave = Math.sin(
    progress * TAU * 2 + stableUnit(arch.seed, 'arch-column:crown-radius-wave') * TAU,
  ) * 0.045;
  return arch.thickness * (
    1.3 - Math.sin(progress * Math.PI) * 0.25 + wave
  );
}

function appendAttachmentShelf(
  buffers: GeometryBuffers,
  arch: ReefGrowthArchPlacement,
  crownCurve: CatmullRomCurve3,
  index: number,
  progress: number,
): ReefArchCoralAttachmentSlot {
  const jitter = (stableUnit(arch.seed, `arch-column:shelf:${index}:progress`) - 0.5) * 0.028;
  const t = Math.max(0.08, Math.min(0.92, progress + jitter));
  const bodyCenter = crownCurve.getPointAt(t);
  const bodyRadius = crownRadiusAt(arch, t);
  const outward = stableUnit(arch.seed, `arch-column:shelf:${index}:side`) < 0.5 ? -1 : 1;
  const radiusX = arch.thickness * (index === 1 ? 1.05 : 0.88)
    * (0.94 + stableUnit(arch.seed, `arch-column:shelf:${index}:width`) * 0.12);
  const radiusZ = arch.thickness * (index === 1 ? 0.82 : 0.7)
    * (0.94 + stableUnit(arch.seed, `arch-column:shelf:${index}:depth`) * 0.12);
  // The attachment lip stays fused into the crown, but its flat top must be the
  // highest surface at its authored anchor so a coral never starts inside rock.
  const topY = bodyCenter.y + bodyRadius * 0.68;
  const bottomY = topY - Math.max(0.035, arch.thickness * 0.16);
  const centerX = bodyCenter.x
    + (stableUnit(arch.seed, `arch-column:shelf:${index}:x`) - 0.5) * arch.thickness * 0.22;
  const centerZ = bodyCenter.z + outward * (
    bodyRadius * 0.52 + radiusZ * 0.16
  );
  const phase = stableUnit(arch.seed, `arch-column:shelf:${index}:phase`) * TAU;
  const topRing: Vector3[] = [];
  const bottomRing: Vector3[] = [];

  for (let side = 0; side < SHELF_SEGMENTS; side += 1) {
    const angle = phase + side / SHELF_SEGMENTS * TAU;
    const irregularity = 0.9
      + stableUnit(arch.seed, `arch-column:shelf:${index}:edge:${side}`) * 0.16;
    const x = centerX + Math.cos(angle) * radiusX * irregularity;
    const z = centerZ + Math.sin(angle) * radiusZ * irregularity;
    topRing.push(new Vector3(x, topY, z));
    bottomRing.push(new Vector3(x, bottomY, z));
  }

  const topCenter = new Vector3(centerX, topY, centerZ);
  const bottomCenter = new Vector3(centerX, bottomY, centerZ);
  for (let side = 0; side < SHELF_SEGMENTS; side += 1) {
    const next = (side + 1) % SHELF_SEGMENTS;
    appendTriangle(buffers, topCenter, topRing[next]!, topRing[side]!, ARCH_COLORS.shelf);
    appendTriangle(
      buffers,
      bottomCenter,
      bottomRing[side]!,
      bottomRing[next]!,
      ARCH_COLORS.underside,
    );
    appendTriangle(
      buffers,
      topRing[side]!,
      topRing[next]!,
      bottomRing[side]!,
      ARCH_COLORS.shelfEdge,
    );
    appendTriangle(
      buffers,
      topRing[next]!,
      bottomRing[next]!,
      bottomRing[side]!,
      ARCH_COLORS.shelfEdge,
    );
  }

  return {
    id: `${arch.id}:coral-attachment:${index}`,
    position: {
      x: round6(centerX),
      y: round6(topY + 0.014),
      z: round6(centerZ),
    },
    radius: round6(Math.min(radiusX, radiusZ) * 0.72),
    availableFromEpoch: arch.yearIndex,
  };
}

/**
 * Builds one unmistakable portal arch per completed relationship year: two
 * limestone columns are embedded into the substrate and joined by a single
 * continuous asymmetric crown. Small weathered accretions and attachment lips
 * are fused into that body instead of floating as independent rock shelves.
 */
export function buildReefLimestoneArchGeometry({
  arch,
  profile,
}: {
  arch: ReefGrowthArchPlacement;
  profile: ReefTerracedFoundationProfile;
}): BufferGeometry {
  const buffers: GeometryBuffers = { positions: [], colors: [], uvs: [] };
  const shape = buildArchColumnShape(arch, profile);
  const radii: number[] = [];

  const pillarRadius = (progress: number) => arch.thickness * (
    1.82 - progress * 0.5 + Math.sin(progress * Math.PI) * 0.06
  );
  appendSweep({
    buffers,
    curve: shape.leftPillarCurve,
    segmentCount: PILLAR_SEGMENTS,
    seed: arch.seed,
    label: 'arch-column:left',
    radiusAt: pillarRadius,
    depthScaleAt: (progress) => 0.9 + progress * 0.06,
    radii,
  });
  appendSweep({
    buffers,
    curve: shape.rightPillarCurve,
    segmentCount: PILLAR_SEGMENTS,
    seed: arch.seed,
    label: 'arch-column:right',
    radiusAt: pillarRadius,
    depthScaleAt: (progress) => 0.9 + progress * 0.06,
    radii,
  });
  appendSweep({
    buffers,
    curve: shape.crownCurve,
    segmentCount: CROWN_SEGMENTS,
    seed: arch.seed,
    label: 'arch-column:crown',
    radiusAt: (progress) => crownRadiusAt(arch, progress),
    depthScaleAt: (progress) => 0.9 + Math.sin(progress * Math.PI) * 0.08,
    radii,
  });

  // Buried buttresses make both columns visibly load-bearing.
  appendFacetedMass(
    buffers,
    {
      x: -arch.span * 0.5,
      y: shape.leftY - arch.thickness * 0.08,
      z: 0,
    },
    arch.thickness * 1.75,
    arch.thickness * 0.92,
    arch.thickness * 1.42,
    arch.seed,
    'arch-column:left-buttress',
  );
  appendFacetedMass(
    buffers,
    {
      x: arch.span * 0.5,
      y: shape.rightY - arch.thickness * 0.08,
      z: 0,
    },
    arch.thickness * 1.72,
    arch.thickness * 0.9,
    arch.thickness * 1.4,
    arch.seed,
    'arch-column:right-buttress',
  );

  // Seven small accretions remain physically embedded in the arch surface, so
  // weathering adds age without recreating the old floating-boulder silhouette.
  for (let index = 0; index < PROTRUSION_COUNT; index += 1) {
    const progress = 0.1 + index / (PROTRUSION_COUNT - 1) * 0.8;
    const center = shape.crownCurve.getPointAt(progress);
    const radius = crownRadiusAt(arch, progress);
    const side = stableUnit(arch.seed, `arch-column:accretion:${index}:side`) < 0.5 ? -1 : 1;
    appendFacetedMass(
      buffers,
      {
        x: center.x + (stableUnit(arch.seed, `arch-column:accretion:${index}:x`) - 0.5)
          * radius
          * 0.28,
        y: center.y - radius * (
          0.06 + stableUnit(arch.seed, `arch-column:accretion:${index}:drop`) * 0.08
        ),
        z: center.z + side * radius * (
          0.24 + stableUnit(arch.seed, `arch-column:accretion:${index}:offset`) * 0.12
        ),
      },
      radius * (0.32 + stableUnit(arch.seed, `arch-column:accretion:${index}:rx`) * 0.12),
      radius * (0.26 + stableUnit(arch.seed, `arch-column:accretion:${index}:ry`) * 0.1),
      radius * (0.34 + stableUnit(arch.seed, `arch-column:accretion:${index}:rz`) * 0.12),
      arch.seed,
      `arch-column:accretion:${index}`,
    );
  }

  const attachmentSlots = ATTACHMENT_PROGRESS.map((progress, index) => (
    appendAttachmentShelf(buffers, arch, shape.crownCurve, index, progress)
  ));

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(buffers.positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(buffers.colors, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(buffers.uvs, 2));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.reefLimestoneArchVersion = REEF_LIMESTONE_ARCH_VERSION;
  geometry.userData.reefLimestoneArchPass = REEF_LIMESTONE_ARCH_PASS;
  geometry.userData.reefSourceArchId = arch.id;
  geometry.userData.reefArchYearIndex = arch.yearIndex;
  geometry.userData.reefArchDrawCalls = 1;
  geometry.userData.reefArchLongitudinalSegments = PILLAR_SEGMENTS * 2 + CROWN_SEGMENTS;
  geometry.userData.reefArchRadialSegments = RADIAL_SEGMENTS;
  geometry.userData.reefArchProtrusionCount = PROTRUSION_COUNT + 2;
  geometry.userData.reefArchAttachmentCount = attachmentSlots.length;
  geometry.userData.reefArchMinimumRadius = Math.min(...radii);
  geometry.userData.reefArchMaximumRadius = Math.max(...radii);
  geometry.userData.reefArchFootHeights = [shape.leftY, shape.rightY];
  geometry.userData.reefArchApexHeight = shape.apexY;
  geometry.userData.reefArchShoulderHeights = [shape.leftTop.y, shape.rightTop.y];
  geometry.userData.reefArchCenterlineAsymmetry = shape.centerlineAsymmetry;
  geometry.userData.reefArchErosionAmplitude = EROSION_AMPLITUDE;
  geometry.userData.reefArchOpeningWidth = Math.max(
    0,
    shape.rightTop.x - shape.leftTop.x - arch.thickness * 2.5,
  );
  geometry.userData.reefArchEmbeddedFeet = true;
  geometry.userData.reefCoralAttachmentSlots = attachmentSlots;
  geometry.userData.reefSupportSurface = true;
  geometry.userData.reefSupportSurfaceKind = 'arch';
  return geometry;
}
