import { describe, expect, it } from 'vitest';
import { reefColonyLayout, reefHeadSize } from './colonyFormations';
import { reefStanding } from './reefStaging';
import {
  REEF_LIFE_COLOURS,
  reefUndergrowth,
  type ReefGrowth,
} from './undergrowth';
import {
  buildReefBladeMesh,
  buildReefPebbleMesh,
  buildReefTuftMesh,
} from './undergrowthMesh';

const HEAD = reefHeadSize(12 * 365, 6);
const STANDING = reefStanding(HEAD);

function grown(years = 4, seed = 4242): ReefGrowth[] {
  return reefUndergrowth(HEAD, STANDING, years, seed);
}

function onHead(growths: ReefGrowth[]): ReefGrowth[] {
  return growths.filter((growth) => growth.point.y > 1e-6);
}

/** Значення рівняння купола: 1 — рівно на ідеальній поверхні. */
function domeValue(growth: ReefGrowth): number {
  const { x, y, z } = growth.point;
  return Math.sqrt(
    (x * x + z * z) / (HEAD.radius * HEAD.radius) + (y * y) / (HEAD.rise * HEAD.rise),
  );
}

describe('дрібнота сидить на СПРАВЖНІЙ поверхні', () => {
  it('точки лежать на зміщеному куполі, а не на ідеальному', () => {
    /*
     * Купол зміщений частками до ±30% радіуса. Перша редакція рахувала
     * місце з РІВНЯННЯ еліпсоїда — і на знімку дрібнота плавала над
     * куполом і тонула в ньому по черзі.
     *
     * Ознака проста й неспростовна: на ідеальній поверхні значення
     * рівняння дорівнює одиниці ЗАВЖДИ. Якщо воно гуляє — точки взяті
     * з меша; якщо стоїть на одиниці — з рівняння.
     */
    const values = onHead(grown()).map(domeValue);
    expect(values.length).toBeGreaterThan(20);
    const spread = Math.max(...values) - Math.min(...values);
    expect(spread, 'усе на ідеальному еліпсоїді').toBeGreaterThan(0.15);
    // І все ж це поверхня, а не хмара: розкид обмежений самим шумом.
    expect(Math.min(...values)).toBeGreaterThan(0.6);
    expect(Math.max(...values)).toBeLessThan(1.45);
  });

  it('нормаль дивиться назовні купола', () => {
    for (const growth of onHead(grown())) {
      const outward = growth.point.x * growth.normal.x
        + growth.point.y * growth.normal.y
        + growth.point.z * growth.normal.z;
      expect(outward, 'росте всередину').toBeGreaterThan(0);
      expect(Math.hypot(growth.normal.x, growth.normal.y, growth.normal.z)).toBeCloseTo(1, 4);
    }
  });
});

describe('дрібнота не заступає того, що щось означає', () => {
  it('не лізе в річні колонії', () => {
    /*
     * Колонії — єдине на цьому рифі, що несе історію. Заростити їх
     * дрібнотою означало б сховати літопис під текстурою.
     */
    const colonies = reefColonyLayout(HEAD, 4);
    for (const growth of onHead(grown())) {
      for (const colony of colonies) {
        const gap = Math.hypot(
          growth.point.x - colony.point.x,
          growth.point.y - colony.point.y,
          growth.point.z - colony.point.z,
        );
        expect(gap, 'дрібнота в колонії').toBeGreaterThan(0.05);
      }
    }
  });

  it('камінці лежать на піску, а не на куполі', () => {
    // Камінь лежить, а не тримається: галька на схилі купола читалась
    // би помилкою розкладки.
    for (const growth of grown()) {
      if (growth.kind !== 'pebble') continue;
      expect(growth.point.y, 'камінець на куполі').toBe(0);
    }
  });

  it('те, що на піску, лежить ЗА каменем', () => {
    /*
     * Камінь будується тим самим куполом, тож його край гуляє до +30%.
     * Перша редакція починала кільце з 0.95 радіуса — частина камінців
     * опинялась усередині каменю й стирчала з нього кутами.
     */
    for (const growth of grown()) {
      if (growth.point.y > 1e-6) continue;
      const distance = Math.hypot(growth.point.x, growth.point.z);
      expect(distance).toBeGreaterThan(STANDING.rock.radius * 1.3);
    }
  });
});

describe('дрібнота — не літопис', () => {
  it('кількість не залежить від прожитих років', () => {
    /*
     * Це межа, яку легко перейти непомітно. Дрібнота робить поверхню
     * поверхнею; якби її ставало більше з роками, вона почала б
     * розповідати те саме, що й кільце колоній, тільки нечітко.
     */
    const short = reefUndergrowth(HEAD, STANDING, 1, 7);
    const long = reefUndergrowth(HEAD, STANDING, 20, 7);
    expect(Math.abs(short.length - long.length)).toBeLessThan(short.length * 0.25);
  });

  it('більший риф укритий так само щільно', () => {
    const young = reefHeadSize(365, 2);
    const old = reefHeadSize(25 * 365, 6);
    const youngCount = reefUndergrowth(young, reefStanding(young), 1, 7).length;
    const oldCount = reefUndergrowth(old, reefStanding(old), 25, 7).length;
    expect(oldCount).toBeGreaterThan(youngCount);
  });

  it('усі кольори життя йдуть у діло', () => {
    const used = new Set(grown().filter((g) => g.kind !== 'pebble').map((g) => g.colourIndex));
    expect(used.size).toBe(REEF_LIFE_COLOURS.length);
  });

  it('та сама пара — та сама шкіра', () => {
    expect(grown(4, 11)).toEqual(grown(4, 11));
    expect(grown(4, 11)).not.toEqual(grown(4, 12));
  });
});

describe('три форми мають об’єм', () => {
  it('у кульки є БІК, а не тільки маківка', () => {
    /*
     * Перша перевірка міряла висоту до ширини — і мутація «два кільця
     * замість чотирьох» її проходила: маківка лишалась на місці, тож
     * відношення не мінялось. А ламалось саме те, чого відношення не
     * бачить: у форми з двох кілець немає боку, вона читається пласким
     * папірцем під будь-яким світлом.
     *
     * Міряється те, що зламалось: скільки різних висот має силует.
     */
    const tuft = buildReefTuftMesh();
    const levels = [...new Set(
      Array.from({ length: tuft.positions.length / 3 }, (_v, index) => (
        Math.round(tuft.positions[index * 3 + 1]! * 1000) / 1000
      )),
    )].sort((left, right) => left - right);
    const height = tuft.bounds.max.y - tuft.bounds.min.y;
    let widestGap = 0;
    for (let at = 1; at < levels.length; at += 1) {
      widestGap = Math.max(widestGap, levels[at]! - levels[at - 1]!);
    }
    /*
     * Не кількість рівнів, а найбільший ПРОМІЖОК між ними.
     *
     * Кількість мутацію «два кільця» не ловила: у кожного кільця й так
     * два рівні через голки, тож їх лишалось шість. А ламалось те, що
     * між верхнім кільцем і маківкою з'являлась одна довга грань на
     * пів висоти — вона й читається пласким папірцем.
     */
    expect(widestGap / height, 'силует без боку: одна довга грань').toBeLessThan(0.25);
    const width = tuft.bounds.max.x - tuft.bounds.min.x;
    expect(height / width).toBeGreaterThan(0.8);
  });

  it('камінець приплюснутий — інакше він не камінець', () => {
    const pebble = buildReefPebbleMesh();
    const height = pebble.bounds.max.y - pebble.bounds.min.y;
    const width = pebble.bounds.max.x - pebble.bounds.min.x;
    expect(height).toBeLessThan(width * 0.75);
  });

  it('стрічка вузька — трава, а не папір', () => {
    /*
     * Перша редакція мала ширину 0.13 при висоті 1, і на знімку пучок
     * читався клаптем паперу. Пучок мусить бути ВИЩИМ за себе завширшки
     * настільки, щоб у ньому видно було окремі стрічки.
     */
    const blade = buildReefBladeMesh();
    const height = blade.bounds.max.y - blade.bounds.min.y;
    expect(height).toBeGreaterThan(0.9);

    /*
     * І ШИРИНА САМОЇ СТРІЧКИ, а не пучка. Перша редакція міряла лише
     * висоту — мутація «стрічка знову широка» проходила її повністю,
     * хоч це і є та вада, яку тест описує. Стрічки лежать четвірками
     * вершин, тож перші дві дають ширину основи.
     */
    let widest = 0;
    for (let blade4 = 0; blade4 < blade.positions.length / 3; blade4 += 4) {
      const at = blade4 * 3;
      widest = Math.max(widest, Math.hypot(
        blade.positions[at]! - blade.positions[at + 3]!,
        blade.positions[at + 1]! - blade.positions[at + 4]!,
        blade.positions[at + 2]! - blade.positions[at + 5]!,
      ));
    }
    expect(widest / height, 'стрічка завширшки як папір').toBeLessThan(0.12);
  });

  it('усі три дешеві й коректні', () => {
    for (const [name, mesh] of [
      ['пучок', buildReefBladeMesh()],
      ['кулька', buildReefTuftMesh()],
      ['камінець', buildReefPebbleMesh()],
    ] as const) {
      const vertices = mesh.positions.length / 3;
      expect(mesh.indices.length / 3, `${name}: задорого`).toBeLessThanOrEqual(64);
      expect(mesh.positions.every(Number.isFinite), name).toBe(true);
      expect(mesh.normals).toHaveLength(mesh.positions.length);
      expect(mesh.indices.every((index) => index >= 0 && index < vertices), name).toBe(true);
    }
  });
});
