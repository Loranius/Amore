import {
  BufferGeometry,
  Float32BufferAttribute,
} from 'three';

export const REEF_TERRACED_FOUNDATION_VERSION = 'reef-terraced-foundation-v3';
export const REEF_TERRACED_FOUNDATION_PASS = 'asymmetric-limestone-shelf-basin-macro-relief';
export const REEF_SEABED_Y = -0.36;

export type ReefTerraceTier = 'crown' | 'upper' | 'middle' | 'lower' | 'seabed';

export interface ReefTerracedFoundationLevel {
  id: Exclude<ReefTerraceTier, 'seabed'>;
  height: number;
  plateauRadiusRatio: number;
  toeRadiusRatio: number;
}

export interface ReefTerracedFoundationProfile {
  version: typeof REEF_TERRACED_FOUNDATION_VERSION;
  seed: number;
  radius: number;
  floorY: number;
  levels: readonly ReefTerracedFoundationLevel[];
}

export interface ReefTerracedSurfaceSample {
  height: number;
  tier: ReefTerraceTier;
  onFoundation: boolean;
}

const TAU = Math.PI * 2;
const DEFAULT_SEGMENT_COUNT = 72;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smoothstep01(value: number): number {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
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

function tierIrregularity(level: ReefTerracedFoundationLevel): number {
  switch (level.id) {
    case 'crown': return 0.82;
    case 'upper': return 0.94;
    case 'middle': return 1.08;
    case 'lower': return 1;
  }
}

function tierShelfStrength(level: ReefTerracedFoundationLevel): number {
  switch (level.id) {
    case 'crown': return 0.018;
    case 'upper': return 0.038;
    case 'middle': return 0.066;
    case 'lower': return 0.052;
  }
}

function angularLobe(angle: number, center: number, power: number): number {
  return Math.pow(Math.max(0, Math.cos(angle - center)), power);
}

/**
 * All tiers inherit one large geological axis before their own small erosion
 * noise is applied. This keeps the substrate reading as one weathered limestone
 * body rather than four concentric procedural rings.
 */
function boundaryRadius(
  profile: ReefTerracedFoundationProfile,
  level: ReefTerracedFoundationLevel,
  boundary: 'plateau' | 'toe',
  angle: number,
): number {
  const ratio = boundary === 'plateau'
    ? level.plateauRadiusRatio
    : level.toeRadiusRatio;
  const key = level.id;
  const amplitude = tierIrregularity(level);

  const substrateAxis = stableUnit(profile.seed, 'substrate:macro-axis') * TAU;
  const headlandAxis = substrateAxis
    + (stableUnit(profile.seed, 'substrate:headland-offset') - 0.5) * 0.62;
  const kidneyPhase = stableUnit(profile.seed, 'substrate:kidney-phase') * TAU;
  const tierPrimaryPhase = stableUnit(profile.seed, `${key}:primary`) * TAU;
  const tierSecondaryPhase = stableUnit(profile.seed, `${key}:secondary`) * TAU;
  const erosionPhase = stableUnit(profile.seed, `${key}:erosion`) * TAU;
  const boundaryPhase = stableUnit(profile.seed, `${key}:${boundary}:micro`) * TAU;

  const broadAxis = Math.cos(angle - substrateAxis) * 0.036;
  const kidney = Math.sin((angle - substrateAxis) * 2 + kidneyPhase) * 0.032;
  const headland = angularLobe(angle, headlandAxis, 3.2)
    * tierShelfStrength(level)
    * (boundary === 'toe' ? 1.12 : 1);
  const compressedFlank = -angularLobe(angle, headlandAxis + Math.PI, 3.8)
    * (0.038 + amplitude * 0.012);

  const primary = Math.sin(angle * 2 + tierPrimaryPhase) * 0.03 * amplitude;
  const secondary = Math.sin(angle * 5 - tierSecondaryPhase) * 0.016 * amplitude;
  const erosionWave = Math.max(0, Math.sin(angle * 3 + erosionPhase));
  const erosion = -Math.pow(erosionWave, 7) * 0.045 * amplitude;
  const micro = Math.sin(angle * 9 + boundaryPhase) * (
    boundary === 'plateau' ? 0.008 : 0.006
  );

  const silhouette = Math.min(
    1.095,
    Math.max(
      0.805,
      1
        + broadAxis
        + kidney
        + headland
        + compressedFlank
        + primary
        + secondary
        + erosion
        + micro,
    ),
  );

  return profile.radius * ratio * silhouette;
}

export function createReefTerracedFoundationProfile({
  radius,
  verticalScale,
  seed,
  floorY = REEF_SEABED_Y,
}: {
  radius: number;
  verticalScale: number;
  seed: number;
  floorY?: number;
}): ReefTerracedFoundationProfile {
  const boundedRadius = Math.max(1.2, radius);
  const boundedVerticalScale = Math.max(0.82, Math.min(1.42, verticalScale));

  return {
    version: REEF_TERRACED_FOUNDATION_VERSION,
    seed,
    radius: boundedRadius,
    floorY,
    levels: [
      {
        id: 'crown',
        height: floorY + 1.16 * boundedVerticalScale,
        plateauRadiusRatio: 0.255,
        toeRadiusRatio: 0.325,
      },
      {
        id: 'upper',
        height: floorY + 0.8 * boundedVerticalScale,
        plateauRadiusRatio: 0.47,
        toeRadiusRatio: 0.55,
      },
      {
        id: 'middle',
        height: floorY + 0.46 * boundedVerticalScale,
        plateauRadiusRatio: 0.69,
        toeRadiusRatio: 0.8,
      },
      {
        id: 'lower',
        height: floorY + 0.18 * boundedVerticalScale,
        plateauRadiusRatio: 0.96,
        toeRadiusRatio: 1.055,
      },
    ],
  };
}

/**
 * Low-frequency macro relief layered over the terrace heights. One shallow
 * basin, an offset secondary hollow and an opposing ridge break the stacked-
 * wedding-cake profile without changing the deterministic growth topology.
 */
function macroReliefOffset(
  profile: ReefTerracedFoundationProfile,
  x: number,
  z: number,
): number {
  const crown = profile.levels[0];
  if (!crown) return 0;

  const relief = Math.max(0.001, crown.height - profile.floorY);
  const axis = stableUnit(profile.seed, 'substrate:macro-axis') * TAU;
  const cosine = Math.cos(axis);
  const sine = Math.sin(axis);
  const localX = (x * cosine + z * sine) / profile.radius;
  const localZ = (-x * sine + z * cosine) / profile.radius;
  const radialRatio = Math.hypot(x, z) / profile.radius;

  const basinCenterX = 0.14
    + (stableUnit(profile.seed, 'substrate:basin-x') - 0.5) * 0.12;
  const basinCenterZ = -0.12
    + (stableUnit(profile.seed, 'substrate:basin-z') - 0.5) * 0.12;
  const basinX = (localX - basinCenterX) / 0.31;
  const basinZ = (localZ - basinCenterZ) / 0.235;
  const basin = Math.exp(-(basinX * basinX + basinZ * basinZ) * 1.55);

  const hollowCenterX = -0.29
    + (stableUnit(profile.seed, 'substrate:hollow-x') - 0.5) * 0.1;
  const hollowCenterZ = -0.03
    + (stableUnit(profile.seed, 'substrate:hollow-z') - 0.5) * 0.16;
  const hollowX = (localX - hollowCenterX) / 0.24;
  const hollowZ = (localZ - hollowCenterZ) / 0.2;
  const hollow = Math.exp(-(hollowX * hollowX + hollowZ * hollowZ) * 1.85);

  const ridgeCenterX = -0.18
    + (stableUnit(profile.seed, 'substrate:ridge-x') - 0.5) * 0.1;
  const ridgeCenterZ = 0.22
    + (stableUnit(profile.seed, 'substrate:ridge-z') - 0.5) * 0.1;
  const ridgeX = (localX - ridgeCenterX) / 0.36;
  const ridgeZ = (localZ - ridgeCenterZ) / 0.24;
  const ridge = Math.exp(-(ridgeX * ridgeX + ridgeZ * ridgeZ) * 1.45);

  const shelfCenterX = 0.38;
  const shelfCenterZ = 0.12
    + (stableUnit(profile.seed, 'substrate:shelf-z') - 0.5) * 0.12;
  const shelfX = (localX - shelfCenterX) / 0.38;
  const shelfZ = (localZ - shelfCenterZ) / 0.28;
  const shelfBench = Math.exp(-(shelfX * shelfX + shelfZ * shelfZ) * 1.7);

  const radialWavePhase = stableUnit(profile.seed, 'substrate:relief-wave') * TAU;
  const radialWave = Math.sin(
    radialRatio * 5.4 + Math.atan2(z, x) * 2 + radialWavePhase,
  ) * 0.009;

  // Macro relief fades out before the outer toe so the limestone shell still
  // closes cleanly into the seabed and never creates a floating perimeter.
  const edgeFade = 1 - smoothstep01((radialRatio - 0.76) / 0.29);
  const offsetRatio = (
    ridge * 0.046
    + shelfBench * 0.018
    - basin * 0.068
    - hollow * 0.035
    + radialWave
  ) * edgeFade;

  return relief * Math.max(-0.082, Math.min(0.058, offsetRatio));
}

function applyMacroRelief(
  profile: ReefTerracedFoundationProfile,
  baseHeight: number,
  x: number,
  z: number,
): number {
  if (baseHeight <= profile.floorY + 1e-6) return profile.floorY;
  const crown = profile.levels[0];
  if (!crown) return baseHeight;
  const relief = crown.height - profile.floorY;
  return Math.max(
    profile.floorY + 0.003,
    Math.min(crown.height + relief * 0.055, baseHeight + macroReliefOffset(profile, x, z)),
  );
}

export function sampleReefTerracedFoundation(
  profile: ReefTerracedFoundationProfile,
  x: number,
  z: number,
): ReefTerracedSurfaceSample {
  const radialDistance = Math.hypot(x, z);
  const angle = radialDistance <= 1e-8 ? 0 : Math.atan2(z, x);

  for (let index = 0; index < profile.levels.length; index += 1) {
    const level = profile.levels[index];
    if (!level) continue;
    const plateauRadius = boundaryRadius(profile, level, 'plateau', angle);
    const toeRadius = boundaryRadius(profile, level, 'toe', angle);
    const nextHeight = profile.levels[index + 1]?.height ?? profile.floorY;

    if (radialDistance <= plateauRadius) {
      return {
        height: applyMacroRelief(profile, level.height, x, z),
        tier: level.id,
        onFoundation: true,
      };
    }
    if (radialDistance <= toeRadius) {
      const progress = smoothstep01(
        (radialDistance - plateauRadius) / Math.max(1e-6, toeRadius - plateauRadius),
      );
      const baseHeight = level.height + (nextHeight - level.height) * progress;
      return {
        height: applyMacroRelief(profile, baseHeight, x, z),
        tier: level.id,
        onFoundation: true,
      };
    }
  }

  return { height: profile.floorY, tier: 'seabed', onFoundation: false };
}

type Point = readonly [number, number, number];

function appendTriangle(
  positions: number[],
  uvs: number[],
  first: Point,
  second: Point,
  third: Point,
  radius: number,
): void {
  for (const point of [first, second, third]) {
    positions.push(point[0], point[1], point[2]);
    uvs.push(
      0.5 + point[0] / (radius * 2.28),
      0.5 + point[2] / (radius * 2.28),
    );
  }
}

function pointAtRadius(
  profile: ReefTerracedFoundationProfile,
  radius: number,
  angle: number,
): Point {
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;
  const sample = sampleReefTerracedFoundation(profile, x, z);
  return [x, sample.height, z];
}

function ringPoint(
  profile: ReefTerracedFoundationProfile,
  level: ReefTerracedFoundationLevel,
  boundary: 'plateau' | 'toe',
  angle: number,
): Point {
  return pointAtRadius(profile, boundaryRadius(profile, level, boundary, angle), angle);
}

function interpolatedRingPoint(
  profile: ReefTerracedFoundationProfile,
  innerRadius: number,
  outerRadius: number,
  angle: number,
  progress: number,
): Point {
  return pointAtRadius(
    profile,
    innerRadius + (outerRadius - innerRadius) * progress,
    angle,
  );
}

/**
 * Builds one compact two-material shell. Extra top-surface rings sample the same
 * deterministic height function used by arch/outcrop placement, so broad basins
 * and ledges are visible geometry rather than a renderer-only illusion.
 */
export function buildReefTerracedFoundationGeometry(
  profile: ReefTerracedFoundationProfile,
  segmentCount = DEFAULT_SEGMENT_COUNT,
): BufferGeometry {
  const segments = Math.max(28, Math.floor(segmentCount));
  const topPositions: number[] = [];
  const topUvs: number[] = [];
  const sidePositions: number[] = [];
  const sideUvs: number[] = [];
  const crown = profile.levels[0];
  if (!crown) throw new Error('Reef terraced foundation requires a crown level.');

  const centerSample = sampleReefTerracedFoundation(profile, 0, 0);
  const center: Point = [0, centerSample.height, 0];

  for (let segment = 0; segment < segments; segment += 1) {
    const angle = segment / segments * TAU;
    const nextAngle = (segment + 1) / segments * TAU;
    const crownRadius = boundaryRadius(profile, crown, 'plateau', angle);
    const crownNextRadius = boundaryRadius(profile, crown, 'plateau', nextAngle);
    const innerCurrent = pointAtRadius(profile, crownRadius * 0.52, angle);
    const innerNext = pointAtRadius(profile, crownNextRadius * 0.52, nextAngle);
    const crownCurrent = ringPoint(profile, crown, 'plateau', angle);
    const crownNext = ringPoint(profile, crown, 'plateau', nextAngle);

    appendTriangle(topPositions, topUvs, center, innerNext, innerCurrent, profile.radius);
    appendTriangle(topPositions, topUvs, innerCurrent, innerNext, crownNext, profile.radius);
    appendTriangle(topPositions, topUvs, innerCurrent, crownNext, crownCurrent, profile.radius);
  }

  profile.levels.forEach((level, index) => {
    const nextLevel = profile.levels[index + 1];

    for (let segment = 0; segment < segments; segment += 1) {
      const angle = segment / segments * TAU;
      const nextAngle = (segment + 1) / segments * TAU;
      const plateauCurrent = ringPoint(profile, level, 'plateau', angle);
      const plateauNext = ringPoint(profile, level, 'plateau', nextAngle);
      const toeCurrent = ringPoint(profile, level, 'toe', angle);
      const toeNext = ringPoint(profile, level, 'toe', nextAngle);

      appendTriangle(sidePositions, sideUvs, plateauCurrent, plateauNext, toeNext, profile.radius);
      appendTriangle(sidePositions, sideUvs, plateauCurrent, toeNext, toeCurrent, profile.radius);

      if (nextLevel) {
        const nextPlateauCurrentRadius = boundaryRadius(
          profile,
          nextLevel,
          'plateau',
          angle,
        );
        const nextPlateauNextRadius = boundaryRadius(
          profile,
          nextLevel,
          'plateau',
          nextAngle,
        );
        const toeCurrentRadius = boundaryRadius(profile, level, 'toe', angle);
        const toeNextRadius = boundaryRadius(profile, level, 'toe', nextAngle);
        const shelfCurrent = interpolatedRingPoint(
          profile,
          toeCurrentRadius,
          nextPlateauCurrentRadius,
          angle,
          0.54,
        );
        const shelfNext = interpolatedRingPoint(
          profile,
          toeNextRadius,
          nextPlateauNextRadius,
          nextAngle,
          0.54,
        );
        const outerCurrent = ringPoint(profile, nextLevel, 'plateau', angle);
        const outerNext = ringPoint(profile, nextLevel, 'plateau', nextAngle);

        appendTriangle(topPositions, topUvs, toeCurrent, toeNext, shelfNext, profile.radius);
        appendTriangle(topPositions, topUvs, toeCurrent, shelfNext, shelfCurrent, profile.radius);
        appendTriangle(topPositions, topUvs, shelfCurrent, shelfNext, outerNext, profile.radius);
        appendTriangle(topPositions, topUvs, shelfCurrent, outerNext, outerCurrent, profile.radius);
      }
    }
  });

  const positions = [...topPositions, ...sidePositions];
  const uvs = [...topUvs, ...sideUvs];
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  geometry.addGroup(0, topPositions.length / 3, 0);
  geometry.addGroup(topPositions.length / 3, sidePositions.length / 3, 1);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.reefTerracedFoundationVersion = profile.version;
  geometry.userData.reefTerracedFoundationPass = REEF_TERRACED_FOUNDATION_PASS;
  geometry.userData.reefTerracedFoundationSegments = segments;
  geometry.userData.reefTerracedFoundationDrawCalls = 2;
  geometry.userData.reefTerracedFoundationMacroRelief = true;
  return geometry;
}
