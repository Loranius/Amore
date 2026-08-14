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
  const targetName = sanitizedTrackTargetName(track);
  return REEF_FISH_ROUTE_IDS.find((routeId) => targetName.startsWith(routeId)) ?? null;
}

function trackTargetName(track: THREE.KeyframeTrack): string {
  const propertySeparator = track.name.lastIndexOf('.');
  return propertySeparator > 0 ? track.name.slice(0, propertySeparator) : track.name;
}

function sanitizedTrackTargetName(track: THREE.KeyframeTrack): string {
  // GLTFLoader sanitizes node names before AnimationClips reach the app. The
  // authored `Clown1:head.6_10` therefore arrives as `Clown1head6_10`.
  // Normalizing here supports both the raw asset convention and the runtime
  // convention instead of coupling route discovery to punctuation that no
  // longer exists after loading.
  return THREE.PropertyBinding.sanitizeNodeName(trackTargetName(track));
}

function routeBoneName(track: THREE.KeyframeTrack, routeId: ReefFishRouteId): string {
  return sanitizedTrackTargetName(track).slice(routeId.length);
}

function isRoutePositionTrack(
  track: THREE.KeyframeTrack,
  routeId: ReefFishRouteId,
): boolean {
  if (!track.name.endsWith('.position') || track.getValueSize() !== 3) return false;

  const boneName = routeBoneName(track, routeId);
  // The asset authors the same world-space route on the head and first spine
  // carrier. Retargeting both keeps the rig coherent. Descendant bones such as
  // head_End and Spine_02 remain untouched.
  return /^head(?:\d|$)/.test(boneName) || /^Spine_01(?:\d|$)/.test(boneName);
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
  routeId: ReefFishRouteId,
  tuning: ReefFishRouteTuning,
  referenceMean: readonly [number, number, number] | null,
): THREE.KeyframeTrack {
  if (!referenceMean || !isRoutePositionTrack(source, routeId)) return source;

  const track = source.clone();
  const values = track.values;
  const [meanX, meanY, meanZ] = referenceMean;

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
    const sourceTracks = source.tracks.filter((track) => routeIdFromTrack(track) === routeId);
    const routePositionTracks = sourceTracks.filter(
      (track) => isRoutePositionTrack(track, routeId),
    );
    const referenceTrack = routePositionTracks.find(
      (track) => /^head(?:\d|$)/.test(routeBoneName(track, routeId)),
    ) ?? routePositionTracks[0];
    const referenceMean = referenceTrack
      ? [
          componentMean(referenceTrack.values, 0),
          componentMean(referenceTrack.values, 1),
          componentMean(referenceTrack.values, 2),
        ] as const
      : null;
    const tracks = sourceTracks.map(
      (track) => retargetRoutePosition(track, routeId, tuning, referenceMean),
    );

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
