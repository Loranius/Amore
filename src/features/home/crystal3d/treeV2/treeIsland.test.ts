import { describe, expect, it } from 'vitest';
import { TREE_PAINT, buildTreeIsland, treeIslandGround } from './treeIsland';

// ============================================================
// Острів дерева за референсом власника (ADR-0222). Тести тримають те, що
// видно оком: є всі частини референсу, острів детермінований, числа цілі,
// між травою й скелею немає щілини, а в центрі, де росте дерево, лише трава.
// ============================================================

const R = 1.3;
const isle = buildTreeIsland('2022-12-26', R);

describe('острів дерева', () => {
  it('має всі частини референсу: траву, скелю, валуни, плющ, квіти, ґрунт (небо — в оточенні, ADR-0224)', () => {
    const used = new Set(Array.from(isle.island.paint));
    for (const p of [TREE_PAINT.grass, TREE_PAINT.cliff, TREE_PAINT.boulder, TREE_PAINT.ivy, TREE_PAINT.flower, TREE_PAINT.soil]) expect(used.has(p)).toBe(true);
  });

  it('трикутники цілі, числа скінченні, атрибути на кожну вершину', () => {
    for (const mesh of [isle.island, isle.debris]) {
      expect(mesh.positions.length % 9).toBe(0);
      for (const v of mesh.positions) expect(Number.isFinite(v)).toBe(true);
      expect(mesh.paint.length * 3).toBe(mesh.positions.length);
      expect(mesh.tone.length).toBe(mesh.paint.length);
    }
  });

  it('на острові нічого не світиться саме: він денний', () => {
    for (const g of isle.island.glow) expect(g).toBe(0);
  });

  it('у центрі, де росте дерево, лише трава (валуни, плющ і квіти — осторонь)', () => {
    const { positions, paint } = isle.island;
    for (let v = 0; v < paint.length; v += 1) {
      // Під островом скеля сходиться до осі — це підошва, не центр галявини.
      if (paint[v] === TREE_PAINT.grass || positions[v * 3 + 1]! < 0) continue;
      expect(Math.hypot(positions[v * 3]!, positions[v * 3 + 2]!)).toBeGreaterThan(R * 0.3);
    }
  });

  it('між краєм трави й підошвою немає щілини (регресія тріщини острова кристала)', () => {
    const { positions, paint } = isle.island;
    const key = (v: number) => `${positions[v * 3]!.toFixed(6)}:${positions[v * 3 + 1]!.toFixed(6)}:${positions[v * 3 + 2]!.toFixed(6)}`;
    const rimY = treeIslandGround(R, R);
    // Вершина краю купола входить у три трикутники трави й у три
    // трикутники звису під нею. Якби звис мав свої вершини поруч, тут було б 3.
    const count = new Map<string, number>();
    for (let v = 0; v < paint.length; v += 1) {
      if (paint[v] !== TREE_PAINT.grass || Math.abs(positions[v * 3 + 1]! - rimY) > 1e-6) continue;
      count.set(key(v), (count.get(key(v)) ?? 0) + 1);
    }
    expect(count.size).toBe(24);
    for (const n of count.values()) expect(n).toBeGreaterThanOrEqual(6);
  });

  it('купол: центр вищий за край, трава стоїть на землі', () => {
    expect(treeIslandGround(R, 0)).toBeGreaterThan(treeIslandGround(R, R * 0.8));
    expect(treeIslandGround(R, R * 2)).toBeCloseTo(treeIslandGround(R, R), 9);
  });

  it('скеля звисає під островом приблизно на радіус', () => {
    let lowest = Infinity;
    for (let v = 0; v < isle.island.paint.length; v += 1) lowest = Math.min(lowest, isle.island.positions[v * 3 + 1]!);
    expect(lowest).toBeLessThan(-R * 1.1);
    expect(lowest).toBeGreaterThan(-R * 1.5);
  });

  it('детерміновано: та сама дата — побітово той самий острів', () => {
    const again = buildTreeIsland('2022-12-26', R);
    expect(Array.from(again.island.positions)).toEqual(Array.from(isle.island.positions));
    expect(Array.from(again.debris.positions)).toEqual(Array.from(isle.debris.positions));
  });
});
