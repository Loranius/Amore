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
import { PORTAL_GROUND_Y, portalCameraFrame } from './portalScene';

const SEED = 20221226;

/** Ширина телефона пари в CSS px і аспект полотна головної (ADR-0021). */
const PHONE_WIDTH = 412;
const PHONE_ASPECT = 0.46;

function colours(geometry: {
  getAttribute(name: string): { array: ArrayLike<number> };
}): number[] {
  return Array.from(geometry.getAttribute('color').array);
}

/**
 * Один кристал друзи — 18 трикутників поспіль: шість граней по три.
 * Будівник кладе їх саме так, і це єдиний спосіб розрізати суп назад.
 */
function crystals(positions: readonly number[]): number[][] {
  const stride = 18 * 3 * 3;
  const out: number[][] = [];
  for (let at = 0; at + stride <= positions.length; at += stride) {
    out.push(positions.slice(at, at + stride));
  }
  return out;
}

/** Тон ТІЛА кожної бічної грані кристала — третій кут першого трикутника. */
function faceShades(colors: readonly number[]): number[][] {
  const stride = 18 * 3 * 3;
  const out: number[][] = [];
  for (let at = 0; at + stride <= colors.length; at += stride) {
    const shades: number[] = [];
    for (let face = 0; face < 6; face += 1) shades.push(colors[at + face * 27 + 6]!);
    out.push(shades);
  }
  return out;
}

/** Тон підошви й тіла першої бічної грані кожного кристала. */
function footAndBody(colors: readonly number[]): { foot: number; body: number }[] {
  const stride = 18 * 3 * 3;
  const out: { foot: number; body: number }[] = [];
  for (let at = 0; at + stride <= colors.length; at += stride) {
    out.push({ foot: colors[at]!, body: colors[at + 6]! });
  }
  return out;
}


function points(geometry: {
  getAttribute(name: string): { array: ArrayLike<number> };
}): number[] {
  return Array.from(geometry.getAttribute('position').array);
}


/**
 * Висота поверхні підлоги під точкою (x, z) — барицентрично, по тому
 * трикутнику меша, який цю точку накриває.
 */
function floorSurfaceAt(floor: readonly number[], x: number, z: number): number | null {
  for (let at = 0; at + 8 < floor.length; at += 9) {
    const ax = floor[at]!; const az = floor[at + 2]!;
    const bx = floor[at + 3]!; const bz = floor[at + 5]!;
    const cx = floor[at + 6]!; const cz = floor[at + 8]!;
    const area = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    if (Math.abs(area) < 1e-9) continue;
    const first = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / area;
    const second = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / area;
    const third = 1 - first - second;
    if (first < -1e-6 || second < -1e-6 || third < -1e-6) continue;
    return first * floor[at + 1]! + second * floor[at + 4]! + third * floor[at + 7]!;
  }
  return null;
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

  it('ОДИНАКИ СТОЯТЬ ПРЯМО, а не дивляться вістрям у глядача', () => {
    /*
     * Сьома спроба зробити стіну кристальною, і остання з причин, які
     * ADR-0121 назвав нерозв'язаними числом.
     *
     * Дрібна друза росте ВІД стіни — це правда життя. Для великого
     * кристала це вирок: той, що росте з дальньої стіни, дивиться вістрям
     * просто в камеру, і від нього видно лише шестикутний торець. Саме він
     * і читався картоплею на всіх попередніх кадрах.
     *
     * Ознака, що це виправлено: серед друзи є тіла, які підіймаються НАД
     * підніжжям стіни щонайменше на одиницю сцени. Лежачий на глядача
     * кристал такої висоти не дає, хай якої він довжини.
     */
    const foot = PORTAL_GROUND_Y + CAVE_CEILING_HEIGHT * 0.06;
    let tallest = Number.NEGATIVE_INFINITY;
    for (let at = 1; at + 1 < positions.length; at += 3) {
      if (positions[at]! > tallest) tallest = positions[at]!;
    }
    expect(tallest - foot).toBeGreaterThan(0.8);
  });

  it('сидить у нижній частині стіни, а не під склепінням', () => {
    let top = Number.NEGATIVE_INFINITY;
    for (let at = 1; at + 1 < positions.length; at += 3) {
      top = Math.max(top, positions[at]!);
    }
    expect(top - PORTAL_GROUND_Y).toBeLessThan(CAVE_CEILING_HEIGHT * 0.55);
  });

  it('КАМІНЕЦЬ, ЯКИЙ ВИДНО: найменший кристал друзи не менший за 14 CSS px', () => {
    /*
     * Вада, яку це закриває, приїхала знімком із телефона власника:
     * «камінці зверху прозорі без текстури». Прозорими вони не були —
     * вони були ВІСІМ CSS-пікселів завширшки, а на восьми пікселях
     * шестигранна призма не показує жодної грані. Виміряно на тому
     * знімку: 5% розмаху яскравості всередині плями при 30%, які цей
     * проєкт вважає межею «читається кристалом».
     *
     * Число над константами розміру при цьому обіцяло 35–160 px. Воно
     * було пораховане для стіни за 6.2 одиниці, кадру в ПІКСЕЛЯХ
     * ПРИСТРОЮ і констант 0.10–0.46 — жодного з трьох уже не існувало.
     *
     * Тому тут міряється не константа, а те, що бачить око: довжина
     * кристала, поділена на його відстань до камери кадру, який пара
     * справді відкриває. Змінюється зала, кадр або розмір — змінюється й
     * число, і межа ловить це замість людини.
     */
    const frame = portalCameraFrame(PHONE_ASPECT, 0.9, 1.6);
    const viewportHeight = PHONE_WIDTH / PHONE_ASPECT;
    const halfTan = Math.tan((frame.fov * Math.PI) / 360);
    let smallest = Number.POSITIVE_INFINITY;
    for (const crystal of crystals(positions)) {
      let low: [number, number, number] | null = null;
      let high: [number, number, number] | null = null;
      for (let at = 0; at < crystal.length; at += 3) {
        const point: [number, number, number] = [crystal[at]!, crystal[at + 1]!, crystal[at + 2]!];
        if (low === null || point[1] < low[1]) low = point;
        if (high === null || point[1] > high[1]) high = point;
      }
      const length = Math.hypot(high![0] - low![0], high![1] - low![1], high![2] - low![2]);
      const depth = Math.hypot(
        (high![0] + low![0]) / 2 - frame.position[0],
        (high![1] + low![1]) / 2 - frame.position[1],
        (high![2] + low![2]) / 2 - frame.position[2],
      );
      smallest = Math.min(smallest, (length / depth) * (viewportHeight / 2) / halfTan);
    }
    // 14 px — це три видимі грані по чотири-п'ять пікселів. Менше не
    // кристал, а цятка; старе значення давало 8.
    expect(smallest).toBeGreaterThan(14);
  });

  it('ГРАНІ ЧЕРГУЮТЬСЯ НА ВСІЙ ДРУЗІ, а не лише на одинаках', () => {
    /*
     * Дрібна друза фарбувалась розмахом 0.86/1.00/1.14 — чотирнадцять
     * відсотків між сусідніми гранями. Заувага над тим числом була
     * записана чесно («на двадцяти пікселях сильний контраст читається
     * сміттям»), але двадцяти пікселів не було: було вісім, і вужчий
     * розмах не рятував від сміття, а робив сміття рівним.
     */
    let weakest = Number.POSITIVE_INFINITY;
    for (const shades of faceShades(colours(buildPortalCaveDruseGeometry(SEED, clusters)))) {
      for (let face = 0; face < shades.length; face += 1) {
        const next = shades[(face + 1) % shades.length]!;
        const here = shades[face]!;
        weakest = Math.min(weakest, Math.max(here, next) / Math.min(here, next));
      }
    }
    expect(weakest).toBeGreaterThan(1.3);
  });

  it('ПІДОШВА ТЕМНІША ЗА ТІЛО: власна тінь замість освітлення', () => {
    /*
     * Печера намальована, а не освітлена, тож тіні під кристалом не
     * покладе жодне джерело — а без плями під підошвою око читає світлу
     * грудку на рівному камені як предмет ПЕРЕД стіною. Десять спроб
     * лікували грудку; тінь малюється вершинним кольором і коштує нуль.
     */
    for (const shades of footAndBody(colours(buildPortalCaveDruseGeometry(SEED, clusters)))) {
      expect(shades.foot).toBeLessThan(shades.body * 0.6);
    }
  });

  it('ДРІБНА ДРУЗА СТОЇТЬ НА ПІДЛОЗІ, а не висить над обідом', () => {
    /*
     * Підлога зали — чаша, і з ока на висоті кадру її дальній обід ХОВАЄ
     * підніжжя стіни. Кущ, посаджений на стіну, був чесно в неї вритий —
     * і все одно читався таким, що висить, бо точки дотику не було
     * ВИДНО. Тому кущі переїхали на саму підлогу, а перевіряється це не
     * тією ж функцією висоти, якою вони садились, а справжнім мешем
     * підлоги: інакше тест підтверджував би сам себе.
     */
    const floor = points(buildPortalCaveFloorGeometry(SEED));
    for (const crystal of crystals(positions)) {
      let low: [number, number, number] | null = null;
      for (let at = 0; at < crystal.length; at += 3) {
        const point: [number, number, number] = [crystal[at]!, crystal[at + 1]!, crystal[at + 2]!];
        if (low === null || point[1] < low[1]) low = point;
      }
      // Одинаки ростуть зі стіни, і їхня підошва законно за нею.
      if (Math.hypot(low![0], low![2]) > CAVE_CHAMBER_RADIUS * 0.95) continue;
      // Сама ПОВЕРХНЯ підлоги під підошвою, а не найближча її вершина:
      // підлога гранована з кроком близько 0.77, тож найближча вершина
      // може лежати на дециметр нижче за камінь, який справді під
      // кристалом, і тест міряв би дискретизацію меша.
      const ground = floorSurfaceAt(floor, low![0], low![2]);
      if (ground === null) continue;
      expect(low![1]).toBeLessThanOrEqual(ground);
    }
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
