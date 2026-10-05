import { describe, expect, it } from 'vitest';
import { PAINT, buildCrystalIsland } from './crystalIsland';
import { columnAngles } from './sanctuary/columns';

// ============================================================
// Острів кристала за референсом власника (ADR-0221, гранчастий — ADR-0227).
// Тести тримають те, що видно оком: є всі частини референсу, острів
// детермінований, числа цілі, і нічого не лежить у центрі, де росте кристал (The Grown-From Rule: під
// кристалом — ґрунт, а не руїна чи підставка).
// ============================================================

const R = 1.2;
const isle = buildCrystalIsland('2022-12-26', R);

function paints(mesh: ReturnType<typeof buildCrystalIsland>['island']) {
  return new Set(Array.from(mesh.paint));
}

describe('острів кристала', () => {
  it('має всі частини референсу: плити, скелю, колони, плющ, землю — і жодних самоцвітів у скелі (ADR-0227)', () => {
    const used = paints(isle.island);
    // Квіти й пласти породи — святилище ADR-0242.
    for (const p of [PAINT.paving, PAINT.cliff, PAINT.ruin, PAINT.ivy, PAINT.dirt, PAINT.bloom, PAINT.strata]) expect(used.has(p)).toBe(true);
    expect(used.has(PAINT.gem)).toBe(false);
  });

  it('трикутники цілі, числа скінченні, атрибути на кожну вершину', () => {
    const { positions, paint, tone, glow } = isle.island;
    expect(positions.length % 9).toBe(0);
    for (const v of positions) expect(Number.isFinite(v)).toBe(true);
    expect(paint.length * 3).toBe(positions.length);
    expect(tone.length).toBe(paint.length);
    expect(glow.length).toBe(paint.length);
  });

  it('острів не світиться сам: світло — лише від кристала пари (ADR-0227)', () => {
    for (const g of isle.island.glow) expect(g).toBe(0);
  });

  it('підошва — великі грані за референсом (ADR-0227): глибше обідка кільця не густіші за 12 вершин', () => {
    const { positions, paint } = isle.island;
    const rings = new Map<number, Set<string>>();
    for (let v = 0; v < paint.length; v += 1) {
      if (paint[v] !== PAINT.cliff) continue;
      const y = positions[v * 3 + 1]!;
      // Обідок плит тримає 24 вершини, щоб стулитися з землею без щілини.
      if (y > -R * 0.2) continue;
      const band = Math.round(y / (R * 0.3));
      const set = rings.get(band) ?? new Set<string>();
      set.add(`${positions[v * 3]!.toFixed(5)}:${y.toFixed(5)}:${positions[v * 3 + 2]!.toFixed(5)}`);
      rings.set(band, set);
    }
    expect(rings.size).toBeGreaterThan(2);
    for (const set of rings.values()) expect(set.size).toBeLessThanOrEqual(13);
  });

  it('у центрі, де росте кристал, немає руїн і плющу', () => {
    const { positions, paint } = isle.island;
    for (let v = 0; v < paint.length; v += 1) {
      if (paint[v] !== PAINT.ruin && paint[v] !== PAINT.ivy) continue;
      expect(Math.hypot(positions[v * 3]!, positions[v * 3 + 2]!)).toBeGreaterThan(R * 0.5);
    }
  });

  it('спереду колон немає: жодна не затуляє кристал пари від камери (регресія, ADR-0227)', () => {
    // Камера дивиться з +z; передня дуга — ±30° від напрямку на камеру.
    const { positions, paint } = isle.island;
    for (let v = 0; v < paint.length; v += 1) {
      if (paint[v] !== PAINT.ruin || positions[v * 3 + 1]! < R * 0.15) continue;
      const x = positions[v * 3]!;
      const z = positions[v * 3 + 2]!;
      expect(z > 0 && Math.abs(x) < z * Math.tan(Math.PI / 6)).toBe(false);
    }
  });

  it('скеля звисає під островом, руїни стоять над ним', () => {
    let lowest = Infinity;
    for (let v = 0; v < isle.island.paint.length; v += 1) lowest = Math.min(lowest, isle.island.positions[v * 3 + 1]!);
    expect(lowest).toBeLessThan(-R * 1.1);
    expect(isle.ruinTop).toBeGreaterThan(R * 0.5);
  });

  it('між землею під плитами й скелею немає щілини (регресія: крізь тріщину видно нутро)', () => {
    // Край землі й верхнє кільце підошви (світлий обідок плит) мусять бути
    // тими самими точками.
    const { positions, paint } = isle.island;
    const key = (v: number) => `${positions[v * 3]!.toFixed(6)}:${positions[v * 3 + 1]!.toFixed(6)}:${positions[v * 3 + 2]!.toFixed(6)}`;
    const dirt = new Set<string>();
    const cliff = new Set<string>();
    for (let v = 0; v < paint.length; v += 1) {
      if (paint[v] === PAINT.dirt) dirt.add(key(v));
      if (paint[v] === PAINT.cliff || paint[v] === PAINT.ruin) cliff.add(key(v));
    }
    // Шар ґрунту під краєм (2026-10-06) — частина підошви: трикутник землі,
    // що сходить нижче плит, стуляє край так само, як скеля.
    for (let t = 0; t < paint.length / 3; t += 1) {
      if (paint[t * 3] !== PAINT.dirt) continue;
      const low = [0, 1, 2].some((c) => positions[(t * 3 + c) * 3 + 1]! < -R * 0.01);
      if (low) for (let c = 0; c < 3; c += 1) cliff.add(key(t * 3 + c));
    }
    const rim = [...dirt].filter((k) => Math.hypot(Number(k.split(':')[0]), Number(k.split(':')[2])) > R * 0.5);
    expect(rim.length).toBeGreaterThan(0);
    for (const k of rim) expect(cliff.has(k)).toBe(true);
  });

  it('детерміновано: та сама дата — побітово той самий острів', () => {
    const again = buildCrystalIsland('2022-12-26', R);
    expect(Array.from(again.island.positions)).toEqual(Array.from(isle.island.positions));
    expect(Array.from(again.debris.positions)).toEqual(Array.from(isle.debris.positions));
    expect(Array.from(again.ground.positions)).toEqual(Array.from(isle.ground.positions));
  });

  // ── Святилище (ADR-0242) ─────────────────────────────────────

  it('кристал прорвав підлогу: плити серця підняті до нього, плити поля лежать', () => {
    // Найвища точка плит біля кристала (до 0.3 R) вища за найвищу плиту поля.
    const { positions, paint } = isle.island;
    let heart = 0;
    let field = 0;
    for (let v = 0; v < paint.length; v += 1) {
      if (paint[v] !== PAINT.paving) continue;
      const r = Math.hypot(positions[v * 3]!, positions[v * 3 + 2]!);
      const y = positions[v * 3 + 1]!;
      if (r < R * 0.3) heart = Math.max(heart, y);
      else if (r > R * 0.35) field = Math.max(field, y);
    }
    expect(heart).toBeGreaterThan(field + R * 0.02);
  });

  it('земля кристала світиться ЛИШЕ фарбою кристала, і саме вона, а не острів', () => {
    const { glow, paint } = isle.ground;
    expect(glow.some((g) => g > 0)).toBe(true);
    for (let v = 0; v < paint.length; v += 1) expect(paint[v]).toBe(PAINT.gem);
  });

  it('друзи спільних вихідних — у землі кристала (колір колонії), а не в скелі острова', () => {
    const none = buildCrystalIsland('2022-12-26', R, 0);
    const some = buildCrystalIsland('2022-12-26', R, 9);
    expect(some.ground.positions.length).toBeGreaterThan(none.ground.positions.length);
    expect(Array.from(some.island.positions)).toEqual(Array.from(none.island.positions));
  });

  it('бюджет для телефона: острів, земля й уламки разом — до 6 000 трикутників', () => {
    for (const seed of ['2022-12-26', '1990-03-14', '2019-07-01']) {
      const built = buildCrystalIsland(seed, R, 24, 'spring');
      const total = (built.island.positions.length + built.ground.positions.length + built.debris.positions.length) / 9;
      expect(total).toBeLessThan(6000);
    }
  });

  it('колони — не клони: кожна своєї висоти', () => {
    // Верх колони — найвища точка руїни біля її кута.
    const { positions, paint } = isle.island;
    const tops = columnAngles('2022-12-26').map((a) => {
      let top = 0;
      for (let v = 0; v < paint.length; v += 1) {
        if (paint[v] !== PAINT.ruin) continue;
        const x = positions[v * 3]!;
        const z = positions[v * 3 + 2]!;
        const gap = Math.abs(Math.atan2(Math.sin(Math.atan2(z, x) - a), Math.cos(Math.atan2(z, x) - a)));
        if (Math.hypot(x, z) > R * 0.75 && gap < 0.12) top = Math.max(top, positions[v * 3 + 1]!);
      }
      return top;
    });
    expect(tops.every((y) => y > R * 0.3)).toBe(true);
    const sorted = [...tops].sort((x, y) => x - y);
    for (let k = 1; k < sorted.length; k += 1) expect(sorted[k]! - sorted[k - 1]!).toBeGreaterThan(R * 0.01);
  });
});
