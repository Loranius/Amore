// ============================================================
// Догма: час — основна валюта росту (PRODUCT.md §6).
// ------------------------------------------------------------
// Власник, дослівно: «з кожним роком будь-який об'єкт стає дорослішим разом
// із парою, навіть якщо подій і фото немає ніяких. Події і фото просто
// закріплюють і підживлюють ріст, як добриво, але час — основна валюта».
//
// Тому вся ця перевірка йде на ПОРОЖНЬОМУ знімку: ані події, ані плану, ані
// фотографії. Пара, яка нічого не записала, — це не крайній випадок і не
// поганий вхід; це найсуворіше прочитання догми, і саме на ньому вона
// падала. Виміряно до виправлення (висота меша дерева по роках):
//
//   1 -> 2.46   2 -> 4.15   3 -> 4.81   5 -> 5.88   8 -> 7.15
//  12 -> 9.29  20 -> 14.48  30 -> 14.41  40 -> 6.97
//
// Сорокарічне дерево виходило НИЖЧИМ за восьмирічне. Тести того часу цього
// не бачили, бо жоден не питав, чи об'єкт більший за самого себе рік тому.
// ============================================================
import { describe, expect, it } from 'vitest';
import { buildArtifactFromSnapshot } from '@/engine/evolution/adapters';
import { TREE_SCAFFOLD_REACH_SHARE } from '@/engine/species/tree';
import { buildReefPlan } from '@/engine/species/reef';
import { buildTreeLabPreviewFromArtifact } from '../treeLab/buildTreeLabPreview';
import { buildCrystalPipelineStates } from './crystalPipeline';

const START = '1990-01-01';
const DAYS_PER_YEAR = 365.2425;

/** Ані події, ані плану, ані знімка — рівно те, що догма мусить витримати. */
const EMPTY_SNAPSHOT = {
  calendarEvents: [], plans: [], wishlistItems: [],
  mapPlaces: [], memories: [], memoryLinks: [], media: [],
};

const asOfAfter = (years: number) =>
  new Date(Date.parse(`${START}T00:00:00.000Z`) + years * DAYS_PER_YEAR * 86_400_000).toISOString();

/*
 * Роки взято рідше, ніж рік за роком, і це компроміс часу збірки, а не
 * послаблення: дерево будується близько пів секунди, тож повні сорок років
 * на три пари — це хвилина в кожному прогоні. Розгортку рік за роком
 * прогнано окремо (0 падінь висоти з 39 на трьох парах), а тут лишились
 * точки, які ловлять саме ті провали, що були: 8 проти 12, 20 проти 30, 40.
 */
const AGES = [1, 2, 3, 5, 8, 12, 20, 30, 40] as const;

function treeBuildAt(years: number, coupleId: string) {
  const asOf = asOfAfter(years);
  const artifact = buildArtifactFromSnapshot({
    coupleId, asOf, snapshot: EMPTY_SNAPSHOT,
    engineConfig: {
      engineVersion: '1.0.0', relationshipStartedAt: START,
      timeZone: 'Europe/Kyiv', leapDayPolicy: 'feb-28',
    },
  }).blueprint;
  return buildTreeLabPreviewFromArtifact({
    artifact, asOf, lod: 'medium', rulesVersion: 'dogma-test', asOfPolicy: 'fixed-fixture',
  });
}

function treeHeightAt(years: number, coupleId: string): number {
  const build = treeBuildAt(years, coupleId);
  let top = Number.NEGATIVE_INFINITY;
  for (let index = 1; index < build.mesh.positions.length; index += 3) {
    if (build.mesh.positions[index]! > top) top = build.mesh.positions[index]!;
  }
  return top;
}

function treeWidthAt(years: number, coupleId: string): number {
  const build = treeBuildAt(years, coupleId);
  let reach = 0;
  for (let index = 0; index + 2 < build.mesh.positions.length; index += 3) {
    reach = Math.max(reach, Math.hypot(
      build.mesh.positions[index]!,
      build.mesh.positions[index + 2]!,
    ));
  }
  return reach * 2;
}

describe('час — основна валюта росту', () => {
  describe('дерево', () => {
    it('стає вищим щороку навіть без жодної події', () => {
      for (const coupleId of ['dogma:one', 'dogma:two']) {
        let previous = 0;
        for (const years of AGES) {
          const height = treeHeightAt(years, coupleId);
          expect({ coupleId, years, grew: height > previous })
            .toEqual({ coupleId, years, grew: true });
          previous = height;
        }
      }
    }, 300_000);

    /*
     * Не просто «росте», а росте ПОМІТНО. Сорок років проти восьми мусять
     * відрізнятись у рази, інакше догма виконана буквою: 0.001 на рік теж
     * зростання.
     */
    /*
     * ШИРИНА КРОНИ — теж ріст, і доти вона гуляла: падінь 16-21 із 39 річних
     * переходів, найгірше ×0.41 (рік 21: 2.62 -> 1.01). Причина була в тому,
     * що ширину задавала одна випадкова нижня гілочка, яка цього року
     * пережила скидання, а наступного ні. Відколи крону тримають скелетні
     * гілки з законом вильоту (ADR-0093), гуляють лише прутики ВСЕРЕДИНІ
     * огинальної.
     *
     * Поріг 0.85, а не «жодного падіння»: прутики симуляції подекуди
     * дістають трохи далі за скелет, і їхнє миготіння лишається. Виміряно —
     * найгірше падіння тепер ×0.86 проти ×0.41.
     */
    it('розсуває крону з роками, не даючи їй схлопуватись', () => {
      for (const coupleId of ['dogma:one', 'dogma:two']) {
        let previous = 0;
        for (const years of AGES) {
          const width = treeWidthAt(years, coupleId);
          expect({ coupleId, years, collapsed: width < previous * 0.85 })
            .toEqual({ coupleId, years, collapsed: false });
          previous = Math.max(previous, width);
        }
        // І в підсумку крона таки ширшає в рази, а не тримається на місці.
        expect(treeWidthAt(40, coupleId)).toBeGreaterThan(treeWidthAt(3, coupleId) * 3);
      }
    }, 300_000);

    /*
     * ГІЛКИ-СКЕЛЕТИ Є. Власник: «додавай, якщо їх немає, а їх немає,
     * додавай». Доти медіана довжини гілки була 2-4% висоти на кожному віці.
     */
    it('має товсті бічні гілки, а не саму лише дрібноту', () => {
      const build = treeBuildAt(20, 'dogma:one');
      const scaffolds = build.frames.curves.filter(
        (curve) => curve.branchId.startsWith('tree:scaffold:'),
      );
      expect(scaffolds.length).toBeGreaterThanOrEqual(5);

      let top = Number.NEGATIVE_INFINITY;
      for (let index = 1; index < build.mesh.positions.length; index += 3) {
        if (build.mesh.positions[index]! > top) top = build.mesh.positions[index]!;
      }
      const longest = Math.max(...scaffolds.map((curve) => {
        let sum = 0;
        for (let index = 1; index < curve.samples.length; index += 1) {
          const from = curve.samples[index - 1]!.position;
          const to = curve.samples[index]!.position;
          sum += Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
        }
        return sum;
      }));
      /*
       * ПОРІГ ІДЕ ВІД ЗАКОНУ, А НЕ ВІД ОКА (ADR-0105).
       *
       * Було «більше за половину висоти» — число з часів, коли виліт
       * скелетної гілки становив 0.62 висоти й робив дерево ШИРШИМ, НІЖ
       * ВИЩИМ. Тепер виліт узято з еталона (0.38), і гілка, яка справді
       * дістає до краю крони, міряється приблизно в 0.42 висоти: вона ще
       * й підводиться, тож довша за власний виліт.
       *
       * Тому поріг тепер прив'язаний до самої частки: найдовша гілка
       * мусить дотягуватись щонайменше до дев'яти десятих обіцяної
       * півширини крони. Це ловить те саме, заради чого тест писався —
       * «сама лише дрібнота», медіана 2-4% висоти, — і при цьому
       * пересувається разом із законом, а не всупереч йому.
       */
      expect(longest / top).toBeGreaterThan(TREE_SCAFFOLD_REACH_SHARE * 0.9);
    }, 300_000);

    it('дорослішає в рази, а не на йоту', () => {
      const young = treeHeightAt(3, 'dogma:one');
      const old = treeHeightAt(40, 'dogma:one');
      expect(old / young).toBeGreaterThan(3);
    }, 300_000);
  });

  describe('кристал', () => {
    const sizeAt = (years: number) => {
      const asOf = asOfAfter(years);
      const states = buildCrystalPipelineStates({
        coupleId: 'dogma:crystal', asOf, relationshipStartedAt: START,
        snapshot: EMPTY_SNAPSHOT, sharedDaysOff: [],
        quality: 'balanced', reducedMotion: false,
      });
      let top = Number.NEGATIVE_INFINITY;
      let bottom = Number.POSITIVE_INFINITY;
      let reach = 0;
      for (const mesh of states.geometry.meshes) {
        for (let index = 0; index + 2 < mesh.positions.length; index += 3) {
          const y = mesh.positions[index + 1]!;
          if (y > top) top = y;
          if (y < bottom) bottom = y;
          reach = Math.max(reach, Math.hypot(mesh.positions[index]!, mesh.positions[index + 2]!));
        }
      }
      return { height: top - bottom, width: reach * 2, bodies: states.growth.bodies.length };
    };

    it('росте вгору до повного терміну, а далі вшир — і ніколи назад', () => {
      let previous = { height: 0, width: 0, bodies: 0 };
      for (const years of AGES) {
        const now = sizeAt(years);
        /*
         * Висота спиняється на тридцяти роках — це записане рішення власника
         * (`MONARCH_FULL_TERM_YEARS`), а не вада: далі історія йде в ширину
         * й нові грані. Догма від цього не страждає, бо об'єкт і після
         * тридцяти щороку стає дорослішим — просто іншою віссю.
         */
        expect({ years, shrank: now.height < previous.height - 1e-6 })
          .toEqual({ years, shrank: false });
        expect({ years, shrank: now.width < previous.width - 1e-6 })
          .toEqual({ years, shrank: false });
        expect({ years, lost: now.bodies < previous.bodies })
          .toEqual({ years, lost: false });
        previous = now;
      }
    }, 120_000);

    it('після повного терміну далі повнішає', () => {
      const term = sizeAt(30);
      const veteran = sizeAt(50);
      expect(veteran.width).toBeGreaterThan(term.width);
      expect(veteran.bodies).toBeGreaterThan(term.bodies);
    }, 120_000);
  });

  describe('риф', () => {
    it('додає колонію за кожен рік, порожній чи ні', () => {
      let previousColonies = 0;
      let previousBodies = 0;
      for (const years of AGES) {
        const plan = buildReefPlan({
          relationshipStartedAt: START,
          asOf: asOfAfter(years).slice(0, 10),
          leapDayPolicy: 'feb-28',
          seed: 4242, events: [], sharedDaysOff: [], theme: 'dark',
        });
        const bodies = plan.colonies.reduce((sum, colony) => sum + colony.bodies.length, 0);
        expect({ years, lost: plan.colonies.length < previousColonies })
          .toEqual({ years, lost: false });
        expect({ years, lost: bodies < previousBodies }).toEqual({ years, lost: false });
        previousColonies = plan.colonies.length;
        previousBodies = bodies;
      }
      expect(previousColonies).toBeGreaterThanOrEqual(40);
    });

    /*
     * Порожній рік — це НЕ нульовий рік. `EMPTY_YEAR_FLOOR` дає йому 0.3
     * повного, і саме це число робить час валютою, а події — добривом.
     */
    it('дає порожньому рокові справжню, а не нульову наповненість', () => {
      const plan = buildReefPlan({
        relationshipStartedAt: START, asOf: asOfAfter(10).slice(0, 10),
        leapDayPolicy: 'feb-28', seed: 4242, events: [], sharedDaysOff: [], theme: 'dark',
      });
      for (const colony of plan.colonies) {
        if (!colony.complete) continue;
        expect(colony.fill).toBeGreaterThan(0.25);
      }
    });
  });
});
