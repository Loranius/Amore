export const REEF_SCENE_PROFILE_VERSION = 'reef-scene-profile-v1';
export const REEF_CAMERA_PASS = 'full-360-orbit-with-reef-overview';
export const REEF_LIGHTING_PASS = 'warm-surface-key-with-cool-water-fill';
export const REEF_PALETTE_PASS = 'light-limestone-living-coral-palette';

export type ReefSceneVec3 = readonly [number, number, number];

export interface ReefCameraFrame {
  readonly mode: 'portrait' | 'wide';
  readonly position: ReefSceneVec3;
  readonly target: ReefSceneVec3;
  readonly distance: number;
  readonly fov: number;
  readonly near: number;
  readonly far: number;
  readonly minDistance: number;
  readonly maxDistance: number;
  readonly minPolarAngle: number;
  readonly maxPolarAngle: number;
  readonly minAzimuthAngle: number;
  readonly maxAzimuthAngle: number;
}

export const REEF_SCENE_PALETTE = Object.freeze({
  background: '#0b5066',
  fog: '#2b7882',
  waterSurface: '#d8edcf',
  waterVeil: '#347d87',
  lightShaft: '#ffe8b8',
  caustic: '#fff2cf',
  particles: '#e8fff6',
  seabed: '#87948b',
  contact: '#36575a',
  rockNear: '#89958c',
  rockHero: '#aaa98f',
  rockDistant: '#5a7b78',
  foundationTop: '#e1d6b7',
  foundationSide: '#b5a685',
  rockEmissive: '#33413a',
  distantEmissive: '#21484a',
} as const);

export const REEF_ATMOSPHERE_PROFILE = Object.freeze({
  fogNear: 7.1,
  fogFar: 30.5,
  surfaceOpacity: 0.105,
  veilOpacity: 0.1,
  toneMappingExposure: 1.1,
} as const);

export const REEF_LIGHTING_PROFILE = Object.freeze({
  ambientIntensity: 0.3,
  hemisphere: {
    skyColor: '#c8f3e3',
    groundColor: '#365963',
    intensity: 1.02,
  },
  key: {
    position: [-4.8, 10.2, 5.8] as ReefSceneVec3,
    color: '#ffe5b2',
    intensity: 2.42,
  },
  fill: {
    position: [5.2, 4.1, 4.4] as ReefSceneVec3,
    color: '#79d4dc',
    intensity: 0.68,
  },
  rim: {
    position: [2.6, 5.8, -7.2] as ReefSceneVec3,
    color: '#77a9cf',
    intensity: 0.4,
  },
} as const);

export const REEF_CAMERA_ORBIT_PROFILE = Object.freeze({
  target: [0, 0.78, 0] as ReefSceneVec3,
  initialAzimuth: -0.08,
  initialPolarAngle: 1.25,
  minAzimuthAngle: Number.NEGATIVE_INFINITY,
  maxAzimuthAngle: Number.POSITIVE_INFINITY,
  minPolarAngle: 0.72,
  maxPolarAngle: 1.48,
  foregroundClearRadius: 3.2,
} as const);

function positionFromSpherical(
  distance: number,
  polarAngle: number,
  azimuth: number,
  target: ReefSceneVec3,
): ReefSceneVec3 {
  const horizontal = Math.sin(polarAngle) * distance;
  return [
    target[0] + Math.sin(azimuth) * horizontal,
    target[1] + Math.cos(polarAngle) * distance,
    target[2] + Math.cos(azimuth) * horizontal,
  ];
}

/**
 * Keeps the whole island readable on narrow phones while allowing a complete
 * orbit around the reef. The polar range stays above the seabed so touch drag
 * can inspect the crown and rear structures without putting the camera below
 * the world surface.
 */
export function reefCameraFrameForAspect(aspect: number): ReefCameraFrame {
  const portrait = !Number.isFinite(aspect) || aspect < 0.72;
  const distance = portrait ? 12.45 : 9.35;
  const target = REEF_CAMERA_ORBIT_PROFILE.target;

  return {
    mode: portrait ? 'portrait' : 'wide',
    position: positionFromSpherical(
      distance,
      REEF_CAMERA_ORBIT_PROFILE.initialPolarAngle,
      REEF_CAMERA_ORBIT_PROFILE.initialAzimuth,
      target,
    ),
    target,
    distance,
    fov: portrait ? 41 : 42,
    near: 0.1,
    far: 44,
    minDistance: portrait ? 10.7 : 8.1,
    maxDistance: portrait ? 14.7 : 12.4,
    minPolarAngle: REEF_CAMERA_ORBIT_PROFILE.minPolarAngle,
    maxPolarAngle: REEF_CAMERA_ORBIT_PROFILE.maxPolarAngle,
    minAzimuthAngle: REEF_CAMERA_ORBIT_PROFILE.minAzimuthAngle,
    maxAzimuthAngle: REEF_CAMERA_ORBIT_PROFILE.maxAzimuthAngle,
  };
}
