import { describe, expect, it } from 'vitest';
import { PAINT, buildCrystalIsland } from './crystalIsland';

// ============================================================
// Острів кристала за референсом власника (ADR-0221). Тести тримають те, що
// видно оком: є всі частини референсу, острів детермінований, числа цілі,
// і нічого не лежить у центрі, де росте кристал (The Grown-From Rule: під
// кристалом — ґрунт, а не руїна чи підставка).
// ============================================================

const R = 1.2;
const isle = buildCrystalIsland('2022-12-26', R);

function paints(mesh: ReturnType<typeof buildCrystalIsland>['island']) {
  return new Set(Array.from(mesh.paint));
}

describe('острів кристала', () => {
  it('має всі частини референсу: бруківку, скелю, руїни, плющ, самоцвіти, землю', () => {
    const used = paints(isle.island);
    for (const p of Object.values(PAINT)) expect(used.has(p)).toBe(true);
  });

  it('трикутники цілі, числа скінченні, атрибути на кожну вершину', () => {
    const { positions, paint, tone, glow } = isle.island;
    expect(positions.length % 9).toBe(0);
    for (const v of positions) expect(Number.isFinite(v)).toBe(true);
    expect(paint.length * 3).toBe(positions.length);
    expect(tone.length).toBe(paint.length);
    expect(glow.length).toBe(paint.length);
  });

  it('світяться лише самоцвіти', () => {
    const { paint, glow } = isle.island;
    for (let v = 0; v < paint.length; v += 1) {
      if (glow[v]! > 0) expect(paint[v]).toBe(PAINT.gem);
    }
  });

  it('у центрі, де росте кристал, немає руїн і плющу', () => {
    const { positions, paint } = isle.island;
    for (let v = 0; v < paint.length; v += 1) {
      if (paint[v] !== PAINT.ruin && paint[v] !== PAINT.ivy) continue;
      expect(Math.hypot(positions[v * 3]!, positions[v * 3 + 2]!)).toBeGreaterThan(R * 0.5);
    }
  });

  it('скеля звисає під островом, руїни стоять над ним', () => {
    let lowest = Infinity;
    for (let v = 0; v < isle.island.paint.length; v += 1) lowest = Math.min(lowest, isle.island.positions[v * 3 + 1]!);
    expect(lowest).toBeLessThan(-R * 1.1);
    expect(isle.ruinTop).toBeGreaterThan(R * 0.5);
  });

  it('між землею під плитами й скелею немає щілини (регресія: крізь тріщину видно нутро)', () => {
    // Край землі й верхнє кільце скелі мусять бути тими самими точками.
    const { positions, paint } = isle.island;
    const key = (v: number) => `${positions[v * 3]!.toFixed(6)}:${positions[v * 3 + 1]!.toFixed(6)}:${positions[v * 3 + 2]!.toFixed(6)}`;
    const dirt = new Set<string>();
    const cliff = new Set<string>();
    for (let v = 0; v < paint.length; v += 1) {
      if (paint[v] === PAINT.dirt) dirt.add(key(v));
      if (paint[v] === PAINT.cliff) cliff.add(key(v));
    }
    const rim = [...dirt].filter((k) => Math.hypot(Number(k.split(':')[0]), Number(k.split(':')[2])) > R * 0.5);
    expect(rim.length).toBeGreaterThan(0);
    for (const k of rim) expect(cliff.has(k)).toBe(true);
  });

  it('детерміновано: та сама дата — побітово той самий острів', () => {
    const again = buildCrystalIsland('2022-12-26', R);
    expect(Array.from(again.island.positions)).toEqual(Array.from(isle.island.positions));
    expect(Array.from(again.debris.positions)).toEqual(Array.from(isle.debris.positions));
  });
});
