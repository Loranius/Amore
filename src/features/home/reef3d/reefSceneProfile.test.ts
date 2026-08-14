import { describe, expect, it } from 'vitest';
import {
  reefCameraFrameForAspect,
  REEF_ATMOSPHERE_PROFILE,
  REEF_CAMERA_ORBIT_PROFILE,
  REEF_LIGHTING_PROFILE,
  REEF_SCENE_PALETTE,
} from './reefSceneProfile';

function sphericalAngles(
  position: readonly [number, number, number],
  target: readonly [number, number, number],
): { distance: number; polar: number; azimuth: number } {
  const x = position[0] - target[0];
  const y = position[1] - target[1];
  const z = position[2] - target[2];
  const distance = Math.hypot(x, y, z);
  return {
    distance,
    polar: Math.acos(y / distance),
    azimuth: Math.atan2(x, z),
  };
}

function luminance(hex: string): number {
  const value = Number.parseInt(hex.slice(1), 16);
  const channels = [value >> 16, value >> 8, value].map((channel) => {
    const srgb = (channel & 0xff) / 255;
    return srgb <= 0.04045
      ? srgb / 12.92
      : ((srgb + 0.055) / 1.055) ** 2.4;
  });
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
}

describe('reef final scene profile', () => {
  it('keeps every initial camera inside the bounded front orbit', () => {
    for (const aspect of [0.48, 0.71, 0.72, 1, 1.78]) {
      const frame = reefCameraFrameForAspect(aspect);
      const angles = sphericalAngles(frame.position, frame.target);

      expect(angles.distance).toBeCloseTo(frame.distance, 8);
      expect(angles.azimuth).toBeGreaterThanOrEqual(frame.minAzimuthAngle);
      expect(angles.azimuth).toBeLessThanOrEqual(frame.maxAzimuthAngle);
      expect(angles.polar).toBeGreaterThanOrEqual(frame.minPolarAngle);
      expect(angles.polar).toBeLessThanOrEqual(frame.maxPolarAngle);
      expect(frame.near).toBeGreaterThan(0);
      expect(frame.far).toBeGreaterThan(REEF_ATMOSPHERE_PROFILE.fogFar);
    }
  });

  it('uses a narrower-than-quarter-turn arc and a higher terrace-reading angle', () => {
    expect(
      REEF_CAMERA_ORBIT_PROFILE.maxAzimuthAngle
        - REEF_CAMERA_ORBIT_PROFILE.minAzimuthAngle,
    ).toBeLessThan(Math.PI / 2);
    expect(REEF_CAMERA_ORBIT_PROFILE.maxPolarAngle).toBeLessThan(1.4);
    expect(REEF_CAMERA_ORBIT_PROFILE.foregroundClearRadius).toBeGreaterThanOrEqual(3);
    expect(reefCameraFrameForAspect(0.5).distance)
      .toBeGreaterThan(reefCameraFrameForAspect(1).distance);
  });

  it('keeps limestone brighter than the water field and separates warm key from cool fill', () => {
    expect(luminance(REEF_SCENE_PALETTE.foundationTop))
      .toBeGreaterThan(luminance(REEF_SCENE_PALETTE.foundationSide));
    expect(luminance(REEF_SCENE_PALETTE.foundationSide))
      .toBeGreaterThan(luminance(REEF_SCENE_PALETTE.rockDistant));
    expect(luminance(REEF_SCENE_PALETTE.rockDistant))
      .toBeGreaterThan(luminance(REEF_SCENE_PALETTE.background));

    const key = Number.parseInt(REEF_LIGHTING_PROFILE.key.color.slice(1), 16);
    const fill = Number.parseInt(REEF_LIGHTING_PROFILE.fill.color.slice(1), 16);
    expect((key >> 16) & 0xff).toBeGreaterThan(key & 0xff);
    expect(fill & 0xff).toBeGreaterThan((fill >> 16) & 0xff);
    expect(REEF_ATMOSPHERE_PROFILE.toneMappingExposure).toBeGreaterThan(1);
  });
});
