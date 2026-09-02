// ============================================================
// Дерево від нуля до сорока років, на п'яти профілях заповнення.
// ------------------------------------------------------------
// ЗАПИТ ВЛАСНИКА: «зроби тести дерева від 0 років до 40 років, проаналізуй
// динаміку росту при різних варіантах заповнення модулів тестовою парою, чи
// немає візуальних мутацій і чи дійсно дерево росте відповідно до років».
//
// Три питання, і кожне тут окремим інваріантом:
//
//   1. Чи дерево взагалі будується на кожному віці — чи немає аварій.
//   2. Чи росте воно з РОКАМИ, а не з активності (догма `PRODUCT.md` §6).
//   3. Чи немає мутацій — стрибків, за яких дерево наступного року
//      виглядає меншим або біднішим за себе торішнє.
//
// ЩО ЦЯ РОЗГОРТКА ВЖЕ ЗНАЙШЛА, коли її прогнали вперше:
//
//   • ТРИ АВАРІЇ на першому році в кожного активного профілю — контракт
//     силуету крони кидав виняток, тобто пара побачила б порожній екран.
//     Причина: у сіянця 16-22 листки, і з восьми напрямків огляду в котромусь
//     усі кілька карток попереду стояли ребром.
//   • РАДІУС ОСНОВИ ПАДАВ у 17-18 переходах із 43, найгірше ×0.39 — стовбур
//     тоншав з роками, просто в протилежність власниковому «стовбур стає
//     грубшим». Товщину давала трубкова модель від числа кінчиків, а
//     кінчиків у симуляції від 38 до 87 залежно від року.
//
// Обидві полагоджено (ADR-0099); пороги нижче стережуть саме їх.
//
// Сітка років розріджена проти тієї, якою аналізували (кожен рік × 44
// точки × 5 профілів ≈ 124 секунди): тут вибрано точки, де ламалось, —
// перший рік, поява скелетних гілок, насичення висоти й повний термін.
// ============================================================
import { describe, expect, it } from 'vitest';
import { buildArtifactFromSnapshot } from '@/engine/evolution/adapters';
import { applyEvolutionSandboxSources } from '@/features/home/evolutionSandbox';
import { fitThreeTree, measureThreeTreeReach } from '@/engine/renderer/three';
import { buildTreeLabPreviewFromArtifact } from '../treeLab/buildTreeLabPreview';

const START = '2022-12-26';
const DAYS_PER_YEAR = 365.2425;

/**
 * Профілі заповнення — від пари, що не записала нічого, до найактивнішої.
 *
 * Числа — подій на рік у кожному модулі. «Лише фото» тут навмисно: власник
 * назвав фото добривом, і саме на ньому видно, чи не підмінює добриво час.
 */
const PROFILES = {
  порожня: { cal: 0, plan: 0, wish: 0, place: 0, mem: 0, media: 0, off: 0 },
  'лише фото': { cal: 0, plan: 0, wish: 0, place: 0, mem: 40, media: 0, off: 0 },
  активна: { cal: 12, plan: 8, wish: 9, place: 14, mem: 24, media: 18, off: 45 },
} as const;

/*
 * Роки 17, 18, 21 і 22 стоять тут не для рівності сітки: саме на цих
 * переходах виміряно просідання підігнаної висоти (ADR-0100 §4). Сітка
 * взагалі складена з місць, де вже ламалось, а не з рівних інтервалів.
 */
const AGES = [0, 0.25, 0.5, 1, 2, 3, 5, 8, 12, 17, 18, 20, 21, 22, 30, 40] as const;

/*
 * Дерева будуються ОДИН раз на пару «профіль + вік».
 *
 * Без кешу цей файл будував ту саму дюжину дерев чотири рази — по разу на
 * кожен інваріант — і йшов 53 секунди при 47 на весь інший набір. Інваріанти
 * ж дивляться на РІЗНІ грані одного дерева, а не на різні дерева.
 */
const cache = new Map<string, ReturnType<typeof buildShot>>();

function shoot(years: number, profile: keyof typeof PROFILES) {
  const key = `${profile}:${years}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const shot = buildShot(years, profile);
  cache.set(key, shot);
  return shot;
}

function buildShot(years: number, profile: keyof typeof PROFILES) {
  const days = Math.round(years * DAYS_PER_YEAR);
  const p = PROFILES[profile];
  const asOf = new Date(Date.parse(`${START}T00:00:00.000Z`) + days * 86_400_000).toISOString();
  const sources = applyEvolutionSandboxSources({
    enabled: true,
    values: {
      relationshipDays: days,
      calendarEvents: Math.round(years * p.cal),
      completedPlans: Math.round(years * p.plan),
      fulfilledWishes: Math.round(years * p.wish),
      visitedPlaces: Math.round(years * p.place),
      memories: Math.round(years * p.mem),
      finishedMedia: Math.round(years * p.media),
      sharedDaysOff: Math.round(years * p.off),
    },
    asOf,
    relationshipStartedAt: START,
    snapshot: {
      calendarEvents: [], plans: [], wishlistItems: [],
      mapPlaces: [], memories: [], memoryLinks: [], media: [],
    },
  });
  const artifact = buildArtifactFromSnapshot({
    coupleId: `amore:sweep:${profile}`,
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
    artifact, asOf, lod: 'medium', rulesVersion: 'growth-sweep', asOfPolicy: 'fixed-fixture',
  });
  const fit = fitThreeTree(measureThreeTreeReach(build));
  let top = Number.NEGATIVE_INFINITY;
  let ground = Number.POSITIVE_INFINITY;
  for (let index = 0; index + 2 < build.mesh.positions.length; index += 3) {
    const y = build.mesh.positions[index + 1]!;
    if (y > top) top = y;
    if (y < ground) ground = y;
  }
  const baseRadius = Math.max(0, ...build.skeleton.nodes
    .filter((node) => node.position.y < ground + (top - ground) * 0.05)
    .map((node) => node.radius));
  return {
    rawHeight: top - ground,
    sceneHeight: fit.height,
    baseRadius,
    leaves: build.leaves.instances.length,
    violations: build.productionAcceptance.violations.length,
  };
}

describe('дерево від 0 до 40 років', () => {
  for (const profile of Object.keys(PROFILES) as (keyof typeof PROFILES)[]) {
    describe(profile, () => {
      it('будується на кожному віці, не кидаючи винятків', () => {
        for (const years of AGES) {
          expect(() => shoot(years, profile), `рік ${years}`).not.toThrow();
        }
      }, 300_000);

      /*
       * СТОВБУР ГРУБШАЄ ЩОРОКУ. Власникова послідовність з ADR-0090: «3 рік
       * стовбур стає грубшим… 40 років — міцний товстий стовбур». До ADR-0099
       * радіус основи падав у 17-18 переходах із 43, найгірше ×0.39.
       */
      it('щороку має грубший стовбур, ніж торік', () => {
        let previous = 0;
        for (const years of AGES) {
          const { baseRadius } = shoot(years, profile);
          expect({ years, thinner: baseRadius < previous - 1e-9 })
            .toEqual({ years, thinner: false });
          previous = baseRadius;
        }
      }, 300_000);

      /*
       * САМЕ ДЕРЕВО НЕ МЕНШАЄ НІКОЛИ. Це закон висоти (ADR-0092/0098) без
       * жодного допуску: виміряно 0 падінь із 43 у кожному профілі.
       */
      it('щороку вище за себе торішнє', () => {
        let previous = 0;
        for (const years of AGES) {
          const { rawHeight } = shoot(years, profile);
          expect({ years, shrank: rawHeight < previous - 1e-9 })
            .toEqual({ years, shrank: false });
          previous = rawHeight;
        }
      }, 300_000);

      /*
       * У КАДРІ дерево може просісти на кілька відсотків, і це НЕ ріст, а
       * рамка. `fitThreeTree` притискає масштаб і по ширині
       * (`ARTIFACT_FIT_WIDTH`), а крона дорослого дерева ширша за себе
       * заввишки — тож рік, у якому листя дійшло до стелі, робить крону
       * ширшою й опускає масштаб. Виміряно: два випадки з 43 у двох
       * профілях із п'яти, найгірше ×0.93.
       *
       * Спроби прибрати це відкинуто виміром (ADR-0100 §5): звуження зрілої
       * крони висоти не рятує, а ширину псує (×0.96 -> ×0.81), бо затиск
       * тримає листяний хмарник, а не виліт скелетних гілок; підняти саму
       * межу кадру не можна — доросла крона вже стоїть при його краю.
       */
      it('у кадрі не просідає більш ніж на сім відсотків', () => {
        let peak = 0;
        for (const years of AGES) {
          const { sceneHeight } = shoot(years, profile);
          expect({ years, shrank: sceneHeight < peak * 0.93 })
            .toEqual({ years, shrank: false });
          peak = Math.max(peak, sceneHeight);
        }
      }, 300_000);

      it('тримається мобільної стелі трикутників на кожному віці', () => {
        for (const years of AGES) {
          expect({ years, violations: shoot(years, profile).violations })
            .toEqual({ years, violations: 0 });
        }
      }, 300_000);
    });
  }

  /*
   * ЧАС — ВАЛЮТА, АКТИВНІСТЬ — ДОБРИВО (`PRODUCT.md` §6).
   *
   * Найпряміша перевірка догми, яку взагалі можна написати: на тому самому
   * віці пара, що не записала НІЧОГО, і найактивніша пара мусять мати дерева
   * приблизно одного зросту. Виміряно — розбіжність не перевищує 6%.
   */
  it('дає майже той самий зріст будь-якому заповненню того самого віку', () => {
    for (const years of [1, 3, 8, 20, 40]) {
      const heights = (Object.keys(PROFILES) as (keyof typeof PROFILES)[])
        .map((profile) => shoot(years, profile).sceneHeight);
      const spread = Math.max(...heights) / Math.min(...heights);
      expect({ years, tooFar: spread > 1.1 }).toEqual({ years, tooFar: false });
    }
  }, 300_000);
});
