import { describe, expect, it } from 'vitest';
import { TREE_PAINT, buildTreeIsland, treeIslandGround } from './treeIsland';

// ============================================================
// Острів дерева за референсом власника (ADR-0222, гранчастий — ADR-0226). Тести тримають те, що
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

  it('плющ лежить на скелі, а не висить поруч у повітрі (регресія)', () => {
    // Для кожного листка під краєм — промінь від осі на його висоті в його
    // напрямку; найдальший перетин із гранями підошви — поверхня скелі.
    const { positions, paint } = isle.island;
    const faces: number[] = [];
    for (let t = 0; t < paint.length; t += 3) {
      if (paint[t] === TREE_PAINT.cliff || paint[t] === TREE_PAINT.soil || paint[t] === TREE_PAINT.grass) faces.push(t);
    }
    const surface = (a: number, y: number) => {
      const d = [Math.cos(a), 0, Math.sin(a)];
      let best = 0;
      for (const t of faces) {
        const v = (k: number) => [positions[(t + k) * 3]!, positions[(t + k) * 3 + 1]!, positions[(t + k) * 3 + 2]!];
        const [p0, p1, p2] = [v(0), v(1), v(2)];
        const e1 = [p1[0]! - p0[0]!, p1[1]! - p0[1]!, p1[2]! - p0[2]!];
        const e2 = [p2[0]! - p0[0]!, p2[1]! - p0[1]!, p2[2]! - p0[2]!];
        const h = [d[1]! * e2[2]! - d[2]! * e2[1]!, d[2]! * e2[0]! - d[0]! * e2[2]!, d[0]! * e2[1]! - d[1]! * e2[0]!];
        const det = e1[0]! * h[0]! + e1[1]! * h[1]! + e1[2]! * h[2]!;
        if (Math.abs(det) < 1e-9) continue;
        const s = [-p0[0]!, y - p0[1]!, -p0[2]!];
        const u = (s[0]! * h[0]! + s[1]! * h[1]! + s[2]! * h[2]!) / det;
        if (u < 0 || u > 1) continue;
        const q = [s[1]! * e1[2]! - s[2]! * e1[1]!, s[2]! * e1[0]! - s[0]! * e1[2]!, s[0]! * e1[1]! - s[1]! * e1[0]!];
        const w = (d[0]! * q[0]! + d[1]! * q[1]! + d[2]! * q[2]!) / det;
        if (w < 0 || u + w > 1) continue;
        best = Math.max(best, (e2[0]! * q[0]! + e2[1]! * q[1]! + e2[2]! * q[2]!) / det);
      }
      return best;
    };
    const gaps: number[] = [];
    for (let v = 0; v < paint.length; v += 3) {
      if (paint[v] !== TREE_PAINT.ivy) continue;
      const y = positions[v * 3 + 1]!;
      if (y > -R * 0.08) continue;
      const x = positions[v * 3]!;
      const z = positions[v * 3 + 2]!;
      gaps.push(Math.hypot(x, z) - surface(Math.atan2(z, x), y));
    }
    expect(gaps.length).toBeGreaterThan(50);
    // Пасмо лягає на поверхню: 90% листків — у вузькій смузі біля неї, і
    // майже нічого не сховано в камені. Стара версія вгадувала радіус
    // лінійним звуженням: смуга була ~0.2R, найглибші 5% листків сиділи в
    // камені на 0.13–0.17R, а інші відрізки того ж пасма стирчали назовні.
    const sorted = [...gaps].sort((a, b) => a - b);
    const p05 = sorted[Math.floor(0.05 * (sorted.length - 1))]!;
    const p95 = sorted[Math.floor(0.95 * (sorted.length - 1))]!;
    expect(p05).toBeGreaterThan(-R * 0.06);
    expect(p95 - p05).toBeLessThan(R * 0.13);
  });

  it('підошва — великі грані за референсом (ADR-0226): глибше ґрунту кільця не густіші за 12 вершин', () => {
    const { positions, paint } = isle.island;
    const rings = new Map<number, Set<string>>();
    for (let v = 0; v < paint.length; v += 1) {
      if (paint[v] !== TREE_PAINT.cliff) continue;
      const y = positions[v * 3 + 1]!;
      // Край, спідниця й ґрунт тримають 24 вершини, щоб стулитися з травою без щілини.
      if (y > -R * 0.2) continue;
      const band = Math.round(y / (R * 0.3));
      const set = rings.get(band) ?? new Set<string>();
      set.add(`${positions[v * 3]!.toFixed(5)}:${y.toFixed(5)}:${positions[v * 3 + 2]!.toFixed(5)}`);
      rings.set(band, set);
    }
    expect(rings.size).toBeGreaterThan(2);
    for (const set of rings.values()) expect(set.size).toBeLessThanOrEqual(13);
  });

  it('детерміновано: та сама дата — побітово той самий острів', () => {
    const again = buildTreeIsland('2022-12-26', R);
    expect(Array.from(again.island.positions)).toEqual(Array.from(isle.island.positions));
    expect(Array.from(again.debris.positions)).toEqual(Array.from(isle.debris.positions));
  });
});
