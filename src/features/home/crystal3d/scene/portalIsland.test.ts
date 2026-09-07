// ============================================================
// Літаючий острів — те, чого про нього не можна побачити оком.
// ------------------------------------------------------------
// Найважливіші тут не форма й не колір, а три речі, кожну з яких уже
// одного разу зламали в цьому проєкті й кожну знайшли кадром, а не
// читанням:
//
//  1. Верх острова мусить лежати рівно там, де рушій ставить кристали.
//     Зсунеться на дециметр — і артефакт зависне або втопиться, а жоден
//     інший файл про це не дізнається.
//  2. Те, що лежить НА камені, мусить сидіти в самому мешеві, а не на
//     кривій, яку той меш апроксимує. Друза печери висіла над підлогою
//     до 0.19 одиниці саме через цю різницю (ADR-0140).
//  3. Брили в небі мусять бути ДАЛІ за камеру. Ближче — і вони не
//     «висять у небі», а затуляють артефакт; оснастка на цьому вже
//     падала.
// ============================================================
import { describe, expect, it } from 'vitest';
import {
  PORTAL_CLOUD_BANKS,
  PORTAL_DRIFT_ROCKS,
  PORTAL_ISLAND_CROWN_TRIANGLES,
  PORTAL_ISLAND_RADIUS,
  PORTAL_ISLAND_RUBBLE,
  buildPortalCloudGeometry,
  buildPortalDriftGeometry,
  buildPortalIslandGeometry,
  buildPortalTempleGeometry,
  portalIslandHeightAt,
  portalIslandRadiusAt,
  portalIslandScale,
} from './portalIsland';

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

/**
 * Висота ПОВЕРХНІ плато під точкою (x, z) — барицентрично, по тому
 * трикутнику верху, який цю точку накриває.
 *
 * Саме поверхні, а не кривої `portalIslandHeightAt`: плато намальоване
 * пласкими трикутниками МІЖ вибірками цієї кривої, і між кільцями хорда
 * провисає. Перевіряти посадку тією ж функцією, якою садили, означало б
 * писати тест, що підтверджує сам себе.
 */
function crownSurfaceAt(crown: readonly number[], x: number, z: number): number | null {
  for (let at = 0; at + 8 < crown.length; at += 9) {
    const ax = crown[at]!; const az = crown[at + 2]!;
    const bx = crown[at + 3]!; const bz = crown[at + 5]!;
    const cx = crown[at + 6]!; const cz = crown[at + 8]!;
    const area = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    if (Math.abs(area) < 1e-9) continue;
    const first = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / area;
    const second = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / area;
    const third = 1 - first - second;
    if (first < -1e-6 || second < -1e-6 || third < -1e-6) continue;
    return first * crown[at + 1]! + second * crown[at + 4]! + third * crown[at + 7]!;
  }
  return null;
}

describe('острів', () => {
  const island = points(buildPortalIslandGeometry(SEED, PORTAL_ISLAND_RUBBLE.high));
  const crown = island.slice(0, PORTAL_ISLAND_CROWN_TRIANGLES * 9);

  it('ПЛОЩИНА АРТЕФАКТА НЕ ЗРУШИЛА: під жеодою верх рівно на нулі', () => {
    /*
     * Нуль тут — не «десь близько до нуля»: `PortalEnvironment` ставить
     * увесь острів на `PORTAL_GROUND_Y` одним `position`, тож локальний
     * нуль І Є та площина, на якій рушій ставить кристали. Горб під
     * жеодою підняв би породу вище за її власну губу.
     *
     * Вікно 0.30 навмисно вужче за саму рівну зону (0.44): межа має
     * стояти за тим, що вона боронить, а не впритул до нього.
     */
    for (let step = 0; step < 64; step += 1) {
      const angle = (step / 64) * Math.PI * 2;
      for (const share of [0, 0.08, 0.16, 0.24, 0.3]) {
        expect(Math.abs(portalIslandHeightAt(SEED, angle, share)), `${angle}/${share}`).toBe(0);
      }
    }
  });

  it('ВЕРХ ДИВИТЬСЯ ВГОРУ: жодна грань плато не вивернута', () => {
    /*
     * Хибна намотка не ламає нічого видимого відразу: геометрія
     * будується, тести проходять — просто плато зникає, бо кожен його
     * трикутник відсікається як зворотна грань. У печері це вже коштувало
     * трьох перезнімань, поки причину шукали в кольорі.
     */
    for (let at = 0; at + 8 < crown.length; at += 9) {
      expect(normalOf(crown, at)[1], `трикутник ${at / 9}`).toBeGreaterThan(0);
    }
  });

  it('ОСТРІВ МАЄ НИЗ: корінь висить під плато, а не обривається кільцем', () => {
    /*
     * З типової камери низу не видно жодним пікселем — і він усе одно
     * мусить бути: у пісочниці власника є вільна камера, а острів без
     * низу з неї читається вирізаним колом, тобто дірою в моделі.
     */
    let deepest = Number.POSITIVE_INFINITY;
    for (let at = 1; at + 1 < island.length; at += 3) {
      deepest = Math.min(deepest, island[at]!);
    }
    expect(deepest).toBeLessThan(-PORTAL_ISLAND_RADIUS * 1.2);
  });

  it('УЛАМКИ ЛЕЖАТЬ НА ПЛАТО, а не над ним і не в ньому', () => {
    /*
     * Та сама вада, що в ADR-0140, і закривається вона тут ще до того, як
     * її хтось побачить: садити на криву `portalIslandHeightAt` не можна,
     * бо намальоване плато — трикутники між її вибірками.
     */
    const rubble = island.slice(PORTAL_ISLAND_CROWN_TRIANGLES * 9);
    let checked = 0;
    for (let at = 0; at + 8 < rubble.length; at += 9) {
      // Обрив і корінь ідуть тим самим мешем; їх видно за тим, що вони
      // нижчі за будь-яку точку плато під собою.
      const x = rubble[at]!; const y = rubble[at + 1]!; const z = rubble[at + 2]!;
      const ground = crownSurfaceAt(crown, x, z);
      if (ground === null) continue;
      if (y < ground - 0.05) continue;
      checked += 1;
      expect(y, `вершина ${at / 9}`).toBeLessThanOrEqual(ground + 0.09);
    }
    expect(checked, 'уламки взагалі знайшлись').toBeGreaterThan(20);
  });

  it('та сама пара дістає той самий острів', () => {
    expect(points(buildPortalIslandGeometry(SEED, PORTAL_ISLAND_RUBBLE.high)))
      .toEqual(island);
  });
});

describe('храм', () => {
  const temple = points(buildPortalTempleGeometry(SEED));
  const crown = points(buildPortalIslandGeometry(SEED, PORTAL_ISLAND_RUBBLE.high))
    .slice(0, PORTAL_ISLAND_CROWN_TRIANGLES * 9);

  it('ПІД КРИСТАЛОМ ХРАМУ НЕМАЄ, і це правило `DESIGN.md`, а не смак', () => {
    /*
     * Попередній світ кристала скасували саме за це: подіум опинився під
     * артефактом, а гладка суцільна поверхня під кристалом читається
     * п'єдесталом, хай як її формувати. Єдина дозволена опора артефакта —
     * жеода.
     *
     * 0.5 радіуса острова — це з запасом більше за саму жеоду: масштаб
     * сцени йде за відстанню камери, тож жеода займає близько 0.42
     * острова в будь-якому віці пари.
     */
    let closest = Number.POSITIVE_INFINITY;
    for (let at = 0; at + 2 < temple.length; at += 3) {
      closest = Math.min(closest, Math.hypot(temple[at]!, temple[at + 2]!));
    }
    expect(closest).toBeGreaterThan(PORTAL_ISLAND_RADIUS * 0.5);
  });

  it('СТОЇТЬ НА ОСТРОВІ: увесь у межах обрису й підошвою в камені', () => {
    let lowest: [number, number, number] | null = null;
    for (let at = 0; at + 2 < temple.length; at += 3) {
      const x = temple[at]!; const y = temple[at + 1]!; const z = temple[at + 2]!;
      const radius = Math.hypot(x, z);
      expect(radius, `вершина ${at / 3} за краєм острова`)
        .toBeLessThan(portalIslandRadiusAt(SEED, Math.atan2(z, x)));
      if (lowest === null || y < lowest[1]) lowest = [x, y, z];
    }
    const ground = crownSurfaceAt(crown, lowest![0], lowest![2]);
    expect(ground, 'підошва храму над плато').not.toBeNull();
    expect(lowest![1]).toBeLessThanOrEqual(ground!);
  });
});

describe('брили в небі', () => {
  const drift = points(buildPortalDriftGeometry(SEED, PORTAL_DRIFT_ROCKS.high));

  it('ЗА КІЛЬЦЕМ КАМЕРИ: жодна не може стати між оком і островом', () => {
    /*
     * Масштаб сцени йде за відстанню камери, тож камера стоїть ЗАВЖДИ на
     * одному радіусі в одиницях острова: 1 / 0.30 ≈ 3.33. Це і робить
     * межу гарантією, а не запасом — вона однакова в перший рік і в
     * сороковий.
     *
     * Перша редакція мала брили від 2.2, тобто ближче за камеру. Кадр
     * показав наслідок одразу: брила перед об'єктивом на пів екрана, і
     * лабораторія чесно впала — «кристала в кадрі немає».
     */
    const cameraRing = 1 / portalIslandScale(1);
    let closest = Number.POSITIVE_INFINITY;
    for (let at = 0; at + 2 < drift.length; at += 3) {
      closest = Math.min(closest, Math.hypot(drift[at]!, drift[at + 2]!));
    }
    expect(closest).toBeGreaterThan(cameraRing * 1.25);
  });

  it('не сидять на острові: усі за його обрисом', () => {
    for (let at = 0; at + 2 < drift.length; at += 3) {
      expect(Math.hypot(drift[at]!, drift[at + 2]!)).toBeGreaterThan(PORTAL_ISLAND_RADIUS);
    }
  });
});

describe('море хмар', () => {
  it('стоїть далі за все інше, інакше воно опиняється за островом', () => {
    /*
     * Промінь, що проходить над дальнім краєм острова, має нахил близько
     * 14° від горизонталі; усе, що нижче, затуляє плато. Хмара ближче за
     * п'ятнадцять радіусів у цю щілину не влазить — вона просто зникає за
     * каменем.
     */
    const clouds = points(buildPortalCloudGeometry(SEED, PORTAL_CLOUD_BANKS.high));
    let closest = Number.POSITIVE_INFINITY;
    for (let at = 0; at + 2 < clouds.length; at += 3) {
      closest = Math.min(closest, Math.hypot(clouds[at]!, clouds[at + 2]!));
    }
    expect(closest).toBeGreaterThan(PORTAL_ISLAND_RADIUS * 12);
  });

  it('порожній профіль якості не малює нічого', () => {
    expect(points(buildPortalCloudGeometry(SEED, PORTAL_CLOUD_BANKS.fallback)).length).toBe(0);
    expect(points(buildPortalDriftGeometry(SEED, PORTAL_DRIFT_ROCKS.fallback)).length).toBe(0);
  });
});

describe('масштаб сцени', () => {
  it('іде за відстанню камери, тож екранний розмір острова сталий', () => {
    /*
     * Це не оптимізація, а сама композиція: кадр порталу підганяється під
     * артефакт, тож камера відходить разом із ним. Острів сталого розміру
     * означав би два різні світи — рівнину за краї кадру в молодої пари й
     * камінець під кристалом у старої.
     */
    const young = portalIslandScale(5.5);
    const old = portalIslandScale(11);
    expect(old / young).toBeCloseTo(2, 5);
    // Півширина кадру дорівнює `відстань × 0.3532`; острів мусить бути
    // вужчим, інакше його краї не потрапляють у кадр — а саме вони й
    // показують, що камінь кінчається.
    for (const distance of [4, 5.5, 8, 11, 14]) {
      expect(portalIslandScale(distance)).toBeLessThan(distance * 0.3532);
    }
  });
});

describe('зерно каменю', () => {
  /*
   * ЩО ЦЕ СТЕРЕЖЕ, І ЯК ВОНО ЗЛАМАЛОСЬ МОВЧКИ. `PortalEnvironment` дає
   * брилам матеріал із картою зерна (`map={rockGrain}`) — а геометрія
   * брил розгортки не мала взагалі: усі вершини йшли з `uv` (0, 0). Карта
   * при цьому не зникає й помилки не дає: вона просто множить колір на
   * ОДИН тексель. Брила виходила пласкою пластиковою плямою поруч із
   * плато, на якому зерно видно, — і в коді все виглядало правильно.
   *
   * Мірка — скільки плиток зерна вкладається в грань. Нуль означає, що
   * розгортки немає; надто багато означає наждак, який на екрані телефона
   * читається шумом (та сама межа, що в ADR-0139 і ADR-0143).
   */
  function tilesPerFace(geometry: {
    getAttribute(name: string): { array: ArrayLike<number> };
  }, from = 0, to = Number.POSITIVE_INFINITY): number {
    const uv = geometry.getAttribute('uv').array;
    const last = Math.min(to, uv.length);
    const spans: number[] = [];
    for (let at = from; at + 5 < last; at += 6) {
      let widest = 0;
      for (const [one, other] of [[0, 2], [2, 4], [0, 4]] as const) {
        widest = Math.max(widest, Math.hypot(
          uv[at + one]! - uv[at + other]!,
          uv[at + one + 1]! - uv[at + other + 1]!,
        ));
      }
      spans.push(widest);
    }
    spans.sort((a, b) => a - b);
    return spans[Math.floor(spans.length / 2)] ?? 0;
  }

  it('лягає на БРИЛИ, а не лише на плато', () => {
    // Виміряно: було 0.00 (розгортки немає), стало 0.83 — тобто грань
    // брили бере майже цілу плитку, як і грань плато (0.54).
    expect(tilesPerFace(buildPortalDriftGeometry(SEED, PORTAL_DRIFT_ROCKS.high)))
      .toBeGreaterThan(0.3);
    expect(tilesPerFace(buildPortalDriftGeometry(SEED, PORTAL_DRIFT_ROCKS.high)))
      .toBeLessThan(4);
  });

  it('лягає на УЛАМКИ на плато', () => {
    // Уламки лежать поруч із камерою й мають ту саму ваду: 0.00 → 1.00.
    const island = buildPortalIslandGeometry(SEED, PORTAL_ISLAND_RUBBLE.high);
    const rubbleFrom = PORTAL_ISLAND_CROWN_TRIANGLES * 6;
    expect(tilesPerFace(island, rubbleFrom)).toBeGreaterThan(0.3);
    expect(tilesPerFace(island, rubbleFrom)).toBeLessThan(4);
  });
});
