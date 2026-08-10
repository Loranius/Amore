import { describe, expect, it } from 'vitest';
import {
  buildWishBoard,
  wishSatelliteCap,
  type WishBoardInput,
  type WishCrystal,
  type WishSatelliteQuality,
  type WishSubject,
} from './wishCrystals';

// ============================================================
// Кристали бажань — бриф §28–§29, Фаза 7.
// ------------------------------------------------------------
// Тримають рівно те, що бриф називає вимогами: розсип незмінний у кожної пари,
// кристали не громадяться, їх не сотні, і жоден не стоїть усередині монарха.
// Розмір і кут — смак власника; ці властивості — ні.
// ============================================================

function wishes(count: number): readonly WishSubject[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    photo: index % 3 === 0 ? null : `https://example.test/${index}.jpg`,
    priority: (['high', 'medium', 'low', null] as const)[index % 4]!,
  }));
}

const BASE: WishBoardInput = {
  wishes: wishes(7),
  seed: 4211,
  bounds: { height: 3.4, radius: 1.25 },
  quality: 'high',
  facing: 0,
};

const QUALITIES: readonly WishSatelliteQuality[] = ['high', 'balanced', 'low', 'fallback'];

describe('board layout (brief §28–§29)', () => {
  it('gives the same couple the same board, every time', () => {
    // The board is theirs. A layout that reshuffled on each render would be
    // noise, and it would defeat the spatial memory the atlas exists for.
    const first = buildWishBoard(BASE);
    for (let repeat = 0; repeat < 5; repeat += 1) {
      expect(buildWishBoard(BASE)).toEqual(first);
    }
    expect(buildWishBoard({ ...BASE, seed: BASE.seed + 1 })).not.toEqual(first);
  });

  it('stands in front of the artifact, whichever way the camera looks', () => {
    // The first version hung the wishes on a ring around the crown, and half
    // of them ended up behind the monarch. The board is built in the plane
    // across the camera's bearing, so this holds at any azimuth.
    for (const facing of [0, 1.1, -2.4, Math.PI]) {
      const outX = Math.sin(facing);
      const outZ = Math.cos(facing);
      for (const crystal of buildWishBoard({ ...BASE, facing })) {
        const [x, , z] = crystal.position;
        // Positive projection on the camera's own direction = in front of it.
        expect(x * outX + z * outZ, String(facing)).toBeGreaterThan(BASE.bounds.radius);
      }
    }
  });

  it('keeps the wishes apart enough to be taken one at a time', () => {
    // §29: "remain visually readable / not overcrowd the scene". Two bodies
    // closer than their own size would read as one lump and be impossible to
    // hit with a finger.
    const board = buildWishBoard({ ...BASE, wishes: wishes(12) });
    expect(board.length).toBe(12);
    for (const a of board) {
      for (const b of board) {
        if (a === b) continue;
        const gap = Math.hypot(
          a.position[0] - b.position[0],
          a.position[1] - b.position[1],
          a.position[2] - b.position[2],
        );
        expect(gap).toBeGreaterThan(Math.max(a.size, b.size) * 0.9);
      }
    }
  });

  it('centres a short last row instead of letting it drift left', () => {
    // Seven wishes are three, three and one. A one-wish row laid out from the
    // left edge reads as a mistake rather than as a row.
    const board = buildWishBoard(BASE);
    const last = board[board.length - 1]!;
    const facing = BASE.facing;
    const rightX = Math.cos(facing);
    const rightZ = -Math.sin(facing);
    const sideways = last.position[0] * rightX + last.position[2] * rightZ;
    expect(Math.abs(sideways)).toBeLessThan(1e-9);
  });

  it('sizes a wish by how much it is wanted', () => {
    const high = buildWishBoard({ ...BASE, wishes: [{ id: 1, photo: null, priority: 'high' }] })[0]!;
    const low = buildWishBoard({ ...BASE, wishes: [{ id: 1, photo: null, priority: 'low' }] })[0]!;
    expect(high.size).toBeGreaterThan(low.size);
    // But not by so much that a low wish becomes a speck.
    expect(high.size / low.size).toBeLessThan(1.6);
  });

  it('gives every wish its own start, so the board is not a marching band', () => {
    const board = buildWishBoard({ ...BASE, wishes: wishes(12) });
    expect(new Set(board.map((crystal: WishCrystal) => crystal.spin)).size).toBe(board.length);
    expect(new Set(board.map((crystal: WishCrystal) => crystal.bob)).size).toBe(board.length);
  });
});

describe('bounds (brief §29, §43)', () => {
  it('never draws hundreds, whatever the wishlist holds', () => {
    // The brief forbids it outright, and §43 names persistent WebGL memory as
    // the first mobile risk — here doubly, because each wish carries its own
    // texture and therefore its own material.
    for (const quality of QUALITIES) {
      const cap = wishSatelliteCap(quality);
      expect(buildWishBoard({ ...BASE, quality, wishes: wishes(400) })).toHaveLength(cap);
    }
  });

  it('loses no wish when it clusters them', () => {
    // What is not drawn is still counted: the last crystal stands for the
    // remainder, so the sky is bounded and the wishlist is not silently cut.
    for (const count of [1, 5, 12, 13, 40, 400]) {
      const board = buildWishBoard({ ...BASE, wishes: wishes(count) });
      const represented = board.reduce((sum: number, c: WishCrystal) => sum + c.represents, 0);
      expect(represented, String(count)).toBe(count);
      // A crystal that stands for many cannot be opened as one wish.
      for (const crystal of board) {
        if (crystal.represents > 1) expect(crystal.id).toBeNull();
        else expect(crystal.id).not.toBeNull();
      }
    }
  });

  it('lets a cluster look heavier without becoming a second monarch', () => {
    const twelve = wishes(12);
    const many = wishes(400).map((wish, index) => ({ ...wish, priority: twelve[index % 12]!.priority }));
    const one = buildWishBoard({ ...BASE, wishes: twelve });
    const crowd = buildWishBoard({ ...BASE, wishes: many });
    expect(crowd[crowd.length - 1]!.size).toBeGreaterThan(one[one.length - 1]!.size);
    expect(crowd[crowd.length - 1]!.size).toBeLessThan(BASE.bounds.height * 0.35);
  });

  it('draws nothing when there is nothing to wish for, or nothing to draw with', () => {
    expect(buildWishBoard({ ...BASE, wishes: [] })).toEqual([]);
    expect(buildWishBoard({ ...BASE, quality: 'fallback' })).toEqual([]);
  });

  it('survives nonsense rather than placing a crystal at infinity', () => {
    const board = buildWishBoard({
      ...BASE,
      seed: Number.NaN,
      facing: Number.NaN,
      bounds: { height: Number.NaN, radius: Number.NaN },
    });
    expect(board.length).toBeGreaterThan(0);
    for (const crystal of board) {
      for (const value of [...crystal.position, crystal.size, crystal.spin, crystal.bob]) {
        expect(Number.isFinite(value)).toBe(true);
      }
    }
  });
});
