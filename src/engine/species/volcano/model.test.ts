import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { CrystalV2Snapshot } from '../crystalV2/model';
import { buildVolcanoGeometry, volcanoFootRadius, volcanoConeRadiusAt, volcanoCrater, volcanoPlacements, volcanoRingHit, volcanoRings, volcanoUndergrowth, volcanoVeinIndices, volcanoVeinPaths } from './geometry';
import { buildVolcanoModel, volcanoLayerThickness, volcanoSlopeRadius } from './model';

// ============================================================
// Підводний вулкан (ADR-0235). Догми власника як тести:
//   «час — основна валюта росту»: вулкан вищає щороку й без подій;
//   події — добриво: насичений рік дає товщий шар;
//   «ніщо не меншає»: старший вулкан не нижчий за молодшого;
//   корал року сидить на шарі свого року; детермінованість.
// ============================================================

const TWIN = fileURLToPath(new URL('../../../../tools/crystal_twin/', import.meta.url));
const read = (path: string) => JSON.parse(readFileSync(`${TWIN}${path}`, 'utf8')) as CrystalV2Snapshot;

const at = (asOf: string, extra: Partial<CrystalV2Snapshot> = {}): CrystalV2Snapshot =>
  ({ startDate: '2012-09-29', asOf, partners: { red: 2, blue: 1 }, ...extra });

describe('вулкан: ріст', () => {
  it('порожня історія: щороку вищий і ширший, але дедалі повільніше', () => {
    const heights = [1, 2, 3, 5, 8, 12, 20, 30].map((y) => buildVolcanoModel(at(`${2012 + y}-09-30`)).height);
    for (let i = 1; i < heights.length; i += 1) expect(heights[i]!).toBeGreaterThan(heights[i - 1]!);
    const early = heights[1]! - heights[0]!;
    const late = heights[7]! - heights[6]!;
    expect(late / 10).toBeLessThan(early);
    expect(heights[7]!).toBeLessThan(3);
  });

  it('старший вулкан не нижчий навіть посеред року: поточний шар росте з часткою прожитого', () => {
    let prev = 0;
    for (const day of ['2020-10-01', '2021-01-15', '2021-05-01', '2021-09-28', '2021-09-30', '2022-03-01']) {
      const h = buildVolcanoModel(at(day)).height;
      expect(h).toBeGreaterThanOrEqual(prev);
      prev = h;
    }
  });

  it('події — добриво: насичений рік дає товщий шар, але не більше ніж на чверть', () => {
    const bare = volcanoLayerThickness(3, 1, 0);
    const rich = volcanoLayerThickness(3, 1, 40);
    const flood = volcanoLayerThickness(3, 1, 10_000);
    expect(rich).toBeGreaterThan(bare);
    expect(flood / bare).toBeLessThanOrEqual(1.25 + 1e-9);
  });

  it('жива історія пари: шарів стільки, скільки років, і вони лягають без щілин', () => {
    const model = buildVolcanoModel(read('fixtures/busy.json'));
    expect(model.layers.length).toBeGreaterThan(0);
    for (let i = 1; i < model.layers.length; i += 1) {
      expect(model.layers[i]!.from).toBeCloseTo(model.layers[i - 1]!.to, 5);
      expect(model.layers[i]!.year).toBe(model.layers[i - 1]!.year + 1);
    }
    expect(model.height).toBeCloseTo(model.layers.at(-1)!.to, 5);
  });

  it('схил: ширший унизу, вузький біля кратера', () => {
    const model = buildVolcanoModel(read('fixtures/busy.json'));
    expect(volcanoSlopeRadius(model, 0)).toBeCloseTo(model.baseRadius, 6);
    expect(volcanoSlopeRadius(model, model.height)).toBeCloseTo(model.craterRadius, 6);
    expect(volcanoSlopeRadius(model, model.height / 2)).toBeLessThan(model.baseRadius);
  });
});

describe('вулкан: сліди модулів (ADR-0237)', () => {
  const plans = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i, date: '2016-05-05' }));

  it('бічні конуси — виконані плани: 3 → 1, 9 → 2, 21 → 3, не більше трьох', () => {
    const count = (n: number) => buildVolcanoModel(at('2030-10-15', { plans: plans(n) })).vents.length;
    expect([0, 2, 3, 8, 9, 20, 21, 500].map(count)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
    const young = buildVolcanoModel(at('2016-10-15', { plans: plans(3) })).vents[0]!;
    const old = buildVolcanoModel(at('2030-10-15', { plans: plans(3) })).vents[0]!;
    // Той самий конус на тому самому місці; з віком вулкана підростає.
    expect(old.azimuth).toBe(young.azimuth);
    expect(old.size).toBeGreaterThan(young.size);
  });

  it('новий вид риб на 5-му, 10-му й 20-му роках разом (власник)', () => {
    const kinds = (y: number) => buildVolcanoModel(at(`${2012 + y}-10-15`)).fishKinds;
    expect([1, 4, 5, 9, 10, 19, 20, 40].map(kinds)).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
  });

  it('спогади — скільки коралів у колонії свого року: 1 на тихий рік, до чотирьох', () => {
    const quiet = buildVolcanoModel(at('2020-10-15'));
    const rich = buildVolcanoModel(at('2020-10-15', { memories: Array.from({ length: 30 }, (_, i) => ({ id: i, date: '2015-05-05' })) }));
    const bodies = (m: typeof quiet, year: number) => volcanoPlacements(m).filter((p) => p.colony.year === year).length;
    expect(bodies(quiet, 2)).toBe(1);
    expect(bodies(rich, 2)).toBe(4);
    expect(bodies(rich, 3)).toBe(1);
  });

  it('нічого не стирчить зі схилу: уся скеля нижче вінця — усередині конуса (власник, 2026-10-05)', () => {
    const rich = buildVolcanoModel(at('2020-10-15', { memories: Array.from({ length: 40 }, (_, i) => ({ id: i, date: '2014-05-05' })) }));
    expect(rich.layers.find((l) => l.year === 1)!.fertility).toBeGreaterThanOrEqual(0.4);
    const rings = volcanoRings(rich);
    const rock = buildVolcanoGeometry(rich).rock.positions;
    for (let i = 0; i < rock.length; i += 3) {
      const [x, y, z] = [rock[i]!, rock[i + 1]!, rock[i + 2]!];
      if (y < 0.05 || y > rich.height * 0.85) continue;
      // Центр грані конуса може випнутися до ~3% — це гранчастість, а не
      // стирчання; прибрані уступи виходили назовні на 4–12%.
      expect(Math.hypot(x, z)).toBeLessThanOrEqual(volcanoConeRadiusAt(rings, Math.atan2(z, x), y) * 1.035 + 1e-6);
    }
  });
});

describe('вулкан: меш', () => {
  const model = buildVolcanoModel(read('fixtures/busy.json'));
  const geometry = buildVolcanoGeometry(model);

  it('конус чистий: усе життя — на плато кільцем довкола підніжжя (референс власника)', () => {
    for (const place of [...volcanoPlacements(model), ...volcanoUndergrowth(model)]) {
      expect(place.base[1]).toBe(0);
      // На плато за справжнім краєм асиметричного підніжжя, не в камені.
      expect(Math.hypot(place.base[0], place.base[2])).toBeGreaterThanOrEqual(volcanoFootRadius(model, Math.atan2(place.base[2], place.base[0])) * 1.0);
    }
  });

  it('колонії років — кільце, що росте назовні: старші ближче до підніжжя', () => {
    // Підніжжя асиметричне: відстань міряється в частках краю під своїм азимутом.
    const firsts = volcanoPlacements(model).filter((p) => p.body === 0).map((p) => Math.hypot(p.base[0], p.base[2]) / volcanoFootRadius(model, Math.atan2(p.base[2], p.base[0])));
    for (let i = 1; i < firsts.length; i += 1) expect(firsts[i]!).toBeGreaterThanOrEqual(firsts[i - 1]! - 1e-9);
  });

  it('ріка витікає з виїмки жерла й лежить над гранями конуса, а не під ними (регресія)', () => {
    // Власник: «лава … витікає десь під текстурами вулкана». Ріка на гладкому
    // конусі пірнала під грані, що випинаються від шуму кілець.
    const crater = volcanoCrater(model);
    const profile = [crater.rim, crater.bulge, ...volcanoRings(model).map((r) => r.points).reverse()];
    const notchIndices = volcanoVeinIndices(model);
    volcanoVeinPaths(model).forEach((path, v) => {
      const notch = crater.rim[notchIndices[v]!]!;
      // Виїмка нижча за сусідні зубці губи.
      const i = notchIndices[v]!;
      const neighbours = [crater.rim[(i + 1) % crater.rim.length]!, crater.rim[(i + crater.rim.length - 1) % crater.rim.length]!];
      for (const n of neighbours) if (!notchIndices.includes(crater.rim.indexOf(n))) expect(notch[1]).toBeLessThan(n[1]);
      // Джерело — у чаші, під виїмкою.
      expect(Math.hypot(path[0]!.at[0], path[0]!.at[2])).toBeLessThan(Math.hypot(notch[0], notch[2]));
      const sub = (path.length - 2) / (profile.length - 1);
      path.slice(1).forEach((point, k) => {
        const a = Math.atan2(point.at[2], point.at[0]);
        const ring = Math.min(profile.length - 1, Math.floor(k / sub));
        const s = ring === profile.length - 1 ? 0 : (k % sub) / sub;
        const lo = volcanoRingHit(profile[ring]!, a).r;
        const hi = s > 0 ? volcanoRingHit(profile[ring + 1]!, a).r : lo;
        expect(Math.hypot(point.at[0], point.at[2])).toBeGreaterThanOrEqual(lo + (hi - lo) * s);
      });
      // Фронт дотику: від жерла (0) монотонно до язика (1).
      for (let k = 1; k < path.length; k += 1) expect(path[k]!.flow).toBeGreaterThanOrEqual(path[k - 1]!.flow);
      expect(path.at(-1)!.flow).toBe(1);
    });
  });

  it('лава не рівна: береги хвилясті й різні ліворуч і праворуч', () => {
    for (const path of volcanoVeinPaths(model)) {
      const body = path.slice(2, -4);
      const left = body.map((p) => p.wl);
      const right = body.map((p) => p.wr);
      expect(left.some((w, k) => k > 0 && w < left[k - 1]!)).toBe(true);
      expect(left.some((w, k) => Math.abs(w - right[k]!) > 1e-3)).toBe(true);
    }
  });

  it('потоки лави тонкі й дозовані (1…3), на дотик доходять до підніжжя (власник, 2026-10-05)', () => {
    expect(model.veins).toBeGreaterThanOrEqual(1);
    expect(model.veins).toBeLessThanOrEqual(3);
    // Тонкі: ширина берега — не більше п'ятої частини радіуса кратера.
    for (const path of volcanoVeinPaths(model)) for (const p of path) expect(Math.max(p.wl, p.wr)).toBeLessThanOrEqual(model.craterRadius * 0.2);
    let low = Infinity;
    for (let i = 1; i < geometry.lava.positions.length; i += 3) low = Math.min(low, geometry.lava.positions[i]!);
    expect(low).toBeLessThan(model.height * 0.1);
  });

  it('жар — на кожній вершині каменю, 0…1; кратер розпечений, підніжжя холодне', () => {
    expect(geometry.rockHeat.length * 3).toBe(geometry.rock.positions.length);
    for (const h of geometry.rockHeat) {
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(1);
    }
    // Корона й чаша — лава; найгарячіше в камені — вал під короною.
    expect(Math.max(...geometry.rockHeat)).toBeGreaterThanOrEqual(0.45);
    expect(Math.max(...geometry.lava.heat)).toBe(1);
    const footHeat = Array.from(geometry.rockHeat).filter((_, i) => geometry.rock.positions[i * 3 + 1]! < 0);
    expect(Math.max(...footHeat)).toBeLessThan(0.3);
  });

  it('усі числа скінченні, трикутники цілі', () => {
    for (const array of [geometry.rock.positions, geometry.corals.positions, geometry.lava.positions]) {
      expect(array.length % 9).toBe(0);
      for (const value of array) expect(Number.isFinite(value)).toBe(true);
    }
    expect(geometry.lava.heat.length * 3).toBe(geometry.lava.positions.length);
    expect(geometry.top).toBeGreaterThanOrEqual(model.height);
  });

  it('детерміновано: той самий знімок — побітово та сама геометрія', () => {
    const again = buildVolcanoGeometry(buildVolcanoModel(read('fixtures/busy.json')));
    expect(Array.from(again.rock.positions)).toEqual(Array.from(geometry.rock.positions));
    expect(Array.from(again.lava.positions)).toEqual(Array.from(geometry.lava.positions));
  });
});

describe('вулкан: без бічних конусів, більше граней (власник, 2026-10-04)', () => {
  const plans = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i, date: '2016-05-05' }));
  const model = buildVolcanoModel(at('2030-10-15', { plans: plans(21) }));

  it('жодна вершина каменю не стирчить зі схилу: бічних конусів немає', () => {
    const rock = buildVolcanoGeometry(model).rock.positions;
    for (let i = 0; i < rock.length; i += 3) {
      const y = rock[i + 1]!;
      if (y < 0.05 || y > model.height * 0.95) continue;
      // Конус асиметричний (до +17% на широкому боці) і з хребтами (+7%),
      // але бічних конусів немає: ніщо не виходить за 1.4 гладкого схилу.
      expect(Math.hypot(rock[i]!, rock[i + 2]!)).toBeLessThan(volcanoSlopeRadius(model, y) * 1.4);
    }
  });

  it('великі фасети: 10 граней довкола, кожна — два трикутники; плани не додають лави (власник, 2026-10-05)', () => {
    const rings = volcanoRings(model);
    for (const ring of rings) expect(ring.points).toHaveLength(10);
    // Кілець небагато: грані високі, а не смуги. Два з них — кам'яний
    // уступ біля підніжжя (2026-10-06).
    expect(rings.length).toBeLessThanOrEqual(7);
    const bare = buildVolcanoModel(at('2030-10-15', { plans: [] }));
    expect(buildVolcanoGeometry(model).lava.positions.length).toBe(buildVolcanoGeometry({ ...model, vents: bare.vents }).lava.positions.length);
    const cone = (rings.length - 1) * 10 * 2;
    const crater = 4 * 10 * 2;
    expect(buildVolcanoGeometry(model).rock.positions.length / 9).toBe(cone + crater);
  });

  it('конус асиметричний: один бік ширший за протилежний', () => {
    const foot = volcanoRings(model)[1]!.points.map((p) => Math.hypot(p[0], p[2]));
    expect(Math.max(...foot) / Math.min(...foot)).toBeGreaterThan(1.2);
  });

  it('бажання додають мешканців по черзі: рибка, медуза, устриця, риба, кит, дельфін, далі — рибки нових кольорів (власник, 2026-10-05)', () => {
    const wishes = (n: number) => Array.from({ length: n }, (_, i) => ({ id: 100 + i, date: `2020-0${1 + (i % 9)}-1${i % 10}`, isShared: true, ownerId: null, fulfilledById: null }));
    const kinds = (n: number) => buildVolcanoModel(at('2030-10-15', { wishes: wishes(n) })).creatures.map((c) => c.kind);
    expect(kinds(0)).toEqual([]);
    expect(kinds(1)).toEqual(['fish']);
    expect(kinds(2)).toEqual(['fish', 'jellyfish']);
    expect(kinds(6)).toEqual(['fish', 'jellyfish', 'oyster', 'bigFish', 'whale', 'dolphin']);
    const nine = buildVolcanoModel(at('2030-10-15', { wishes: wishes(9) })).creatures;
    expect(nine.slice(6).map((c) => c.kind)).toEqual(['fish', 'fish', 'fish']);
    // Кожна нова рибка — свого кольору, не як перша й не як сусідня.
    const hues = [nine[0]!.hue, ...nine.slice(6).map((c) => c.hue)];
    for (let i = 1; i < hues.length; i += 1) expect(Math.abs(hues[i]! - hues[i - 1]!)).toBeGreaterThan(0.1);
    // Порядок — за днем бажання; те саме — побітово те саме.
    expect(buildVolcanoModel(at('2030-10-15', { wishes: wishes(9) })).creatures).toEqual(nine);
    // Не більше тридцяти.
    expect(buildVolcanoModel(at('2030-10-15', { wishes: wishes(45) })).creatures.length).toBe(30);
  });
});

describe('вулкан прокидається з роками (власник, 2026-10-05)', () => {
  const byYears = (y: number) => buildVolcanoModel(at(`${2012 + Math.floor(y)}-${String(1 + Math.round((y % 1) * 11)).padStart(2, '0')}-28`));

  it('сплячий → світіння в кратері → тріщини лави → більший кратер → світиться зсередини', () => {
    const one = byYears(0.8);
    expect(one.glow).toBeLessThan(0.3);
    expect(one.veins).toBe(0);
    expect(one.innerGlow).toBe(0);
    const two = byYears(2.5);
    // Без жодних подій жар — від самого віку; свіжі роки додають до 30%.
    expect(two.glow).toBeGreaterThan(0.5);
    // Щойно кратер засвітився — дві тонкі тріщини (власник, 2026-10-06).
    expect(two.veins).toBe(2);
    const five = byYears(5);
    expect(five.veins).toBeGreaterThanOrEqual(1);
    expect(five.innerGlow).toBe(0);
    const fourteen = byYears(14);
    expect(fourteen.innerGlow).toBeGreaterThan(0.6);
    expect(fourteen.veins).toBeLessThanOrEqual(3);
    // Кратер більшає не лише з висотою: частка кратера від висоти росте.
    expect(byYears(12).craterRadius / byYears(12).height).toBeGreaterThan(0);
    expect(byYears(12).awakening.crater).toBeGreaterThan(byYears(5).awakening.crater);
  });

  it('стадії не стрибають назад: жар, кратер і внутрішнє світло ростуть із роками', () => {
    let prev = byYears(0.5).awakening;
    for (const y of [1, 2, 3, 4, 6, 8, 10, 12, 16, 25]) {
      const next = byYears(y).awakening;
      for (const k of ['glow', 'streams', 'crater', 'inner'] as const) expect(next[k]).toBeGreaterThanOrEqual(prev[k] - 1e-9);
      prev = next;
    }
  });
});
