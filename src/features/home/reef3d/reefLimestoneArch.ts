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

export const REEF_LIMESTONE_ARCH_VERSION = 'reef-limestone-arch-v2';
export const REEF_LIMESTONE_ARCH_PASS = 'asymmetric-eroded-limestone-arch-with-safe-shelves';

const TAU = Math.PI * 2;
const LONGITUDINAL_SEGMENTS = 20;
const RADIAL_SEGMENTS = 7;
const SHELF_SEGMENTS = 7;
const PROTRUSION_COUNT = 7;
const ATTACHMENT_PROGRESS = [0.25, 0.5, 0.75] as const;
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

const ARCH_COLORS = {
  lower: colorTuple('#8f826b'),
  body: colorTuple('#aa9b7d'),
  warm: colorTuple('#b8aa89'),
  upper: colorTuple('#c9ba96'),
  shelf: colorTuple('#ddcca4'),
  shelfEdge: colorTuple('#a99a7d'),
  underside: colorTuple('#756d60'),
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
    buffers.uvs.push(point.x * 0.52 + 0.5, point.y * 0.46 + point.z * 0.08);
  }
}

function bodyRadiusAt(arch: ReefGrowthArchPlacement, progress: number): number {
  const footWeight = Math.pow(Math.abs(progress - 0.5) * 2, 1.38);
  const primaryPhase = stableUnit(arch.seed, 'limestone-radius-primary') * TAU;
  const secondaryPhase = stableUnit(arch.seed, 'limestone-radius-secondary') * TAU;
  const leftMass = 0.9 + stableUnit(arch.seed, 'limestone-left-mass') * 0.18;
  const rightMass = 0.9 + stableUnit(arch.seed, 'limestone-right-mass') * 0.18;
  const sideBias = leftMass + (rightMass - leftMass) * progress;
  const variation = 1
    + Math.sin(progress * TAU * 1.7 + primaryPhase) * 0.12
    + Math.sin(progress * TAU * 4.3 - secondaryPhase) * 0.055;
  return arch.thickness * (0.96 + footWeight * 0.62) * variation * sideBias;
}

function buildArchCurve(
  arch: ReefGrowthArchPlacement,
  profile: ReefTerracedFoundationProfile,
): {
  curve: CatmullRomCurve3;
  leftY: number;
  rightY: number;
  apexY: number;
  shoulderHeights: readonly [number, number];
  centerlineAsymmetry: number;
} {
  const [leftFoot, rightFoot] = reefArchFootPoints(arch);
  const leftY = sampleReefTerracedFoundation(profile, leftFoot.x, leftFoot.z).height;
  const rightY = sampleReefTerracedFoundation(profile, rightFoot.x, rightFoot.z).height;
  const crownDirection = stableUnit(arch.seed, 'limestone-crown-direction') < 0.5 ? -1 : 1;
  const apexY = Math.max(leftY, rightY) + arch.height * (
    0.92 + stableUnit(arch.seed, 'limestone-apex-height') * 0.07
  );
  const crownSkew = crownDirection * arch.span * (
    0.085 + stableUnit(arch.seed, 'limestone-crown-skew') * 0.105
  );
  const shoulderBias = crownDirection * (
    0.08 + stableUnit(arch.seed, 'limestone-shoulder-bias') * 0.09
  );
  const leftShoulderRatio = 0.61 + shoulderBias * 0.5;
  const rightShoulderRatio = 0.61 - shoulderBias * 0.5;
  const leftUpperRatio = 0.84 + shoulderBias * 0.28;
  const rightUpperRatio = 0.84 - shoulderBias * 0.28;
  const leftShoulderY = leftY + (apexY - leftY) * leftShoulderRatio;
  const rightShoulderY = rightY + (apexY - rightY) * rightShoulderRatio;
  const leftDepth = (stableUnit(arch.seed, 'limestone-left-depth') - 0.5)
    * arch.thickness
    * 2.1;
  const rightDepth = (stableUnit(arch.seed, 'limestone-right-depth') - 0.5)
    * arch.thickness
    * 2.1;
  const crownDepth = arch.curveDepth
    + (stableUnit(arch.seed, 'limestone-crown-depth') - 0.5) * arch.thickness * 1.5;
  const centerlineAsymmetry = Math.abs(crownSkew)
    + Math.abs(leftShoulderRatio - rightShoulderRatio) * arch.span;

  return {
    leftY,
    rightY,
    apexY,
    shoulderHeights: [leftShoulderY, rightShoulderY],
    centerlineAsymmetry,
    curve: new CatmullRomCurve3([
      new Vector3(-arch.span * 0.5, leftY, 0),
      new Vector3(
        -arch.span * 0.445 + crownDirection * arch.span * 0.012,
        leftY + (apexY - leftY) * (
          0.21 + stableUnit(arch.seed, 'limestone-left-lower-rise') * 0.08
        ),
        arch.curveDepth * 0.1 + leftDepth * 0.72,
      ),
      new Vector3(
        -arch.span * 0.325 + crownDirection * arch.span * 0.03,
        leftShoulderY,
        arch.curveDepth * 0.46 + leftDepth,
      ),
      new Vector3(
        -arch.span * 0.16 + crownSkew * 0.42,
        leftY + (apexY - leftY) * leftUpperRatio,
        arch.curveDepth * 0.82 + leftDepth * 0.44,
      ),
      new Vector3(crownSkew, apexY, crownDepth),
      new Vector3(
        arch.span * 0.155 + crownSkew * 0.38,
        rightY + (apexY - rightY) * rightUpperRatio,
        arch.curveDepth * 0.78 + rightDepth * 0.44,
      ),
      new Vector3(
        arch.span * 0.32 + crownDirection * arch.span * 0.022,
        rightShoulderY,
        arch.curveDepth * 0.42 + rightDepth,
      ),
      new Vector3(
        arch.span * 0.44 - crownDirection * arch.span * 0.014,
        rightY + (apexY - rightY) * (
          0.2 + stableUnit(arch.seed, 'limestone-right-lower-rise') * 0.09
        ),
        arch.curveDepth * 0.08 + rightDepth * 0.72,
      ),
      new Vector3(arch.span * 0.5, rightY, 0),
    ], false, 'centripetal'),
  };
}

function bodyColor(
  arch: ReefGrowthArchPlacement,
  segment: number,
  radial: number,
  isUpperFacet: boolean,
): ColorTuple {
  if (isUpperFacet) {
    return stableUnit(arch.seed, `limestone-upper:${segment}:${radial}`) > 0.42
      ? ARCH_COLORS.upper
      : ARCH_COLORS.warm;
  }
  const value = stableUnit(arch.seed, `limestone-body:${segment}:${radial}`);
  if (value < 0.22) return ARCH_COLORS.lower;
  if (value > 0.76) return ARCH_COLORS.warm;
  return ARCH_COLORS.body;
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
    center.x + (stableUnit(seed, `${label}:top-x`) - 0.5) * radiusX * 0.2,
    center.y + radiusY,
    center.z + (stableUnit(seed, `${label}:top-z`) - 0.5) * radiusZ * 0.2,
  );
  const bottom = new Vector3(center.x, center.y - radiusY, center.z);
  const equator = Array.from({ length: sides }, (_value, index) => {
    const angle = phase + index / sides * TAU;
    const irregularity = 0.86 + stableUnit(seed, `${label}:side:${index}`) * 0.22;
    return new Vector3(
      center.x + Math.cos(angle) * radiusX * irregularity,
      center.y + (stableUnit(seed, `${label}:height:${index}`) - 0.5) * radiusY * 0.16,
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

function appendAttachmentShelf(
  buffers: GeometryBuffers,
  arch: ReefGrowthArchPlacement,
  curve: CatmullRomCurve3,
  index: number,
  progress: number,
): ReefArchCoralAttachmentSlot {
  const jitter = (stableUnit(arch.seed, `limestone-shelf:${index}:progress`) - 0.5) * 0.035;
  const t = Math.max(0.12, Math.min(0.88, progress + jitter));
  const bodyCenter = curve.getPointAt(t);
  const bodyRadius = bodyRadiusAt(arch, t);
  const outward = stableUnit(arch.seed, `limestone-shelf:${index}:side`) < 0.5 ? -1 : 1;
  const radiusX = arch.thickness * (index === 1 ? 2.15 : 1.78)
    * (0.94 + stableUnit(arch.seed, `limestone-shelf:${index}:width`) * 0.14);
  const radiusZ = arch.thickness * (index === 1 ? 1.58 : 1.34)
    * (0.94 + stableUnit(arch.seed, `limestone-shelf:${index}:depth`) * 0.14);
  const topY = bodyCenter.y + bodyRadius * (index === 1 ? 0.5 : 0.38);
  const bottomY = topY - Math.max(0.045, arch.thickness * 0.24);
  const centerX = bodyCenter.x
    + (stableUnit(arch.seed, `limestone-shelf:${index}:x`) - 0.5) * arch.thickness * 0.5;
  const centerZ = bodyCenter.z + outward * (
    bodyRadius * (0.96 + stableUnit(arch.seed, `limestone-shelf:${index}:offset`) * 0.14)
    + radiusZ * 0.42
  );
  const phase = stableUnit(arch.seed, `limestone-shelf:${index}:phase`) * TAU;
  const topRing: Vector3[] = [];
  const bottomRing: Vector3[] = [];

  for (let side = 0; side < SHELF_SEGMENTS; side += 1) {
    const angle = phase + side / SHELF_SEGMENTS * TAU;
    const irregularity = 0.88
      + stableUnit(arch.seed, `limestone-shelf:${index}:edge:${side}`) * 0.2;
    const x = centerX + Math.cos(angle) * radiusX * irregularity;
    const z = centerZ + Math.sin(angle) * radiusZ * irregularity;
    topRing.push(new Vector3(x, topY, z));
    bottomRing.push(new Vector3(x, bottomY, z));
  }

  const topCenter = new Vector3(centerX, topY, centerZ);
  const bottomCenter = new Vector3(centerX, bottomY, centerZ);
  for (let side = 0; side < SHELF_SEGMENTS; side += 1) {
    const next = (side + 1) % SHELF_SEGMENTS;
    appendTriangle(
      buffers,
      topCenter,
      topRing[next]!,
      topRing[side]!,
      ARCH_COLORS.shelf,
    );
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
    radius: round6(Math.min(radiusX, radiusZ) * 0.74),
    availableFromEpoch: arch.yearIndex,
  };
}

/**
 * Builds one faceted limestone body per completed-year arch. The body has
 * non-uniform thickness, an asymmetric eroded centreline, embedded feet,
 * fused-looking rock accretions and three offset horizontal attachment shelves.
 */
export function buildReefLimestoneArchGeometry({
  arch,
  profile,
}: {
  arch: ReefGrowthArchPlacement;
  profile: ReefTerracedFoundationProfile;
}): BufferGeometry {
  const buffers: GeometryBuffers = { positions: [], colors: [], uvs: [] };
  const {
    curve,
    leftY,
    rightY,
    apexY,
    shoulderHeights,
    centerlineAsymmetry,
  } = buildArchCurve(arch, profile);
  const frames = curve.computeFrenetFrames(LONGITUDINAL_SEGMENTS, false);
  const centers = curve.getSpacedPoints(LONGITUDINAL_SEGMENTS);
  const rings: Vector3[][] = [];
  const radii: number[] = [];
  const facetPhase = stableUnit(arch.seed, 'limestone-facet-phase') * TAU / RADIAL_SEGMENTS;
  const primaryScarProgress = 0.18
    + stableUnit(arch.seed, 'limestone-primary-scar-progress') * 0.64;
  const secondaryScarProgress = 0.24
    + stableUnit(arch.seed, 'limestone-secondary-scar-progress') * 0.52;
  const primaryScarFacet = Math.floor(
    stableUnit(arch.seed, 'limestone-primary-scar-facet') * RADIAL_SEGMENTS,
  );
  const secondaryScarFacet = Math.floor(
    stableUnit(arch.seed, 'limestone-secondary-scar-facet') * RADIAL_SEGMENTS,
  );

  for (let segment = 0; segment <= LONGITUDINAL_SEGMENTS; segment += 1) {
    const progress = segment / LONGITUDINAL_SEGMENTS;
    const center = centers[segment]!.clone();
    const normal = frames.normals[segment]!;
    const binormal = frames.binormals[segment]!;
    const radius = bodyRadiusAt(arch, progress) * (
      0.86 + stableUnit(arch.seed, `limestone-segment-scale:${segment}`) * 0.29
    );
    const interiorWeight = Math.sin(progress * Math.PI);
    center
      .addScaledVector(
        normal,
        (stableUnit(arch.seed, `limestone-center-normal:${segment}`) - 0.5)
          * radius
          * 0.2
          * interiorWeight,
      )
      .addScaledVector(
        binormal,
        (stableUnit(arch.seed, `limestone-center-binormal:${segment}`) - 0.5)
          * radius
          * 0.16
          * interiorWeight,
      );
    centers[segment] = center;
    radii.push(radius);
    const ring: Vector3[] = [];

    for (let radial = 0; radial < RADIAL_SEGMENTS; radial += 1) {
      const angle = facetPhase + radial / RADIAL_SEGMENTS * TAU;
      const facetScale = 0.83
        + stableUnit(arch.seed, `limestone-facet:${radial}`) * 0.31;
      const localErosion = 0.81
        + stableUnit(arch.seed, `limestone-ring:${segment}:facet:${radial}`) * 0.3;
      const primaryLongitudinalWeight = Math.max(
        0,
        1 - Math.abs(progress - primaryScarProgress) / 0.13,
      );
      const secondaryLongitudinalWeight = Math.max(
        0,
        1 - Math.abs(progress - secondaryScarProgress) / 0.1,
      );
      const primaryFacetDistance = Math.min(
        Math.abs(radial - primaryScarFacet),
        RADIAL_SEGMENTS - Math.abs(radial - primaryScarFacet),
      );
      const secondaryFacetDistance = Math.min(
        Math.abs(radial - secondaryScarFacet),
        RADIAL_SEGMENTS - Math.abs(radial - secondaryScarFacet),
      );
      const primaryFacetWeight = Math.max(0, 1 - primaryFacetDistance / 1.7);
      const secondaryFacetWeight = Math.max(0, 1 - secondaryFacetDistance / 1.45);
      const scarScale = 1
        - primaryLongitudinalWeight * primaryFacetWeight * EROSION_AMPLITUDE
        - secondaryLongitudinalWeight * secondaryFacetWeight * EROSION_AMPLITUDE * 0.62;
      const verticalCompression = 0.76
        + stableUnit(arch.seed, `limestone-vertical:${segment}:${radial}`) * 0.13;
      ring.push(
        center.clone()
          .addScaledVector(
            normal,
            Math.cos(angle) * radius * facetScale * localErosion * scarScale,
          )
          .addScaledVector(
            binormal,
            Math.sin(angle) * radius * verticalCompression * localErosion * scarScale,
          ),
      );
    }
    rings.push(ring);
  }

  for (let segment = 0; segment < LONGITUDINAL_SEGMENTS; segment += 1) {
    const currentRing = rings[segment]!;
    const nextRing = rings[segment + 1]!;
    const currentCenter = centers[segment]!;
    const nextCenter = centers[segment + 1]!;

    for (let radial = 0; radial < RADIAL_SEGMENTS; radial += 1) {
      const nextRadial = (radial + 1) % RADIAL_SEGMENTS;
      const averageY = (
        currentRing[radial]!.y
        + currentRing[nextRadial]!.y
        + nextRing[radial]!.y
        + nextRing[nextRadial]!.y
      ) * 0.25;
      const isUpperFacet = averageY > (currentCenter.y + nextCenter.y) * 0.5;
      const color = bodyColor(arch, segment, radial, isUpperFacet);
      appendTriangle(
        buffers,
        currentRing[radial]!,
        currentRing[nextRadial]!,
        nextRing[radial]!,
        color,
      );
      appendTriangle(
        buffers,
        currentRing[nextRadial]!,
        nextRing[nextRadial]!,
        nextRing[radial]!,
        color,
      );
    }
  }

  const firstRing = rings[0]!;
  const lastRing = rings[LONGITUDINAL_SEGMENTS]!;
  for (let radial = 0; radial < RADIAL_SEGMENTS; radial += 1) {
    const nextRadial = (radial + 1) % RADIAL_SEGMENTS;
    appendTriangle(
      buffers,
      centers[0]!,
      firstRing[nextRadial]!,
      firstRing[radial]!,
      ARCH_COLORS.lower,
    );
    appendTriangle(
      buffers,
      centers[LONGITUDINAL_SEGMENTS]!,
      lastRing[radial]!,
      lastRing[nextRadial]!,
      ARCH_COLORS.lower,
    );
  }

  appendFacetedMass(
    buffers,
    { x: -arch.span * 0.5, y: leftY - arch.thickness * 0.18, z: 0 },
    arch.thickness * 1.72,
    arch.thickness * 1.08,
    arch.thickness * 1.46,
    arch.seed,
    'limestone-left-buttress',
  );
  appendFacetedMass(
    buffers,
    { x: arch.span * 0.5, y: rightY - arch.thickness * 0.18, z: 0 },
    arch.thickness * 1.68,
    arch.thickness * 1.04,
    arch.thickness * 1.42,
    arch.seed,
    'limestone-right-buttress',
  );

  for (let index = 0; index < PROTRUSION_COUNT; index += 1) {
    const baseProgress = 0.1 + index / (PROTRUSION_COUNT - 1) * 0.8;
    const progress = Math.max(0.08, Math.min(
      0.92,
      baseProgress
        + (stableUnit(arch.seed, `limestone-protrusion:${index}:progress`) - 0.5) * 0.045,
    ));
    const center = curve.getPointAt(progress);
    const radius = bodyRadiusAt(arch, progress);
    const side = stableUnit(arch.seed, `limestone-protrusion:${index}:side`) < 0.5 ? -1 : 1;
    appendFacetedMass(
      buffers,
      {
        x: center.x + (stableUnit(arch.seed, `limestone-protrusion:${index}:x`) - 0.5)
          * radius
          * 0.78,
        y: center.y - radius * (
          0.02 + stableUnit(arch.seed, `limestone-protrusion:${index}:drop`) * 0.16
        ),
        z: center.z + side * radius * (
          0.48 + stableUnit(arch.seed, `limestone-protrusion:${index}:offset`) * 0.34
        ),
      },
      radius * (0.56 + stableUnit(arch.seed, `limestone-protrusion:${index}:rx`) * 0.34),
      radius * (0.42 + stableUnit(arch.seed, `limestone-protrusion:${index}:ry`) * 0.3),
      radius * (0.58 + stableUnit(arch.seed, `limestone-protrusion:${index}:rz`) * 0.36),
      arch.seed,
      `limestone-protrusion:${index}`,
    );
  }

  const attachmentSlots = ATTACHMENT_PROGRESS.map((progress, index) => (
    appendAttachmentShelf(buffers, arch, curve, index, progress)
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
  geometry.userData.reefArchLongitudinalSegments = LONGITUDINAL_SEGMENTS;
  geometry.userData.reefArchRadialSegments = RADIAL_SEGMENTS;
  geometry.userData.reefArchProtrusionCount = PROTRUSION_COUNT + 2;
  geometry.userData.reefArchAttachmentCount = attachmentSlots.length;
  geometry.userData.reefArchMinimumRadius = Math.min(...radii);
  geometry.userData.reefArchMaximumRadius = Math.max(...radii);
  geometry.userData.reefArchFootHeights = [leftY, rightY];
  geometry.userData.reefArchApexHeight = apexY;
  geometry.userData.reefArchShoulderHeights = shoulderHeights;
  geometry.userData.reefArchCenterlineAsymmetry = centerlineAsymmetry;
  geometry.userData.reefArchErosionAmplitude = EROSION_AMPLITUDE;
  geometry.userData.reefCoralAttachmentSlots = attachmentSlots;
  geometry.userData.reefSupportSurface = true;
  geometry.userData.reefSupportSurfaceKind = 'arch';
  return geometry;
}
