import { describe, expect, it } from 'vitest';
import { softNormals, softScalar } from './softNormals';

// ============================================================
// Власник, 2026-10-04: «обтікаючі, плавні, але low poly; без гострих кутів на
// текстурах». М'яка нормаль згладжує світло між пологими гранями й лишає
// справжній злам зламом.
// ============================================================

const tri = (...p: number[]) => p;

describe('м\'які нормалі', () => {
  it('пологий злам (20°) згладжено: у спільній вершині обидві грані мають одну нормаль', () => {
    const a = Math.tan((20 * Math.PI) / 180);
    // Дві грані, що сходяться на ребрі x = 0, нахилені одна до одної на 20°.
    const positions = new Float32Array([
      ...tri(0, 0, 0, 0, 0, 1, -1, 0, 0),
      ...tri(0, 0, 0, 1, a, 0, 0, 0, 1),
    ]);
    const n = softNormals(positions, 60);
    // Вершина (0,0,0) у першому й другому трикутнику.
    expect(n[0]).toBeCloseTo(n[9]!, 6);
    expect(n[1]).toBeCloseTo(n[10]!, 6);
    expect(n[2]).toBeCloseTo(n[11]!, 6);
  });

  it('гострий злам (90°) лишається зламом: нормалі граней різні', () => {
    const positions = new Float32Array([
      ...tri(0, 0, 0, 0, 0, 1, -1, 0, 0), // горизонтальна
      ...tri(0, 0, 0, 0, 1, 0, 0, 0, 1), // вертикальна
    ]);
    const n = softNormals(positions, 60);
    expect(Math.abs(n[1]!)).toBeCloseTo(1, 6);
    expect(Math.abs(n[10]!)).toBeCloseTo(0, 6);
  });

  it('детерміновано, одиничні, скінченні; вироджений трикутник не ламає сусідів', () => {
    const positions = new Float32Array([
      ...tri(0, 0, 0, 0, 0, 1, -1, 0, 0),
      ...tri(0, 0, 0, 0, 0, 0, 0, 0, 0),
    ]);
    const n = softNormals(positions);
    expect(Array.from(softNormals(positions))).toEqual(Array.from(n));
    expect(n.every((v) => Number.isFinite(v))).toBe(true);
    expect(Math.hypot(n[0]!, n[1]!, n[2]!)).toBeCloseTo(1, 6);
  });

  it('тон перетікає через пологий злам, а через гострий — ні', () => {
    const a = Math.tan((20 * Math.PI) / 180);
    const gentle = new Float32Array([...tri(0, 0, 0, 0, 0, 1, -1, 0, 0), ...tri(0, 0, 0, 1, a, 0, 0, 0, 1)]);
    const sharp = new Float32Array([...tri(0, 0, 0, 0, 0, 1, -1, 0, 0), ...tri(0, 0, 0, 0, 1, 0, 0, 0, 1)]);
    const tone = new Float32Array([0.8, 0.8, 0.8, 1.2, 1.2, 1.2]);
    const soft = softScalar(gentle, tone, 60);
    expect(soft[0]).toBeCloseTo(soft[3]!, 6);
    expect(soft[0]).toBeGreaterThan(0.8);
    expect(soft[0]).toBeLessThan(1.2);
    const kept = softScalar(sharp, tone, 60);
    expect(kept[0]).toBeCloseTo(0.8, 6);
    expect(kept[3]).toBeCloseTo(1.2, 6);
  });
});
