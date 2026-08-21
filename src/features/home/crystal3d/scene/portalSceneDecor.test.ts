import { describe, expect, it } from 'vitest';
import { PORTAL_RELIC_OUTER_RADIUS } from './portalRelicPedestal';
import {
  PORTAL_BANNER_COUNT,
  PORTAL_CELESTIAL_ARC_COUNT,
  PORTAL_CELESTIAL_ARC_SEGMENTS,
  PORTAL_CRYSTAL_LAMP_COUNT,
  PORTAL_DECOR_DRAW_CALLS,
  PORTAL_GROUND_CLUSTER_COUNT,
  PORTAL_GROUND_DECOR_CLEARANCE,
  PORTAL_VINE_COUNT,
  buildPortalCelestialArcGeometry,
  buildPortalColonnadeDecorGeometry,
  buildPortalCrystalLampGeometry,
  buildPortalGroundDecorGeometry,
  buildPortalHazeField,
  portalBannerPillars,
  portalCrystalLampPlacements,
  portalGroundClusterPlacements,
  portalVinePillars,
} from './portalSceneDecor';
import { PORTAL_TEMPLE_FLOOR_Y, portalCameraFrame, portalPillarInstances } from './portalScene';

const FLOOR_Y = PORTAL_TEMPLE_FLOOR_Y;
const PALETTE = {
  rock: '#b9b3a9',
  rockAccent: '#d1c9ba',
  moss: '#82956f',
  grass: '#6f875d',
  plinth: '#c8c0b0',
};
const COLONNADE_PALETTE = {
  banner: '#8172a5',
  vine: '#4f7654',
  vineAccent: '#71926a',
};

function triangles(geometry: ReturnType<typeof buildPortalGroundDecorGeometry>): number {
  const index = geometry.getIndex();
  return index === null
    ? geometry.getAttribute('position').count / 3
    : index.count / 3;
}

describe('portal ground decor', () => {
  it('is deterministic per couple but not shared by every couple', () => {
    const first = portalGroundClusterPlacements(4242, 1.2, FLOOR_Y);
    expect(portalGroundClusterPlacements(4242, 1.2, FLOOR_Y)).toEqual(first);
    expect(portalGroundClusterPlacements(4243, 1.2, FLOOR_Y)).not.toEqual(first);
    expect(first).toHaveLength(PORTAL_GROUND_CLUSTER_COUNT);
  });

  it('never grows scenery through the metal reliquary', () => {
    for (const scale of [1, 1.25, 1.75]) {
      const edge = PORTAL_RELIC_OUTER_RADIUS * scale + PORTAL_GROUND_DECOR_CLEARANCE;
      for (const cluster of portalGroundClusterPlacements(99, scale, FLOOR_Y)) {
        expect(Math.hypot(cluster.position[0], cluster.position[2])).toBeGreaterThan(edge);
        expect(cluster.position[1]).toBe(FLOOR_Y);
      }
      for (const lamp of portalCrystalLampPlacements(99, scale, FLOOR_Y)) {
        expect(Math.hypot(lamp.position[0], lamp.position[2])).toBeGreaterThan(edge);
        expect(lamp.position[1]).toBeGreaterThan(FLOOR_Y);
      }
    }
  });

  it('merges stones, plants and plinths into one coloured mobile buffer', () => {
    const geometry = buildPortalGroundDecorGeometry(4242, 1.2, FLOOR_Y, PALETTE);
    const position = geometry.getAttribute('position');
    const colour = geometry.getAttribute('color');

    expect(position.count).toBeGreaterThan(0);
    expect(colour.count).toBe(position.count);
    expect(geometry.groups.length).toBeLessThanOrEqual(1);
    expect(triangles(geometry)).toBeGreaterThan(400);
    expect(triangles(geometry)).toBeLessThan(1_500);

    geometry.dispose();
  });

  it('keeps a constant triangle bill across seeds and supported dais sizes', () => {
    const counts: number[] = [];
    for (const seed of [1, 77, 4242]) {
      for (const scale of [1, 1.75]) {
        const geometry = buildPortalGroundDecorGeometry(seed, scale, FLOOR_Y, PALETTE);
        counts.push(triangles(geometry));
        geometry.dispose();
      }
    }
    expect(new Set(counts).size).toBe(1);
  });
});

describe('portal colonnade decor', () => {
  const pillars = portalPillarInstances(portalCameraFrame(0.46, 1.5), 0.46);

  it('uses sparse, non-overlapping accents across the full arcade', () => {
    const banners = portalBannerPillars(pillars);
    const vines = portalVinePillars(pillars);
    expect(banners).toHaveLength(PORTAL_BANNER_COUNT);
    expect(vines).toHaveLength(PORTAL_VINE_COUNT);
    expect(new Set(banners.map((pillar) => pillar.position.join(':'))).size).toBe(banners.length);
    expect(new Set(vines.map((pillar) => pillar.position.join(':'))).size).toBe(vines.length);
    expect(banners.length + vines.length).toBeLessThan(pillars.length / 2);
  });

  it('merges cloth, vines and leaves into one deterministic coloured buffer', () => {
    const first = buildPortalColonnadeDecorGeometry(4242, pillars, COLONNADE_PALETTE);
    const again = buildPortalColonnadeDecorGeometry(4242, pillars, COLONNADE_PALETTE);
    const other = buildPortalColonnadeDecorGeometry(4243, pillars, COLONNADE_PALETTE);

    expect(Array.from(first.getAttribute('position').array))
      .toEqual(Array.from(again.getAttribute('position').array));
    expect(Array.from(first.getAttribute('position').array))
      .not.toEqual(Array.from(other.getAttribute('position').array));
    expect(first.getAttribute('color').count).toBe(first.getAttribute('position').count);
    expect(first.groups.length).toBeLessThanOrEqual(1);
    expect(triangles(first)).toBeGreaterThan(500);
    expect(triangles(first)).toBeLessThan(2_000);

    const position = first.getAttribute('position');
    for (let index = 0; index < position.count; index += 1) {
      expect(Math.hypot(position.getX(index), position.getZ(index))).toBeGreaterThan(11.8);
      expect(position.getY(index)).toBeGreaterThan(FLOOR_Y - 0.1);
      expect(position.getY(index)).toBeLessThan(FLOOR_Y + 3.6);
    }

    first.dispose();
    again.dispose();
    other.dispose();
  });
});

describe('portal atmospheric decor', () => {
  it('keeps the four architectural crystals on their own plinths', () => {
    const placements = portalCrystalLampPlacements(4242, 1.2, FLOOR_Y);
    const geometry = buildPortalCrystalLampGeometry(4242, 1.2, FLOOR_Y);
    expect(placements).toHaveLength(PORTAL_CRYSTAL_LAMP_COUNT);
    expect(triangles(geometry)).toBe(PORTAL_CRYSTAL_LAMP_COUNT * 8);
    expect(geometry.getAttribute('color').count).toBe(geometry.getAttribute('position').count);
    geometry.dispose();
  });

  it('builds deterministic haze above and outside the temple', () => {
    const first = buildPortalHazeField(77, 7);
    expect(buildPortalHazeField(77, 7)).toEqual(first);
    expect(buildPortalHazeField(78, 7)).not.toEqual(first);
    expect(first.count).toBe(7);
    for (let index = 0; index < first.count; index += 1) {
      const x = first.positions[index * 3]!;
      const y = first.positions[index * 3 + 1]!;
      const z = first.positions[index * 3 + 2]!;
      expect(y).toBeGreaterThan(0);
      expect(Math.hypot(x, y, z)).toBeGreaterThan(29);
      expect(first.sizes[index]).toBeGreaterThan(80);
      expect(first.alphas[index]).toBeGreaterThan(0);
      expect(first.alphas[index]).toBeLessThanOrEqual(1);
    }
  });

  it('keeps celestial linework sparse and entirely above the horizon', () => {
    const first = buildPortalCelestialArcGeometry(4242);
    const again = buildPortalCelestialArcGeometry(4242);
    const other = buildPortalCelestialArcGeometry(4243);
    const position = first.getAttribute('position');
    expect(position.count).toBe(PORTAL_CELESTIAL_ARC_COUNT * PORTAL_CELESTIAL_ARC_SEGMENTS * 2);
    expect(Array.from(position.array)).toEqual(Array.from(again.getAttribute('position').array));
    expect(Array.from(position.array)).not.toEqual(Array.from(other.getAttribute('position').array));
    for (let index = 0; index < position.count; index += 1) {
      expect(position.getY(index)).toBeGreaterThan(0);
    }
    first.dispose();
    again.dispose();
    other.dispose();
  });

  it('adds the approved four passes and no hidden light pass', () => {
    expect(PORTAL_DECOR_DRAW_CALLS).toBe(4);
  });
});
