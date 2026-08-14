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
export const REEF_FISH_ROUTE_PLAYBACK_RATE = 0.55;

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

// The visible school is now roughly half its previous size. Compensate by
// widening the authored root motion so each fish still travels substantially
// farther in world space. Depth grows the most: the fish should orbit around
// the reef instead of reading as one flat band in front of it.
const HORIZONTAL_ROUTE_SPREAD = 4.6;
const VERTICAL_ROUTE_SPREAD = 0.42;
const DEPTH_ROUTE_SPREAD = 1.25;

/**
 * The source asset stores each fish route on its head/root bone in authored
 * model units. These lane centres distribute the nine fish across separate
 * broad open-water corridors around the reef. Their phases and depth offsets
 * intentionally keep the school from bunching over the hero platform.
 */
const ROUTE_TUNING: Record<ReefFishRouteId, ReefFishRouteTuning> = {
  Clown1: { phase: 0.03, xCenter: -2500, yCenter: 680, zCenter: -1550 },
  Clown2: { phase: 0.36, xCenter: -900, yCenter: 1030, zCenter: -2550 },
  Clown3: { phase: 0.7, xCenter: 1250, yCenter: 1320, zCenter: -1900 },
  blue_tang1: { phase: 0.18, xCenter: 2700, yCenter: 860, zCenter: -900 },
  blue_tang2: { phase: 0.59, xCenter: -3300, yCenter: 1480, zCenter: -3150 },
  moorish1: { phase: 0.1, xCenter: -1850, yCenter: 1130, zCenter: -760 },
  moorish2: { phase: 0.47, xCenter: 850, yCenter: 760, zCenter: -3000 },
  Yellow1: { phase: 0.28, xCenter: 3200, yCenter: 1580, zCenter: -2200 },
  Yellow2: { phase: 0.84, xCenter: -250, yCenter: 940, zCenter: -650 },
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
 * widened into broad open-water loops with distinct height/depth lanes.
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
