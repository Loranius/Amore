import { describe, expect, it } from 'vitest';
import { DOLPHIN_SHAPE, FISH_SHAPE, PART, WHALE_SHAPE, buildFishMesh } from './fishMesh';

// ============================================================
// Власник, 2026-10-05: «покращ модельки риб, додай трикутників і полігонів
// для кожної». Тіло — лофт, а не ромб; у кожної — плавці, очі, черевце.
// ============================================================

describe('модель риби', () => {
  for (const [name, shape] of [['рибка', FISH_SHAPE], ['кит', WHALE_SHAPE], ['дельфін', DOLPHIN_SHAPE]] as const) {
    it(`${name}: сотня й більше трикутників, скінченні числа, усі частини тіла`, () => {
      const m = buildFishMesh(shape);
      const triangles = m.positions.length / 9;
      expect(triangles).toBeGreaterThan(100);
      expect(m.part.length).toBe(m.positions.length / 3);
      expect(m.positions.every((v) => Number.isFinite(v))).toBe(true);
      const parts = new Set(Array.from(m.part));
      for (const p of [PART.back, PART.belly, PART.fin, PART.eye]) expect(parts.has(p)).toBe(true);
      // Ніс спереду, хвіст позаду: x від 1 до −1.
      const xs = Array.from(m.positions).filter((_, i) => i % 3 === 0);
      expect(Math.max(...xs)).toBeCloseTo(1, 6);
      expect(Math.min(...xs)).toBeLessThan(-0.9);
    });
  }

  it('кит і дельфін — з горизонтальними лопатями хвоста, рибка — з вертикальним роздвоєним', () => {
    const tailSpan = (shape: typeof FISH_SHAPE) => {
      const m = buildFishMesh(shape);
      let y = 0;
      let z = 0;
      for (let i = 0; i < m.positions.length; i += 3) {
        if (m.positions[i]! < -0.85) { y = Math.max(y, Math.abs(m.positions[i + 1]!)); z = Math.max(z, Math.abs(m.positions[i + 2]!)); }
      }
      return { y, z };
    };
    expect(tailSpan(FISH_SHAPE).y).toBeGreaterThan(tailSpan(FISH_SHAPE).z);
    expect(tailSpan(WHALE_SHAPE).z).toBeGreaterThan(tailSpan(WHALE_SHAPE).y);
    expect(tailSpan(DOLPHIN_SHAPE).z).toBeGreaterThan(tailSpan(DOLPHIN_SHAPE).y);
  });
});
