export const REEF_SCENE_PROFILE_VERSION = 'reef-scene-profile-v2-360-visual-pass';
export const REEF_CAMERA_PASS = 'slow-auto-360-orbit-with-reef-overview';
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
  background: '#0b566b',
  fog: '#347f87',
  waterSurface: '#d8edcf',
  waterVeil: '#347d87',
  lightShaft: '#ffe8b8',
  caustic: '#fff2cf',
  particles: '#e8fff6',
  seabed: '#87948b',
  contact: '#36575a',
  rockNear: '#89958c',
  rockHero: '#aaa98f',
  rockDistant: '#78847d',
  foundationTop: '#e1d6b7',
  foundationSide: '#b5a685',
  rockEmissive: '#33413a',
  distantEmissive: '#294a47',
} as const);

export const REEF_ATMOSPHERE_PROFILE = Object.freeze({
  fogNear: 5.8,
  fogFar: 22.5,
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
  /**
   * Drei/three OrbitControls default speed 2 ~= one turn per 30 s.
   * 0.32 keeps the reef observably alive without turning the landing screen
   * into a carousel: roughly one complete inspection orbit every 3 minutes.
   */
  autoRotateSpeed: 0.32,
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
 * Keeps the hero reef dominant on narrow phones while allowing a complete
 * orbit around it. The polar range stays above the seabed so touch drag can
 * inspect crown and rear structures without putting the camera underground.
 */
export function reefCameraFrameForAspect(aspect: number): ReefCameraFrame {
  const portrait = !Number.isFinite(aspect) || aspect < 0.72;
  const distance = portrait ? 11.2 : 8.4;
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
    far: 40,
    minDistance: portrait ? 9.6 : 7.2,
    maxDistance: portrait ? 14 : 11.8,
    minPolarAngle: REEF_CAMERA_ORBIT_PROFILE.minPolarAngle,
    maxPolarAngle: REEF_CAMERA_ORBIT_PROFILE.maxPolarAngle,
    minAzimuthAngle: REEF_CAMERA_ORBIT_PROFILE.minAzimuthAngle,
    maxAzimuthAngle: REEF_CAMERA_ORBIT_PROFILE.maxAzimuthAngle,
  };
}
