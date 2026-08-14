import { describe, expect, it } from 'vitest';
import {
  buildReefTerracedFoundationGeometry,
  createReefTerracedFoundationProfile,
  REEF_SEABED_Y,
  REEF_TERRACED_FOUNDATION_PASS,
  REEF_TERRACED_FOUNDATION_VERSION,
  sampleReefTerracedFoundation,
} from './reefTerracedFoundation';

function rounded(values: ArrayLike<number>): number[] {
  return Array.from(values, (value) => Number(value.toFixed(6)));
}

describe('reef terraced foundation presentation', () => {
  it('publishes four descending flat tiers and falls back to the seabed outside', () => {
    const profile = createReefTerracedFoundationProfile({
      radius: 3,
      verticalScale: 1.1,
      seed: 26122022,
    });

    expect(profile.version).toBe(REEF_TERRACED_FOUNDATION_VERSION);
    expect(profile.levels.map((level) => level.id)).toEqual([
      'crown',
      'upper',
      'middle',
      'lower',
    ]);
    expect(profile.levels.map((level) => level.height)).toEqual(
      [...profile.levels]
        .map((level) => level.height)
        .sort((left, right) => right - left),
    );

    const center = sampleReefTerracedFoundation(profile, 0, 0);
    const middle = sampleReefTerracedFoundation(profile, profile.radius * 0.62, 0);
    const outer = sampleReefTerracedFoundation(profile, profile.radius * 0.9, 0);
    const seabed = sampleReefTerracedFoundation(profile, profile.radius * 1.2, 0);

    expect(center).toMatchObject({ tier: 'crown', onFoundation: true });
    expect(middle.height).toBeLessThan(center.height);
    expect(outer.height).toBeLessThan(middle.height);
    expect(seabed).toEqual({
      height: REEF_SEABED_Y,
      tier: 'seabed',
      onFoundation: false,
    });
  });

  it('builds one bounded two-material support shell with valid normals', () => {
    const profile = createReefTerracedFoundationProfile({
      radius: 2.8,
      verticalScale: 1.18,
      seed: 918273,
    });
    const geometry = buildReefTerracedFoundationGeometry(profile);
    const position = geometry.getAttribute('position');
    const normal = geometry.getAttribute('normal');

    expect(position.count).toBeGreaterThan(500);
    expect(position.count).toBeLessThan(5_000);
    expect(geometry.groups).toHaveLength(2);
    expect(geometry.groups.map((group) => group.materialIndex)).toEqual([0, 1]);
    expect(geometry.userData.reefTerracedFoundationVersion).toBe(
      REEF_TERRACED_FOUNDATION_VERSION,
    );
    expect(geometry.userData.reefTerracedFoundationPass).toBe(
      REEF_TERRACED_FOUNDATION_PASS,
    );
    expect(geometry.userData.reefTerracedFoundationDrawCalls).toBe(2);
    expect(geometry.boundingBox?.max.y).toBeCloseTo(profile.levels[0]?.height ?? 0, 5);
    expect(geometry.boundingBox?.min.y).toBeCloseTo(profile.floorY, 5);

    for (let index = 0; index < normal.count; index += 1) {
      expect(Math.hypot(normal.getX(index), normal.getY(index), normal.getZ(index))).toBeCloseTo(1, 4);
    }

    geometry.dispose();
  });

  it('is deterministic, while identity seeds retain distinct eroded silhouettes', () => {
    const firstProfile = createReefTerracedFoundationProfile({
      radius: 2.6,
      verticalScale: 1,
      seed: 42,
    });
    const secondProfile = createReefTerracedFoundationProfile({
      radius: 2.6,
      verticalScale: 1,
      seed: 43,
    });
    const first = buildReefTerracedFoundationGeometry(firstProfile);
    const repeated = buildReefTerracedFoundationGeometry(firstProfile);
    const second = buildReefTerracedFoundationGeometry(secondProfile);
    const firstPositions = rounded(first.getAttribute('position').array);

    expect(rounded(repeated.getAttribute('position').array)).toEqual(firstPositions);
    expect(rounded(second.getAttribute('position').array)).not.toEqual(firstPositions);

    first.dispose();
    repeated.dispose();
    second.dispose();
  });
});
