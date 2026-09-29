import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { CrystalV2Snapshot } from '../crystalV2/model';
import { CORAL_CEILING, buildVolcanoGeometry, volcanoPlacements } from './geometry';
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

  it('корали — літопис знизу вгору, але верхівка з кратером лишається голою', () => {
    // Регресія першого кадру лабораторії: корали тонких молодих шарів
    // тіснились під кратером і накривали вершину шапкою.
    const firsts = volcanoPlacements(model).filter((p) => p.body === 0);
    for (let i = 1; i < firsts.length; i += 1) {
      expect(firsts[i]!.base[1]).toBeGreaterThanOrEqual(firsts[i - 1]!.base[1] - 1e-9);
    }
    for (const place of volcanoPlacements(model)) {
      expect(place.base[1]).toBeLessThanOrEqual(model.height * CORAL_CEILING + place.colony.size);
    }
  });

  it('жар — на кожній вершині каменю, 0…1; кратер розпечений, підніжжя холодне', () => {
    expect(geometry.rockHeat.length * 3).toBe(geometry.rock.positions.length);
    for (const h of geometry.rockHeat) {
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(1);
    }
    expect(Math.max(...geometry.rockHeat)).toBeGreaterThanOrEqual(0.8);
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
