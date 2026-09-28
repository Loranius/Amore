import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mergeCoupleRoot, prefixForCouple } from './couplePath';

// ============================================================
// Шлях файлу під префіксом пари (ADR-0229): та сама форма, яку розбирає
// `storage_object_couple` у базі (`^c<число>/`).
// ============================================================

describe('шлях файлу пари', () => {
  it('c<пара>/<шлях>, без подвійної скісної риски', () => {
    expect(prefixForCouple(2, '2026/06/2026-06-23_1.jpg')).toBe('c2/2026/06/2026-06-23_1.jpg');
    expect(prefixForCouple(12, '/pin-3.jpg')).toBe('c12/pin-3.jpg');
  });

  it('префікс розпізнається тим самим виразом, що в базі', () => {
    expect(/^c[0-9]+\//.test(prefixForCouple(7, 'x.jpg'))).toBe(true);
  });

  it('без номера пари файл не кладеться — жодного тихого шляху без префікса', () => {
    expect(() => prefixForCouple(0, 'x.jpg')).toThrow();
    expect(() => prefixForCouple(Number.NaN, 'x.jpg')).toThrow();
  });
});

describe('кожне завантаження йде через couplePath (регресія: файли двох пар в одному шляху)', () => {
  const files = [
    'features/plans/usePlans.ts',
    'features/polaroid/usePolaroid.ts',
    'features/profile/useProfile.ts',
    'features/media/useMedia.ts',
    'features/memories/useMoments.ts',
    'features/memories/useMapPins.ts',
    'features/memories/useMemories.ts',
    'features/wishlist/wishlistProcessedImagePersistence.ts',
  ];
  for (const file of files) {
    it(file, () => {
      const source = readFileSync(join(__dirname, '..', file), 'utf8');
      expect(source).toContain('couplePath(');
    });
  }
});

describe('корінь пари: старі файли кореня + папка c<пара>/', () => {
  const root = [
    { name: 'old.jpg', created_at: '2025-01-01T00:00:00Z' },
    { name: 'c1', created_at: null }, // папка пари в корені — не фото
    { name: 'profile', created_at: null },
  ];
  const own = [
    { name: 'new.jpg', created_at: '2026-09-28T10:00:00Z' },
    { name: 'profile', created_at: null }, // портрети — підпапка, не пул
  ];

  it('обидва джерела, новіші першими, шлях — повний', () => {
    expect(mergeCoupleRoot(root, own, 'c1', 10)).toEqual([
      { path: 'c1/new.jpg', created_at: '2026-09-28T10:00:00Z' },
      { path: 'old.jpg', created_at: '2025-01-01T00:00:00Z' },
    ]);
  });

  it('межа кількості тримається після злиття', () => {
    expect(mergeCoupleRoot(root, own, 'c1', 1).map((f) => f.path)).toEqual(['c1/new.jpg']);
  });

  it('рівні дати — порядок за шляхом, а не за порядком відповіді сховища', () => {
    const a = { name: 'a.jpg', created_at: null };
    const b = { name: 'b.jpg', created_at: null };
    const expected = [
      { path: 'c2/a.jpg', created_at: null },
      { path: 'c2/b.jpg', created_at: null },
    ];
    expect(mergeCoupleRoot([], [a, b], 'c2', 5)).toEqual(expected);
    expect(mergeCoupleRoot([], [b, a], 'c2', 5)).toEqual(expected);
  });
});
