import * as THREE from 'three';

export const REEF_FISH_ROUTE_IDS = [
  'Clown1',
  'Clown2',
  'Clown3',
  'blue_tang1',
  'blue_tang2',
  'moorish1',
  'moorish2',
  'Yellow1',
  'Yellow2',
] as const;

export const REEF_FISH_ROUTE_COUNT = REEF_FISH_ROUTE_IDS.length;
export const REEF_FISH_ROUTE_PLAYBACK_RATE = 0.72;

type ReefFishRouteId = (typeof REEF_FISH_ROUTE_IDS)[number];

interface ReefFishRouteTuning {
  phase: number;
  xCenter: number;
  yCenter: number;
  zCenter: number;
}

export interface ReefFishRouteClip {
  clip: THREE.AnimationClip;
  phase: number;
  routeId: ReefFishRouteId;
}

const HORIZONTAL_ROUTE_SPREAD = 1.45;
const VERTICAL_ROUTE_SPREAD = 0.34;
const DEPTH_ROUTE_SPREAD = 0.28;

/**
 * The source asset stores each fish route on its head/root bone in authored
 * model units. These lane centres deliberately distribute the nine fish across
 * the reef and keep their nearest point well behind the mobile camera.
 */
const ROUTE_TUNING: Record<ReefFishRouteId, ReefFishRouteTuning> = {
  Clown1: { phase: 0.04, xCenter: -1500, yCenter: 650, zCenter: -800 },
  Clown2: { phase: 0.38, xCenter: -820, yCenter: 980, zCenter: -200 },
  Clown3: { phase: 0.73, xCenter: -40, yCenter: 1250, zCenter: -1100 },
  blue_tang1: { phase: 0.19, xCenter: 570, yCenter: 820, zCenter: -450 },
  blue_tang2: { phase: 0.61, xCenter: -1945, yCenter: 1450, zCenter: -1250 },
  moorish1: { phase: 0.11, xCenter: -1115, yCenter: 1100, zCenter: -650 },
  moorish2: { phase: 0.49, xCenter: -306, yCenter: 700, zCenter: -100 },
  Yellow1: { phase: 0.29, xCenter: 316, yCenter: 1550, zCenter: -900 },
  Yellow2: { phase: 0.86, xCenter: -990, yCenter: 900, zCenter: -300 },
};

function routeIdFromTrack(track: THREE.KeyframeTrack): ReefFishRouteId | null {
  const separator = track.name.indexOf(':');
  if (separator <= 0) return null;
  const candidate = track.name.slice(0, separator);
  return REEF_FISH_ROUTE_IDS.includes(candidate as ReefFishRouteId)
    ? candidate as ReefFishRouteId
    : null;
}

function isRoutePositionTrack(track: THREE.KeyframeTrack): boolean {
  return track.name.includes(':head.')
    && track.name.endsWith('.position')
    && track.getValueSize() === 3;
}

function componentMean(values: THREE.TypedArray, component: number): number {
  let total = 0;
  let count = 0;
  for (let index = component; index < values.length; index += 3) {
    total += values[index] ?? 0;
    count += 1;
  }
  return count > 0 ? total / count : 0;
}

function retargetRoutePosition(
  source: THREE.KeyframeTrack,
  tuning: ReefFishRouteTuning,
): THREE.KeyframeTrack {
  if (!isRoutePositionTrack(source)) return source;

  const track = source.clone();
  const values = track.values;
  const meanX = componentMean(values, 0);
  const meanY = componentMean(values, 1);
  const meanZ = componentMean(values, 2);

  for (let index = 0; index < values.length; index += 3) {
    const x = values[index] ?? meanX;
    const y = values[index + 1] ?? meanY;
    const z = values[index + 2] ?? meanZ;
    values[index] = tuning.xCenter + (x - meanX) * HORIZONTAL_ROUTE_SPREAD;
    values[index + 1] = tuning.yCenter + (y - meanY) * VERTICAL_ROUTE_SPREAD;
    values[index + 2] = tuning.zCenter + (z - meanZ) * DEPTH_ROUTE_SPREAD;
  }

  return track;
}

/**
 * Splits the single authored school clip into nine independently phased clips.
 * Body, fin and tail tracks remain untouched; only the root route position is
 * widened horizontally and confined to safe open-water height/depth lanes.
 */
export function createReefFishRouteClips(source: THREE.AnimationClip): ReefFishRouteClip[] {
  return REEF_FISH_ROUTE_IDS.map((routeId) => {
    const tuning = ROUTE_TUNING[routeId];
    const tracks = source.tracks
      .filter((track) => routeIdFromTrack(track) === routeId)
      .map((track) => retargetRoutePosition(track, tuning));

    return {
      clip: new THREE.AnimationClip(
        `reef-open-water-${routeId}`,
        source.duration,
        tracks,
        source.blendMode,
      ),
      phase: tuning.phase,
      routeId,
    };
  });
}
