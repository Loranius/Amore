import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { CrystalV2Snapshot } from '../crystalV2/model';
import { buildVolcanoGeometry, volcanoCrater, volcanoPlacements, volcanoRingHit, volcanoRings, volcanoUndergrowth, volcanoVeinIndices, volcanoVeinPaths } from './geometry';
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

describe('вулкан: бічні конуси — віхи часу', () => {
  it('з\'являються на 6-му, 12-му й 20-му роках і далі підростають', () => {
    const count = (y: number) => buildVolcanoModel(at(`${2012 + y}-10-15`)).vents.length;
    expect([count(5), count(6), count(11), count(12), count(19), count(20), count(40)]).toEqual([0, 1, 1, 2, 2, 3, 3]);
    const young = buildVolcanoModel(at('2019-10-15')).vents[0]!.size;
    const old = buildVolcanoModel(at('2030-10-15')).vents[0]!.size;
    expect(old).toBeGreaterThan(young);
    // Той самий конус на тому самому місці: азимут не стрибає з віком.
    expect(buildVolcanoModel(at('2030-10-15')).vents[0]!.azimuth).toBe(buildVolcanoModel(at('2019-10-15')).vents[0]!.azimuth);
  });
});

describe('вулкан: меш', () => {
  const model = buildVolcanoModel(read('fixtures/busy.json'));
  const geometry = buildVolcanoGeometry(model);

  it('конус чистий: усе життя — на плато кільцем довкола підніжжя (референс власника)', () => {
    for (const place of [...volcanoPlacements(model), ...volcanoUndergrowth(model)]) {
      expect(place.base[1]).toBe(0);
      expect(Math.hypot(place.base[0], place.base[2])).toBeGreaterThanOrEqual(model.baseRadius * 0.97);
    }
  });

  it('колонії років — кільце, що росте назовні: старші ближче до підніжжя', () => {
    const firsts = volcanoPlacements(model).filter((p) => p.body === 0).map((p) => Math.hypot(p.base[0], p.base[2]));
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

  it('ріки лави — від кратера до підніжжя: 3…5 рік', () => {
    expect(model.veins).toBeGreaterThanOrEqual(3);
    expect(model.veins).toBeLessThanOrEqual(5);
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
