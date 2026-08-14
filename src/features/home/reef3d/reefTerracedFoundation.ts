import {
  BufferGeometry,
  Float32BufferAttribute,
} from 'three';

export const REEF_TERRACED_FOUNDATION_VERSION = 'reef-terraced-foundation-v1';
export const REEF_TERRACED_FOUNDATION_PASS = 'light-continuous-terraces';
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
const DEFAULT_SEGMENT_COUNT = 56;

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

function boundaryRadius(
  profile: ReefTerracedFoundationProfile,
  level: ReefTerracedFoundationLevel,
  boundary: 'plateau' | 'toe',
  angle: number,
): number {
  const ratio = boundary === 'plateau'
    ? level.plateauRadiusRatio
    : level.toeRadiusRatio;
  const key = `${level.id}:${boundary}`;
  const primaryPhase = stableUnit(profile.seed, `${key}:primary`) * TAU;
  const secondaryPhase = stableUnit(profile.seed, `${key}:secondary`) * TAU;
  const erosionPhase = stableUnit(profile.seed, `${key}:erosion`) * TAU;
  const primary = Math.sin(angle * 3 + primaryPhase) * 0.025;
  const secondary = Math.sin(angle * 7 - secondaryPhase) * 0.014;
  const micro = Math.sin(angle * 11 + primaryPhase * 0.57) * 0.006;
  const erosionWave = Math.max(0, Math.sin(angle * 5 + erosionPhase));
  const erosion = -Math.pow(erosionWave, 8) * 0.025;
  return profile.radius * ratio * (1 + primary + secondary + micro + erosion);
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
        plateauRadiusRatio: 0.26,
        toeRadiusRatio: 0.315,
      },
      {
        id: 'upper',
        height: floorY + 0.82 * boundedVerticalScale,
        plateauRadiusRatio: 0.49,
        toeRadiusRatio: 0.545,
      },
      {
        id: 'middle',
        height: floorY + 0.49 * boundedVerticalScale,
        plateauRadiusRatio: 0.73,
        toeRadiusRatio: 0.79,
      },
      {
        id: 'lower',
        height: floorY + 0.21 * boundedVerticalScale,
        plateauRadiusRatio: 1,
        toeRadiusRatio: 1.035,
      },
    ],
  };
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
      return { height: level.height, tier: level.id, onFoundation: true };
    }
    if (radialDistance <= toeRadius) {
      const progress = smoothstep01(
        (radialDistance - plateauRadius) / Math.max(1e-6, toeRadius - plateauRadius),
      );
      return {
        height: level.height + (nextHeight - level.height) * progress,
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
      0.5 + point[0] / (radius * 2.16),
      0.5 + point[2] / (radius * 2.16),
    );
  }
}

function ringPoint(
  profile: ReefTerracedFoundationProfile,
  level: ReefTerracedFoundationLevel,
  boundary: 'plateau' | 'toe',
  angle: number,
  height: number,
): Point {
  const radius = boundaryRadius(profile, level, boundary, angle);
  return [Math.cos(angle) * radius, height, Math.sin(angle) * radius];
}

/**
 * Builds one compact two-material shell. Flat annuli and eroded scarps use
 * separate non-indexed triangles so terrace rims stay crisp without extra
 * meshes or per-frame work.
 */
export function buildReefTerracedFoundationGeometry(
  profile: ReefTerracedFoundationProfile,
  segmentCount = DEFAULT_SEGMENT_COUNT,
): BufferGeometry {
  const segments = Math.max(24, Math.floor(segmentCount));
  const topPositions: number[] = [];
  const topUvs: number[] = [];
  const sidePositions: number[] = [];
  const sideUvs: number[] = [];
  const crown = profile.levels[0];
  if (!crown) throw new Error('Reef terraced foundation requires a crown level.');

  for (let segment = 0; segment < segments; segment += 1) {
    const angle = segment / segments * TAU;
    const nextAngle = (segment + 1) / segments * TAU;
    appendTriangle(
      topPositions,
      topUvs,
      [0, crown.height, 0],
      ringPoint(profile, crown, 'plateau', nextAngle, crown.height),
      ringPoint(profile, crown, 'plateau', angle, crown.height),
      profile.radius,
    );
  }

  profile.levels.forEach((level, index) => {
    const nextLevel = profile.levels[index + 1];
    const nextHeight = nextLevel?.height ?? profile.floorY;

    for (let segment = 0; segment < segments; segment += 1) {
      const angle = segment / segments * TAU;
      const nextAngle = (segment + 1) / segments * TAU;
      const plateauCurrent = ringPoint(profile, level, 'plateau', angle, level.height);
      const plateauNext = ringPoint(profile, level, 'plateau', nextAngle, level.height);
      const toeCurrent = ringPoint(profile, level, 'toe', angle, nextHeight);
      const toeNext = ringPoint(profile, level, 'toe', nextAngle, nextHeight);

      appendTriangle(
        sidePositions,
        sideUvs,
        plateauCurrent,
        plateauNext,
        toeNext,
        profile.radius,
      );
      appendTriangle(
        sidePositions,
        sideUvs,
        plateauCurrent,
        toeNext,
        toeCurrent,
        profile.radius,
      );

      if (nextLevel) {
        const outerCurrent = ringPoint(
          profile,
          nextLevel,
          'plateau',
          angle,
          nextLevel.height,
        );
        const outerNext = ringPoint(
          profile,
          nextLevel,
          'plateau',
          nextAngle,
          nextLevel.height,
        );
        appendTriangle(
          topPositions,
          topUvs,
          toeCurrent,
          toeNext,
          outerNext,
          profile.radius,
        );
        appendTriangle(
          topPositions,
          topUvs,
          toeCurrent,
          outerNext,
          outerCurrent,
          profile.radius,
        );
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
  return geometry;
}
