import { describe, expect, it } from 'vitest';
import { REEF_PAINT, buildReefIsland, reefIslandGround } from './reefIsland';

// ============================================================
// Острів рифу за референсом власника (ADR-0223). Тести тримають те, що
// видно оком: є всі частини референсу, острів детермінований, край без
// щілини, а верхівку в центрі, де ростуть корали пари, займає лише камінь —
// дикі корали лише на схилах (колір на верхівці заробляє пара, ADR-0219).
// ============================================================

const R = 1.3;
const isle = buildReefIsland('2022-12-26', R);

describe('острів рифу', () => {
  it('має всі частини референсу: верхівку, скелю, валуни, водорості, лагуну, корали (глибина — в оточенні, ADR-0224)', () => {
    const used = new Set(Array.from(isle.island.paint));
    for (const p of Object.values(REEF_PAINT)) if (p !== REEF_PAINT.far) expect(used.has(p)).toBe(true);
  });

  it('трикутники цілі, числа скінченні, атрибути на кожну вершину', () => {
    for (const mesh of [isle.island, isle.debris]) {
      expect(mesh.positions.length % 9).toBe(0);
      for (const v of mesh.positions) expect(Number.isFinite(v)).toBe(true);
      expect(mesh.paint.length * 3).toBe(mesh.positions.length);
      expect(mesh.tone.length).toBe(mesh.paint.length);
    }
  });

  it('світиться лише вода лагуни', () => {
    const { paint, glow } = isle.island;
    for (let v = 0; v < paint.length; v += 1) if (glow[v]! > 0) expect(paint[v]).toBe(REEF_PAINT.lagoon);
  });

  it('дикі корали не ростуть на верхівці: вони на схилах, під краєм', () => {
    const { positions, paint } = isle.island;
    let wild = 0;
    for (let v = 0; v < paint.length; v += 1) {
      if (paint[v] !== REEF_PAINT.orange && paint[v] !== REEF_PAINT.pink) continue;
      wild += 1;
      // Гілка може трохи піднятись над краєм, але не над центром верхівки.
      const r = Math.hypot(positions[v * 3]!, positions[v * 3 + 2]!);
      expect(r).toBeGreaterThan(R * 0.6);
      expect(positions[v * 3 + 1]!).toBeLessThan(R * 0.2);
    }
    expect(wild).toBeGreaterThan(0);
  });

  it('у центрі, де ростуть корали пари, лише камінь верхівки', () => {
    const { positions, paint } = isle.island;
    for (let v = 0; v < paint.length; v += 1) {
      if (paint[v] === REEF_PAINT.top || positions[v * 3 + 1]! < 0) continue;
      expect(Math.hypot(positions[v * 3]!, positions[v * 3 + 2]!)).toBeGreaterThan(R * 0.4);
    }
  });

  it('між краєм верхівки й скелею немає щілини (регресія тріщини острова кристала)', () => {
    const { positions, paint } = isle.island;
    const rimY = reefIslandGround(R, R);
    const key = (v: number) => `${positions[v * 3]!.toFixed(6)}:${positions[v * 3 + 2]!.toFixed(6)}`;
    const top = new Set<string>();
    const cliff = new Set<string>();
    for (let v = 0; v < paint.length; v += 1) {
      if (Math.abs(positions[v * 3 + 1]! - rimY) > 1e-6) continue;
      // Верхівка пласка: на висоті краю лежать і внутрішні кільця — беремо лише край.
      if (Math.hypot(positions[v * 3]!, positions[v * 3 + 2]!) < R * 0.9) continue;
      if (paint[v] === REEF_PAINT.top) top.add(key(v));
      if (paint[v] === REEF_PAINT.cliff) cliff.add(key(v));
    }
    expect(top.size).toBe(24);
    for (const k of top) expect(cliff.has(k)).toBe(true);
  });

  it('скеля — гострий клин донизу', () => {
    let lowest = Infinity;
    for (let v = 0; v < isle.island.paint.length; v += 1) lowest = Math.min(lowest, isle.island.positions[v * 3 + 1]!);
    expect(lowest).toBeLessThan(-R * 1.3);
  });

  it('детерміновано: та сама дата — побітово той самий острів', () => {
    const again = buildReefIsland('2022-12-26', R);
    expect(Array.from(again.island.positions)).toEqual(Array.from(isle.island.positions));
    expect(again.lagoon).toEqual(isle.lagoon);
  });
});
