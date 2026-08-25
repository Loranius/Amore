import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { REEF_EVENT_SOURCE_MODULES } from '../reef/types';
import {
  PORTAL_MODULES,
  PORTAL_MODULE_COUNT,
  yearActivity,
  yearFill,
  yearTogetherness,
} from './relationshipYear';

// ============================================================
// Один рік стосунків на всі види — і жодної другої копії.
// ------------------------------------------------------------
// Кристал і риф рахували наповненість року двома окремими копіями
// одного коду. Формули збігались дослівно, сталі числом, списки модулів
// складом — і трималось це лише на тому, що другу копію зробили з
// першої. Жоден тест їх не порівнював: кожен вид перевіряв себе.
//
// Правило, яке вони обидві виражають, — `PRODUCT.md`, «минуле не
// переписується». Два місця означають два різні минулих.
// ============================================================

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

/** Без коментарів: вони цитують саме той код, що перевіряється. */
const bare = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
    .replace(/^\s*\/\/.*$/gm, '');

describe('модель року живе в одному місці', () => {
  it.each([
    ['кристал', '../crystal/growthModel.ts'],
    ['риф', '../reef/moduleEvolution.ts'],
  ])('%s не має власної копії', (_species, path) => {
    const source = bare(read(path));
    for (const name of ['yearActivity', 'yearTogetherness', 'yearFill']) {
      expect(source, `${name} оголошено локально`).not.toMatch(
        new RegExp(`function\\s+${name}\\s*\\(`),
      );
    }
  });

  it.each([
    ['кристал', '../crystal/growthModel.ts'],
    ['риф', '../reef/moduleEvolution.ts'],
  ])('%s не тримає власних сталих року', (_species, path) => {
    /*
     * Числа були однакові в обох копіях — 12, 60, 0.5, 0.3 — і саме тому
     * розбіжність між ними ніколи б не помітили: тести кожного виду
     * порівнювали його з ним самим.
     */
    const source = bare(read(path));
    for (const name of [
      'YEAR_DEPTH_HALF_SATURATION', 'YEAR_DEPTH_CONSTANT',
      'SHARED_DAYS_OFF_FULL_YEAR', 'TOGETHERNESS_LIFT',
      'EMPTY_YEAR_FLOOR', 'QUIET_YEAR_FLOOR',
    ]) {
      expect(source, `${name} оголошено локально`).not.toMatch(
        new RegExp(`^\\s*(export\\s+)?const\\s+${name}\\s*=`, 'm'),
      );
    }
  });

  it('обидва види рахують ТІ САМІ шість модулів', () => {
    /*
     * Кристал тримав число з коментарем, риф — список. Склад збігався,
     * але порівняти їх не було з чим, тож будь-яка правка одного боку
     * розійшлась би тихо.
     */
    expect([...REEF_EVENT_SOURCE_MODULES].sort()).toEqual([...PORTAL_MODULES].sort());
    expect(PORTAL_MODULE_COUNT).toBe(6);
  });
});

describe('наповненість року поводиться однаково на поганих даних', () => {
  it('нескінченні й нечислові лічильники не роблять NaN', () => {
    /*
     * Це та відмінність, яка між копіями вже БУЛА: у кристала лічильник
     * доводився до скінченного, у рифа — ні. `Math.max(0, NaN)` це NaN, а
     * `Infinity / (Infinity + 12)` теж NaN, тож обрізати знизу мало.
     */
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, -1]) {
      expect(Number.isFinite(yearActivity(bad, 10)), `модулі ${bad}`).toBe(true);
      expect(Number.isFinite(yearActivity(3, bad)), `події ${bad}`).toBe(true);
      expect(Number.isFinite(yearTogetherness(bad)), `вихідні ${bad}`).toBe(true);
    }
  });

  it('порожній рік має підлогу, повний не переростає одиниці', () => {
    expect(yearFill(1, 0)).toBeCloseTo(0.3, 6);
    expect(yearFill(1, 1)).toBeCloseTo(1, 6);
    expect(yearFill(0, 1)).toBe(0);
  });

  it('широта важить більше за обсяг', () => {
    // Причина, з якої міра саме така: у найповнішому році справжньої пари
    // 48 з 80 подій були знімками, і рахунок подій робив із міри лічильник фото.
    const broad = yearActivity(6, 12);
    const deep = yearActivity(1, 120);
    expect(broad).toBeGreaterThan(deep);
  });

  it('спільний час підіймає бідний рік, але не переписує багатий', () => {
    const poor = yearFill(1, 0.1, 0);
    const poorTogether = yearFill(1, 0.1, 1);
    expect(poorTogether).toBeGreaterThan(poor);
    // Лифт додатковий: рік, про який графік мовчить, просто нічого не дістає.
    expect(yearFill(1, 0.8, 0)).toBeLessThan(yearFill(1, 0.8, 1));
    expect(yearFill(1, 1, 1)).toBeCloseTo(yearFill(1, 1, 0), 6);
  });
});
