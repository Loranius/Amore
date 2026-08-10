import { describe, expect, it } from 'vitest';
import {
  buildWishSatellites,
  wishSatelliteCap,
  type WishSatelliteInput,
  type WishSatelliteQuality,
} from './wishCrystals';

// ============================================================
// Кристали бажань — бриф §28–§29, Фаза 7.
// ------------------------------------------------------------
// Тримають рівно те, що бриф називає вимогами: розсип незмінний у кожної пари,
// кристали не громадяться, їх не сотні, і жоден не стоїть усередині монарха.
// Розмір і кут — смак власника; ці властивості — ні.
// ============================================================

const BASE: WishSatelliteInput = {
  activeWishes: 7,
  seed: 4211,
  bounds: { height: 3.4, radius: 1.25 },
  quality: 'high',
};

const QUALITIES: readonly WishSatelliteQuality[] = ['high', 'balanced', 'low', 'fallback'];

describe('placement (brief §29)', () => {
  it('gives the same couple the same sky, every time', () => {
    // The satellites are theirs. A layout that reshuffled on each render would
    // be noise, and it would defeat the spatial memory the atlas exists for.
    const first = buildWishSatellites(BASE);
    for (let repeat = 0; repeat < 5; repeat += 1) {
      expect(buildWishSatellites(BASE)).toEqual(first);
    }
    expect(buildWishSatellites({ ...BASE, seed: BASE.seed + 1 })).not.toEqual(first);
  });

  it('never puts a wish inside the stone', () => {
    // The monarch narrows towards the tip, but its daughters stand wide and
    // low, so "just inside the radius" at crown height is still a branch.
    // An absolute threshold is the only one that can be checked here.
    for (const quality of QUALITIES) {
      for (const activeWishes of [1, 3, 12, 60]) {
        for (const satellite of buildWishSatellites({ ...BASE, quality, activeWishes })) {
          const [x, y, z] = satellite.position;
          expect(Math.hypot(x, z), `${quality}/${activeWishes}`).toBeGreaterThan(BASE.bounds.radius);
          // Плечі монарха, не вище вістря: кадр камери будується під артефакт,
          // і на вертикальному телефоні над вершиною запасу майже немає —
          // виміряно, верхні супутники зрізало краєм екрана.
          expect(y).toBeGreaterThan(BASE.bounds.height * 0.55);
          expect(y).toBeLessThan(BASE.bounds.height);
        }
      }
    }
  });

  it('keeps them apart enough to read as separate wishes', () => {
    // §29: "remain visually readable / not overcrowd the scene". Two crystals
    // closer than their own size would read as one lump.
    const satellites = buildWishSatellites({ ...BASE, activeWishes: 12 });
    expect(satellites.length).toBe(12);
    for (const a of satellites) {
      for (const b of satellites) {
        if (a === b) continue;
        const gap = Math.hypot(
          a.position[0] - b.position[0],
          a.position[1] - b.position[1],
          a.position[2] - b.position[2],
        );
        expect(gap).toBeGreaterThan(Math.max(a.scale, b.scale));
      }
    }
  });

  it('varies size and orientation without becoming a jumble', () => {
    // "vary slightly in size / orientation" — slightly being the operative
    // word. Measured across the whole layout rather than asserted per crystal.
    const satellites = buildWishSatellites({ ...BASE, activeWishes: 12 });
    const scales = satellites.map((s) => s.scale);
    const spread = Math.max(...scales) / Math.min(...scales);
    expect(spread).toBeGreaterThan(1.05);
    expect(spread).toBeLessThan(1.5);
    expect(new Set(satellites.map((s) => s.rotationY)).size).toBe(satellites.length);
    for (const satellite of satellites) {
      expect(Math.abs(satellite.tilt)).toBeLessThan(0.3);
    }
  });
});

describe('bounds (brief §29, §43)', () => {
  it('never draws hundreds, whatever the wishlist holds', () => {
    // The brief forbids it outright, and §43 names persistent WebGL memory as
    // the first mobile risk.
    for (const quality of QUALITIES) {
      const cap = wishSatelliteCap(quality);
      expect(buildWishSatellites({ ...BASE, quality, activeWishes: 400 })).toHaveLength(cap);
    }
  });

  it('loses no wish when it clusters them', () => {
    // What is not drawn is still counted: the last crystal stands for the
    // remainder, so the sky is bounded and the wishlist is not silently cut.
    for (const activeWishes of [1, 5, 12, 13, 40, 400]) {
      const satellites = buildWishSatellites({ ...BASE, activeWishes });
      const represented = satellites.reduce((sum, s) => sum + s.represents, 0);
      expect(represented, String(activeWishes)).toBe(activeWishes);
    }
  });

  it('lets a cluster look heavier without becoming a second monarch', () => {
    const one = buildWishSatellites({ ...BASE, activeWishes: 12 });
    const many = buildWishSatellites({ ...BASE, activeWishes: 400 });
    const singleLast = one[one.length - 1]!;
    const clusterLast = many[many.length - 1]!;
    expect(clusterLast.scale).toBeGreaterThan(singleLast.scale);
    expect(clusterLast.scale).toBeLessThan(BASE.bounds.height * 0.2);
  });

  it('draws nothing when there is nothing to wish for, or nothing to draw with', () => {
    expect(buildWishSatellites({ ...BASE, activeWishes: 0 })).toEqual([]);
    expect(buildWishSatellites({ ...BASE, quality: 'fallback' })).toEqual([]);
  });

  it('survives nonsense rather than placing a crystal at infinity', () => {
    const satellites = buildWishSatellites({
      activeWishes: Number.NaN,
      seed: Number.POSITIVE_INFINITY,
      bounds: { height: Number.NaN, radius: 0 },
      quality: 'high',
    });
    expect(satellites).toEqual([]);
    const some = buildWishSatellites({
      ...BASE,
      seed: Number.NaN,
      bounds: { height: Number.NaN, radius: Number.NaN },
    });
    for (const satellite of some) {
      for (const value of [...satellite.position, satellite.scale, satellite.rotationY, satellite.tilt]) {
        expect(Number.isFinite(value)).toBe(true);
      }
    }
  });
});
