import { describe, expect, it } from 'vitest';
import { buildDioramaBase, dioramaRimRadius } from './dioramaBase';

// ============================================================
// Острівець діорами (ADR-0220): стиль AbyssRium — предмет на маленькому
// гранчастому острівці в порожнечі. Тест тримає те, що видно оком:
// острів цілий, детермінований, верхівка вгорі, підошва звужується донизу.
// ============================================================

describe('діорама: острівець', () => {
  const base = buildDioramaBase('2022-12-26', 2);

  it('трикутники цілі, усі числа скінченні, атрибути на кожну вершину', () => {
    expect(base.positions.length % 9).toBe(0);
    for (const v of base.positions) expect(Number.isFinite(v)).toBe(true);
    expect(base.tone.length * 3).toBe(base.positions.length);
    expect(base.top.length).toBe(base.tone.length);
  });

  it('верхівка — не нижче краю, підошва — під нею і звужується до вістря', () => {
    let lowest = Infinity;
    for (let v = 0; v < base.top.length; v += 1) {
      const y = base.positions[v * 3 + 1]!;
      if (base.top[v] === 1) expect(y).toBeGreaterThanOrEqual(0);
      lowest = Math.min(lowest, y);
    }
    expect(lowest).toBeCloseTo(-2.5, 6);
  });

  it('край нерівний, але в межах ±10% радіуса', () => {
    const radii = Array.from({ length: 18 }, (_, j) => dioramaRimRadius('2022-12-26', 2, j));
    expect(Math.max(...radii) - Math.min(...radii)).toBeGreaterThan(0.05);
    for (const r of radii) {
      expect(r).toBeGreaterThanOrEqual(1.8);
      expect(r).toBeLessThanOrEqual(2.2);
    }
  });

  it('детерміновано: та сама дата — побітово той самий острів', () => {
    expect(Array.from(buildDioramaBase('2022-12-26', 2).positions)).toEqual(Array.from(base.positions));
  });
});
