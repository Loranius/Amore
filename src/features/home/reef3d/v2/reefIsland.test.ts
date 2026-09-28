import { describe, expect, it } from 'vitest';
import { REEF_PAINT, REEF_WILD_PAINTS, buildReefIsland, inReefWater, reefIslandGround } from './reefIsland';

// ============================================================
// Острів рифу — гранчастий low-poly за референсом власника (ADR-0225,
// раніше ADR-0223). Тести тримають те, що видно оком: є всі частини
// референсу, острів детермінований, край без щілини, підошва великими
// гранями, а камінь у центрі, де ростуть корали пари, вільний від дикої
// живності (колір там заробляє пара, ADR-0219).
// ============================================================

const R = 1.3;
const isle = buildReefIsland('2022-12-26', R);

describe('острів рифу', () => {
  it('має всі частини референсу: плато, скелю, арку й камені, водорості, воду, корали, губки, пластини', () => {
    const used = new Set(Array.from(isle.island.paint));
    // Далечінь і пісок — в оточенні (ADR-0224), не на острові.
    for (const p of Object.values(REEF_PAINT)) if (p !== REEF_PAINT.far && p !== REEF_PAINT.sand) expect(used.has(p)).toBe(true);
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

  it('дика живність не стоїть на камені рифу, де ростуть корали пари', () => {
    const { positions, paint } = isle.island;
    const rock = R * 0.65;
    let wild = 0;
    for (let v = 0; v < paint.length; v += 1) {
      if (!REEF_WILD_PAINTS.includes(paint[v]!)) continue;
      wild += 1;
      // Схили під краєм — не камінь рифу: там губки й зірки на своєму місці.
      if (positions[v * 3 + 1]! < -R * 0.02) continue;
      expect(Math.hypot(positions[v * 3]!, positions[v * 3 + 2]!)).toBeGreaterThan(rock);
    }
    expect(wild).toBeGreaterThan(100);
  });

  it('вода — канал за каменем рифу, а камінь рифу старшого віку туди не заходить', () => {
    expect(isle.water.inner).toBeGreaterThan(R * 0.65);
    expect(isle.water.outer).toBeLessThanOrEqual(R * 0.9 + 1e-9);
    const older = buildReefIsland('2022-12-26', R, R * 0.8);
    expect(older.water.inner).toBeGreaterThan(R * 0.8);
    // Бульбашки піднімаються з самої води.
    expect(inReefWater(isle.water, isle.lagoon.x, isle.lagoon.z)).toBe(true);
  });

  it('підошва — великі грані: під краєм менше вершин, ніж по краю', () => {
    const { positions, paint } = isle.island;
    const rings = new Map<number, Set<string>>();
    for (let v = 0; v < paint.length; v += 1) {
      if (paint[v] !== REEF_PAINT.cliff) continue;
      const y = positions[v * 3 + 1]!;
      if (y > -R * 0.05) continue;
      const band = Math.round(y / (R * 0.4));
      const set = rings.get(band) ?? new Set<string>();
      set.add(`${positions[v * 3]!.toFixed(5)}:${y.toFixed(5)}:${positions[v * 3 + 2]!.toFixed(5)}`);
      rings.set(band, set);
    }
    for (const set of rings.values()) expect(set.size).toBeLessThanOrEqual(24);
  });

  it('у центрі, де ростуть корали пари, лише камінь верхівки', () => {
    const { positions, paint } = isle.island;
    for (let v = 0; v < paint.length; v += 1) {
      if (paint[v] === REEF_PAINT.top || positions[v * 3 + 1]! < 0) continue;
      expect(Math.hypot(positions[v * 3]!, positions[v * 3 + 2]!)).toBeGreaterThan(R * 0.45);
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
    expect(again.water).toEqual(isle.water);
  });
});
