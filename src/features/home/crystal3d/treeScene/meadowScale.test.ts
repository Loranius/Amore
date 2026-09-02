// ============================================================
// Луг мусить бути завбільшки з луг, а не з дерево.
// ------------------------------------------------------------
// ЗАПИТ ВЛАСНИКА: «фонова сцена дерева виглядає занадто великою у
// порівнянні з деревом».
//
// Нічого з того, що зламалось, не було видно жодному тесту: розміри лугу
// стояли числами всередині двох React-компонентів, а розмір дерева йшов
// законом росту з рушія. Дві шкали розійшлись, і помітити це можна було
// лише оком на знімку.
//
// Тут вони зведені. Три роди інваріантів:
//
//   1. МЕТР МАЄ АДРЕСУ — `metres()` прив'язаний до тієї самої сталої, під
//      яку масштабує дерево `fitThreeTree`.
//   2. РОЗМІР ПРЕДМЕТА — у метрах, у межах, які можна назвати вголос:
//      трава по коліно, камінь по гомілку, метелик завбільшки з метелика.
//   3. ПРЕДМЕТ ПРОТИ ДЕРЕВА — на справжньому конвеєрі, на віках, які пара
//      справді проживе.
//
// Плюс окремо — регресія на «намальовано за кадром»: метелики й хмари
// малювались щокадру там, куди камера не дивиться.
// ============================================================
import { describe, expect, it } from 'vitest';
import {
  TREE_FIT_HEIGHT,
  fitThreeTree,
  measureThreeTreeReach,
} from '@/engine/renderer/three';
import { buildArtifactFromSnapshot } from '@/engine/evolution/adapters';
import { applyEvolutionSandboxSources } from '@/features/home/evolutionSandbox';
import { portalCameraFrame } from '../scene/portalScene';
import { buildTreeLabPreviewFromArtifact } from '../treeLab/buildTreeLabPreview';
import {
  TREE_MATURE_HEIGHT_METRES,
  TREE_SCENE_UNITS_PER_METRE,
  metres,
} from './sceneScale';
import {
  BUTTERFLY_WING_RADIUS,
  GRASS_MAX_HEIGHT,
  GRASS_MIN_HEIGHT,
  STONE_MAX_HALF_HEIGHT,
  GRASS_CARD_BASE,
  STONE_MAX_HALF_WIDTH,
  buildGrassInstances,
  buildRockInstances,
  butterflyFlight,
  terrainHeight,
  treeMeadowShadows,
} from './meadow';

const START = '2022-12-26';
const DAYS_PER_YEAR = 365.2425;
/** Профіль «середня» — той самий, яким знімалась лабораторія. */
const PROFILE = { cal: 4, plan: 2, wish: 2, place: 3, mem: 8, media: 4, off: 15 };

/** Одиниці сцени → метри. Обернене до `metres()`, і лише для читаних чисел. */
const asMetres = (units: number) => units / TREE_SCENE_UNITS_PER_METRE;

function fitAt(years: number) {
  const days = Math.round(years * DAYS_PER_YEAR);
  const asOf = new Date(Date.parse(`${START}T00:00:00.000Z`) + days * 86_400_000).toISOString();
  const sources = applyEvolutionSandboxSources({
    enabled: true,
    values: {
      relationshipDays: days,
      calendarEvents: Math.round(years * PROFILE.cal),
      completedPlans: Math.round(years * PROFILE.plan),
      fulfilledWishes: Math.round(years * PROFILE.wish),
      visitedPlaces: Math.round(years * PROFILE.place),
      memories: Math.round(years * PROFILE.mem),
      finishedMedia: Math.round(years * PROFILE.media),
      sharedDaysOff: Math.round(years * PROFILE.off),
    },
    asOf,
    relationshipStartedAt: START,
    snapshot: {
      calendarEvents: [], plans: [], wishlistItems: [],
      mapPlaces: [], memories: [], memoryLinks: [], media: [],
    },
  });
  const artifact = buildArtifactFromSnapshot({
    coupleId: 'amore:meadow-scale',
    asOf,
    snapshot: sources.snapshot,
    engineConfig: {
      engineVersion: '1.0.0',
      relationshipStartedAt: START,
      timeZone: 'Europe/Kyiv',
      leapDayPolicy: 'feb-28',
    },
  }).blueprint;
  const build = buildTreeLabPreviewFromArtifact({
    artifact, asOf, lod: 'medium', rulesVersion: 'meadow-scale', asOfPolicy: 'fixed-fixture',
  });
  return fitThreeTree(measureThreeTreeReach(build));
}

/*
 * Три віки, і кожен обраний: реальний вік пари, середина життя й повний
 * термін. Дерева тут будуються по-справжньому, тож кожен зайвий вік — це
 * секунда набору.
 */
const AGES = [3.68, 12, 40] as const;
const fits = new Map(AGES.map((years) => [years, fitAt(years)]));

describe('метр сцени', () => {
  it('прив\'язаний до тієї самої сталої, під яку масштабується дерево', () => {
    // Якби `metres()` жив сам по собі, будь-яка зміна `TREE_FIT_HEIGHT`
    // мовчки розвела б дерево й луг — рівно та вада, яку цей файл стереже.
    expect(metres(TREE_MATURE_HEIGHT_METRES)).toBeCloseTo(TREE_FIT_HEIGHT, 10);
  });

  it('лінійний', () => {
    expect(metres(0)).toBe(0);
    expect(metres(2) - metres(1)).toBeCloseTo(metres(1), 12);
  });
});

describe('розміри лугу в метрах', () => {
  const grass = buildGrassInstances(8, 0.2, 0);
  const rocks = buildRockInstances(8, 0.2, 0);

  it('трава — лугова, а не в людський зріст', () => {
    // Було: жмуток 0.35 одиниці, тобто МЕТР ТРИДЦЯТЬ.
    expect(asMetres(GRASS_MIN_HEIGHT)).toBeGreaterThanOrEqual(0.15);
    expect(asMetres(GRASS_MAX_HEIGHT)).toBeLessThanOrEqual(0.5);
    const tallest = Math.max(...grass.map((i) => i.scaleY)) * GRASS_MAX_HEIGHT;
    expect(asMetres(tallest)).toBeLessThanOrEqual(0.5);
  });

  it('камінь — польовий, а не брила', () => {
    // Було: до 4.9 метра завширшки й трьох заввишки.
    expect(asMetres(STONE_MAX_HALF_HEIGHT * 2)).toBeLessThanOrEqual(1.0);
    expect(asMetres(STONE_MAX_HALF_WIDTH * 2)).toBeLessThanOrEqual(1.4);
    const tallest = Math.max(...rocks.map((i) => i.scaleY)) * 2;
    expect(asMetres(tallest)).toBeLessThanOrEqual(1.0);
  });

  it('метелик — метелик, а не птах', () => {
    // Було 0.105 одиниці розмаху, тобто сорок сім сантиметрів.
    expect(asMetres(BUTTERFLY_WING_RADIUS * 2)).toBeLessThanOrEqual(0.12);
    expect(asMetres(BUTTERFLY_WING_RADIUS * 2)).toBeGreaterThanOrEqual(0.04);
  });

  it('жоден жмуток не висить над землею і не тоне в ній', () => {
    /*
     * Картка опущена нижче нуля рівно настільки, скільки додає позиція;
     * якщо ці два числа розійдуться, трава підстрибне або вгрузне — і на
     * знімку це видно лише впритул, бо жмуток дрібний.
     */
    for (const instance of grass) {
      const ground = terrainHeight(instance.x, instance.z, 8);
      expect(instance.y - ground).toBeCloseTo(instance.scaleY * GRASS_CARD_BASE, 10);
    }
  });
});

describe('предмет проти дерева', () => {
  it.each(AGES.filter((years) => years >= 3))(
    'на %s роках ніщо на лузі не вище за чверть дерева',
    (years) => {
      const fit = fits.get(years)!;
      const tallestGrass = GRASS_MAX_HEIGHT;
      const tallestStone = STONE_MAX_HALF_HEIGHT * 2;
      // Виміряно ДО зміни, вік 3.68: трава 32% висоти дерева, камінь 64%.
      expect(tallestGrass / fit.height).toBeLessThan(0.25);
      expect(tallestStone / fit.height).toBeLessThan(0.25);
    },
  );

  it.each(AGES)('на %s роках тінь не ширша за те, що її кидає', (years) => {
    const fit = fits.get(years)!;
    const shadows = treeMeadowShadows(fit.soilRadius, fit.crownRadius);
    /*
     * Було: підлога 1.9 проти крони 0.44 у трирічної пари — пляма вчетверо
     * ширша за саму крону. Запас 1.15 лишає місце підлозі в нульовому році,
     * але не дає їй перемагати там, де крона вже є.
     */
    expect(shadows.crownScaleX).toBeLessThanOrEqual(Math.max(metres(1.2), fit.crownRadius * 1.15));
    expect(shadows.rootScaleX).toBeLessThanOrEqual(Math.max(metres(0.9), fit.soilRadius * 1.6));
  });
});

describe('метелик усередині кадру', () => {
  /*
   * РЕГРЕСІЯ НА «НАМАЛЬОВАНО ЗА КАДРОМ».
   *
   * Обидва метелики сиділи на сталих висотах 2.15 і 2.72 над землею, а
   * верхнє ребро кадру в трирічної пари стоїть на 1.72 — тобто обидва
   * малювались щокадру там, куди камера не дивиться. Разом із трьома
   * хмарами (їх прибрано) це складало близько 1 200 трикутників у нікуди.
   *
   * Перевірка не на висоту, а на КУТ: далекий предмет може стояти високо й
   * лишатись у кадрі, а близький — ні. Саме на цьому попередній підрахунок
   * «за висотою» ледь не збився.
   */
  const HALF_FOV = (42 / 2) * (Math.PI / 180);
  // Найвужчий екран, який портал бачить, — вертикальний телефон.
  const ASPECT = 0.46;

  it.each(AGES)('на %s роках обидва метелики в полі зору', (years) => {
    const fit = fits.get(years)!;
    const frame = portalCameraFrame(ASPECT, fit.crownRadius, fit.height);
    const eye = frame.position;
    const axis = [
      frame.target[0] - eye[0],
      frame.target[1] - eye[1],
      frame.target[2] - eye[2],
    ] as const;
    const axisLength = Math.hypot(...axis);

    for (const base of butterflyFlight(fit.crownRadius, fit.height)) {
      // Запас на розліт: метелик відходить від бази до пів метра.
      for (const sway of [-metres(0.5), 0, metres(0.5)]) {
        const to = [
          base[0] + sway - eye[0],
          fit.groundY + base[1] + metres(0.18) - eye[1],
          base[2] - eye[2],
        ] as const;
        const length = Math.hypot(...to);
        const cosine = (axis[0] * to[0] + axis[1] * to[1] + axis[2] * to[2])
          / Math.max(1e-9, axisLength * length);
        expect(Math.acos(Math.min(1, Math.max(-1, cosine)))).toBeLessThan(HALF_FOV);
      }
    }
  });
});
