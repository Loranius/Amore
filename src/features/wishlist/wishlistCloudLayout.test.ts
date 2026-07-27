import { describe, expect, it } from 'vitest';
import {
  freshWishlistCloudSeed,
  normalizeWishlistCloudPriority,
  wishlistCloudPlacement,
  wishlistCloudPriorityPresentation,
} from './wishlistCloudLayout';

describe('wishlist cloud priority presentation', () => {
  it.each([
    ['high', 'Жадане', 174],
    ['dream', 'Жадане', 174],
    ['medium', 'Бажане', 116],
    ['low', 'Приємне', 78],
  ] as const)('maps %s to %s with a %spx bubble', (priority, label, size) => {
    expect(wishlistCloudPriorityPresentation(priority)).toMatchObject({ label, size });
  });

  it('uses medium priority for legacy items without a value', () => {
    expect(normalizeWishlistCloudPriority(null)).toBe('medium');
  });
});

describe('wishlist cloud placement', () => {
  const SEED = 0x5eed_1234;

  it('is stable for the same seed, wish and position', () => {
    expect(wishlistCloudPlacement(SEED, 42, 3)).toEqual(wishlistCloudPlacement(SEED, 42, 3));
  });

  it('varies between wishes on the same board', () => {
    expect(wishlistCloudPlacement(SEED, 42, 3)).not.toEqual(
      wishlistCloudPlacement(SEED, 43, 3),
    );
  });

  // Суть Phase 13: та сама бульбашка при наступному відкритті вкладки стоїть
  // інакше. Доти розкладка бралася лише з `id`, тож дошка була буквально
  // застигла. Перевіряємо на вибірці, а не на одній парі: одиничний збіг
  // хешу нічого не довів би.
  it('lays the same wishes out differently for a fresh seed', () => {
    const ids = [1, 2, 3, 4, 5, 6, 7, 8];
    const board = (seed: number) => ids.map((id, index) => wishlistCloudPlacement(seed, id, index));
    const first = board(1);
    const second = board(2);
    const moved = ids.filter((_, i) => JSON.stringify(first[i]) !== JSON.stringify(second[i]));
    expect(moved).toHaveLength(ids.length);
  });

  // Діапазони — це контракт із CSS і з `clampBodyToBoard`: за їх межами
  // бульбашка виїжджає за край дошки на вузькому екрані.
  it('keeps every value inside the documented ranges', () => {
    for (let seed = 0; seed < 64; seed += 1) {
      for (let id = 0; id < 8; id += 1) {
        const p = wishlistCloudPlacement(seed * 7919, id, id % 19);
        expect(p.marginTop).toBeGreaterThanOrEqual(-10);
        expect(p.marginTop).toBeLessThanOrEqual(22);
        expect(p.marginBottom).toBeGreaterThanOrEqual(-10);
        expect(p.marginBottom).toBeLessThanOrEqual(22);
        expect(Math.abs(p.marginRight)).toBeLessThanOrEqual(18);
        expect(Math.abs(p.marginLeft)).toBeLessThanOrEqual(18);
        expect(Math.abs(p.translateX)).toBeLessThanOrEqual(18);
        expect(Math.abs(p.translateY)).toBeLessThanOrEqual(20);
        expect(Math.abs(p.rotate)).toBeLessThanOrEqual(6);
        expect(p.delay).toBeLessThanOrEqual(0);
        expect(p.duration).toBeGreaterThanOrEqual(5.2);
        expect(p.zIndex).toBeGreaterThanOrEqual(1);
        expect(p.zIndex).toBeLessThanOrEqual(5);
        // Дихання по обох осях; вертикальна складова завжди вгору.
        expect(Math.abs(p.driftX)).toBeLessThanOrEqual(7);
        expect(p.driftY).toBeLessThan(0);
        expect(p.driftY).toBeGreaterThanOrEqual(-9);
      }
    }
  });

  it('draws a fresh seed each time', () => {
    const seeds = new Set(Array.from({ length: 32 }, () => freshWishlistCloudSeed()));
    expect(seeds.size).toBeGreaterThan(1);
    for (const seed of seeds) expect(Number.isFinite(seed)).toBe(true);
  });
});
