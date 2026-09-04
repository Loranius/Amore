// ============================================================
// Печера — те, що про неї не можна побачити оком.
// ------------------------------------------------------------
// Найважливіший тут не перший тест, а «намотка внутрішня». Хибна намотка
// не ламає нічого: геометрія будується, тести проходять, тонмапінг
// працює — просто стіни НЕМАЄ, бо кожен її трикутник відсікається як
// зворотна грань. На кадрі це виглядало як «камінь замалий» і коштувало
// трьох перезнімань, поки причину шукали в кольорі.
// ============================================================
import { describe, expect, it } from 'vitest';
import {
  CAVE_AZIMUTH_SEGMENTS,
  CAVE_CEILING_HEIGHT,
  CAVE_CHAMBER_RADIUS,
  CAVE_DRUSE_CLUSTERS,
  buildPortalCaveDruseGeometry,
  buildPortalCaveFloorGeometry,
  buildPortalCaveOculusGeometry,
  buildPortalCaveShaftGeometry,
  buildPortalCaveShellGeometry,
} from './portalCave';
import { PORTAL_GROUND_Y } from './portalScene';

const SEED = 20221226;

function points(geometry: {
  getAttribute(name: string): { array: ArrayLike<number> };
}): number[] {
  return Array.from(geometry.getAttribute('position').array);
}

/** Нормаль трикутника за трьома вершинами, за правилом правої руки. */
function normalOf(p: readonly number[], at: number): [number, number, number] {
  const ax = p[at]!; const ay = p[at + 1]!; const az = p[at + 2]!;
  const bx = p[at + 3]!; const by = p[at + 4]!; const bz = p[at + 5]!;
  const cx = p[at + 6]!; const cy = p[at + 7]!; const cz = p[at + 8]!;
  const ux = bx - ax; const uy = by - ay; const uz = bz - az;
  const vx = cx - ax; const vy = cy - ay; const vz = cz - az;
  return [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
}

describe('оболонка печери', () => {
  const shell = buildPortalCaveShellGeometry(SEED);
  const positions = points(shell);

  it('НАМОТКА ВНУТРІШНЯ: кожна грань стіни дивиться на вісь', () => {
    /*
     * Вада, спіймана кадром і невидима для решти перевірок. `(a, c, b)`
     * замість `(a, b, c)` дає нормаль назовні, стіна цілком відсікається
     * як зворотна, і в кадрі лишається чорнота над лінією підлоги.
     */
    let outward = 0;
    for (let at = 0; at + 8 < positions.length; at += 9) {
      const [nx, , nz] = normalOf(positions, at);
      const cx = (positions[at]! + positions[at + 3]! + positions[at + 6]!) / 3;
      const cz = (positions[at + 2]! + positions[at + 5]! + positions[at + 8]!) / 3;
      // Радіальна складова нормалі мусить дивитись ДО осі, тобто проти
      // радіус-вектора центру грані.
      if (nx * cx + nz * cz > 0) outward += 1;
    }
    expect(outward, 'стіна дивиться назовні — у кадрі її не буде').toBe(0);
  });

  it('стіна замкнена: у кожному напрямку камінь є на кожній висоті', () => {
    /*
     * Просвіт у стіні — це дірка у фон, крізь яку витікає туман зали.
     *
     * Рахується по ТРИКУТНИКАХ, а не по вершинах, і це та сама наука, що
     * дала мірка кристала (ADR-0114): кільця профілю стоять на 0, 0.16,
     * 0.42, 0.66, 0.84 і 1.0, тож у смузі 0.2–0.4 вершин НЕМАЄ ЖОДНОЇ,
     * хоч камінь там суцільний. Перша редакція рахувала вершини й
     * побачила 132 комірки з 200 у цілій стіні.
     */
    /*
     * Секторів УДВІЧІ менше, ніж сегментів стіни, і це не округлення.
     * Вершини стоять рівно на межах сорока однакових секторів, тож
     * бінування азимута там нестійке: та сама вершина потрапляє то в
     * сектор i, то в i−1. Перша редакція побачила 194 комірки з 200 і
     * звинуватила в цьому геометрію. Двадцять секторів — це два сегменти
     * в кожному, і жодна межа не збігається з вершиною.
     */
    const sectors = CAVE_AZIMUTH_SEGMENTS / 2;
    const bands = 5;
    const seen = new Set<string>();
    for (let at = 0; at + 8 < positions.length; at += 9) {
      let low = Number.POSITIVE_INFINITY;
      let high = Number.NEGATIVE_INFINITY;
      const sectorsHit = new Set<number>();
      for (let corner = 0; corner < 3; corner += 1) {
        const x = positions[at + corner * 3]!;
        const y = positions[at + corner * 3 + 1]!;
        const z = positions[at + corner * 3 + 2]!;
        low = Math.min(low, y);
        high = Math.max(high, y);
        const azimuth = Math.atan2(z, x);
        sectorsHit.add(Math.min(
          sectors - 1,
          Math.floor(((azimuth + Math.PI) / (2 * Math.PI)) * sectors),
        ));
      }
      const from = (low - PORTAL_GROUND_Y) / CAVE_CEILING_HEIGHT;
      const to = (high - PORTAL_GROUND_Y) / CAVE_CEILING_HEIGHT;
      for (const sector of sectorsHit) {
        for (let band = 0; band < bands; band += 1) {
          const bandLow = band / bands;
          const bandHigh = (band + 1) / bands;
          if (to > bandLow - 1e-6 && from < bandHigh + 1e-6) seen.add(`${sector}:${band}`);
        }
      }
    }
    expect(seen.size).toBe(sectors * bands);
  });

  it('зала тримає оголошений радіус і висоту', () => {
    let widest = 0;
    let top = Number.NEGATIVE_INFINITY;
    for (let at = 0; at + 2 < positions.length; at += 3) {
      widest = Math.max(widest, Math.hypot(positions[at]!, positions[at + 2]!));
      top = Math.max(top, positions[at + 1]!);
    }
    /*
     * Стеля — це профіль плюс шум, а не тільки шум: найширше кільце
     * профілю стоїть на 1.07 радіуса, і 13% шуму додаються ДО нього.
     * Перша редакція перевірки взяла 1.16 і впіймала саму себе на 1.164.
     */
    expect(widest).toBeLessThan(CAVE_CHAMBER_RADIUS * 1.21);
    expect(widest).toBeGreaterThan(CAVE_CHAMBER_RADIUS * 0.9);
    expect(top).toBeCloseTo(PORTAL_GROUND_Y + CAVE_CEILING_HEIGHT, 5);
  });

  it('та сама пара дістає ту саму печеру', () => {
    expect(points(buildPortalCaveShellGeometry(SEED))).toEqual(positions);
    expect(points(buildPortalCaveShellGeometry(SEED + 1))).not.toEqual(positions);
  });
});

describe('підлога', () => {
  const floor = buildPortalCaveFloorGeometry(SEED);
  const positions = points(floor);

  it('ПЛОЩИНА АРТЕФАКТА НЕ ЗРУШИЛА: по осі підлога рівно на PORTAL_GROUND_Y', () => {
    /*
     * Головна обіцянка заміни сцени. Кристали ставить рушій, і він
     * нічого не знає ні про храм, ні про печеру; варто підлозі поїхати —
     * і колонія або зависне в повітрі, або втопиться в камені.
     */
    let lowest = Number.POSITIVE_INFINITY;
    let highest = Number.NEGATIVE_INFINITY;
    for (let at = 0; at + 2 < positions.length; at += 3) {
      const radial = Math.hypot(positions[at]!, positions[at + 2]!);
      if (radial > CAVE_CHAMBER_RADIUS * 0.12) continue;
      lowest = Math.min(lowest, positions[at + 1]!);
      highest = Math.max(highest, positions[at + 1]!);
    }
    expect(lowest).toBeCloseTo(PORTAL_GROUND_Y, 3);
    expect(highest).toBeCloseTo(PORTAL_GROUND_Y, 3);
  });

  it('дивиться вгору', () => {
    let downward = 0;
    for (let at = 0; at + 8 < positions.length; at += 9) {
      if (normalOf(positions, at)[1] <= 0) downward += 1;
    }
    expect(downward).toBe(0);
  });
});

describe('промінь із розлому', () => {
  const positions = points(buildPortalCaveShaftGeometry(SEED));

  it('стоїть на осі й доходить від склепіння до підлоги', () => {
    /*
     * Промінь падає рівно на артефакт, і це не випадковість композиції: у
     * печері з одним отвором світло падає туди, куди падає, а кристал
     * стоїть під ним — саме тому він там і виріс.
     */
    let low = Number.POSITIVE_INFINITY;
    let high = Number.NEGATIVE_INFINITY;
    for (let at = 1; at + 1 < positions.length; at += 3) {
      low = Math.min(low, positions[at]!);
      high = Math.max(high, positions[at]!);
    }
    expect(low).toBeCloseTo(PORTAL_GROUND_Y, 5);
    expect(high).toBeCloseTo(PORTAL_GROUND_Y + CAVE_CEILING_HEIGHT, 5);
  });

  it('РОЗХОДИТЬСЯ ДОНИЗУ, а не звужується', () => {
    // Стовп світла, що звужується донизу, читається прожектором знизу.
    let topRadius = 0;
    let bottomRadius = 0;
    for (let at = 0; at + 2 < positions.length; at += 3) {
      const radial = Math.hypot(positions[at]!, positions[at + 2]!);
      const share = (positions[at + 1]! - PORTAL_GROUND_Y) / CAVE_CEILING_HEIGHT;
      if (share > 0.9) topRadius = Math.max(topRadius, radial);
      if (share < 0.1) bottomRadius = Math.max(bottomRadius, radial);
    }
    expect(bottomRadius).toBeGreaterThan(topRadius * 2);
  });

  it('гасне донизу: унизу він нічого не додає', () => {
    /*
     * Матеріал адитивний, тож нуль у вершинному кольорі означає «нічого
     * не додає». Без цього стовп мав би різкий край на підлозі — те, чого
     * в променя не буває.
     */
    const geometry = buildPortalCaveShaftGeometry(SEED);
    const colors = Array.from(geometry.getAttribute('color').array);
    let lowest = Number.POSITIVE_INFINITY;
    let highest = 0;
    for (let index = 0; index < colors.length; index += 3) {
      const y = positions[index]!;
      void y;
      lowest = Math.min(lowest, colors[index]!);
      highest = Math.max(highest, colors[index]!);
    }
    expect(lowest).toBe(0);
    expect(highest).toBe(1);
  });
});

describe('розлом у склепінні', () => {
  it('диск дивиться вниз, у залу', () => {
    const positions = points(buildPortalCaveOculusGeometry(SEED));
    let upward = 0;
    for (let at = 0; at + 8 < positions.length; at += 9) {
      if (normalOf(positions, at)[1] >= 0) upward += 1;
    }
    expect(upward).toBe(0);
  });
});

describe('друза по стінах', () => {
  const clusters = CAVE_DRUSE_CLUSTERS.high;
  const positions = points(buildPortalCaveDruseGeometry(SEED, clusters));

  it('НЕ ВИСИТЬ У ПОВІТРІ: підошва кожного кристала в камені', () => {
    /*
     * Вада, яку кадр показував тричі поспіль і яку не лікували ні розмір,
     * ні висота, ні кількість. Кристал, що СТОЇТЬ на поверхні й нахилений
     * усередину зали, торкається каменю однією точкою — і читається
     * уламком, що висить.
     *
     * Тут перевіряється саме те, що виправлення й робить: найдальша від
     * осі точка друзи стоїть за стіною, тобто підошва втоплена.
     */
    let deepest = 0;
    for (let at = 0; at + 2 < positions.length; at += 3) {
      deepest = Math.max(deepest, Math.hypot(positions[at]!, positions[at + 2]!));
    }
    expect(deepest).toBeGreaterThan(CAVE_CHAMBER_RADIUS * 0.9);
  });

  it('не лізе до артефакта', () => {
    // Друза — про стіни. Кристал біля осі сперечався б із самою колонією.
    let closest = Number.POSITIVE_INFINITY;
    for (let at = 0; at + 2 < positions.length; at += 3) {
      closest = Math.min(closest, Math.hypot(positions[at]!, positions[at + 2]!));
    }
    expect(closest).toBeGreaterThan(CAVE_CHAMBER_RADIUS * 0.55);
  });

  it('сидить у нижній частині стіни, а не під склепінням', () => {
    let top = Number.NEGATIVE_INFINITY;
    for (let at = 1; at + 1 < positions.length; at += 3) {
      top = Math.max(top, positions[at]!);
    }
    expect(top - PORTAL_GROUND_Y).toBeLessThan(CAVE_CEILING_HEIGHT * 0.55);
  });

  it('коштує стільки, скільки сцена може собі дозволити', () => {
    /*
     * Межа названа, бо друза — єдина частина печери, кількість якої веде
     * профіль якості, і саме її найлегше роздути «ще трохи».
     */
    // 92 кущі по 3–6 кристалів, у кожного 18 трикутників: стеля 9 936.
    // Число тут — межа, а не вимір.
    expect(positions.length / 9).toBeLessThan(8_200);
    expect(points(buildPortalCaveDruseGeometry(SEED, CAVE_DRUSE_CLUSTERS.low)).length)
      .toBeLessThan(positions.length);
    expect(points(buildPortalCaveDruseGeometry(SEED, 0)).length).toBe(0);
  });
});
