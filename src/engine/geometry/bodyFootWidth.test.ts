import { describe, expect, it } from 'vitest';
import { childFootWidth, monarchFootWidth } from '../species/crystal/growthModel';
import type { GrowthBody } from '../growth/types';
import { intersectHalfSpaces, polytopeTolerance } from './polytope';
import { buildCrystalProfile } from './profile';

/*
 * Том II оголошує півширину підошви й розставляє по ній колонію
 * (`MONARCH_FOOT_WIDTH` / `CHILD_FOOT_WIDTH`). Том V ліпить тіло. Цей
 * тест — місток між ними: він будує тіла й міряє, чи оголошене число
 * досі правда.
 *
 * Навіщо взагалі два числа замість одного. `renderedRadius` — це радіус
 * до ГРАНІ незміненого перерізу; готове тіло ширше, бо геометрія
 * множить його обхватом габітусу (`habit.ts`, до 1.30), анізотропією
 * перерізу (`profileScales`, до 1.18) і кутом многогранника (≈1.05).
 * Поки посадка рахувалась від оголошеного радіуса, перший річний
 * кристал сидів усередині монарха перші п'ять років життя КОЖНОЇ пари —
 * ваду знайшла розгортка `crystalGrowthSweep`, ADR-0125.
 *
 * Тест мусить упасти, якщо тіло стане ширшим за оголошене (тоді
 * повернеться перетин) або якщо воно схудне настільки, що оголошене
 * число розсуває колонію задарма.
 */

/** Та сама частка тіла, про яку говорить оголошення: підошва, не вістря. */
const FOOT_SHARE = 0.35;
/** Скільки насінин на габітус. Стільки ж, скільки міряло оголошення. */
const SEEDS = 24;
/**
 * Наскільки оголошене число має право бути щедрішим за виміряне.
 *
 * Не нуль: числа в таблиці округлені ВГОРУ до сотої, інакше межа
 * проходила б рівно по поверхні. І не «скільки завгодно»: запас у
 * півтора рази — це вже не межа тіла, а мовчазний відступ, який
 * розсуває колонію без причини.
 */
const ALLOWED_SLACK = 1.06;

function body(archetype: string, mother: boolean, seed: number): GrowthBody {
  return {
    id: mother ? 'crystal:mother' : 'crystal:year:1',
    kind: mother ? 'crystal:mother' : 'crystal:year',
    generation: 0,
    hostBodyId: null,
    anchor: { x: 0, y: 0, z: 0 },
    direction: { x: 0, y: 1, z: 0 },
    renderedLength: 1,
    renderedRadius: 0.1,
    seed,
    attributes: { formationKind: mother ? 'mother' : 'annual', archetype },
  } as unknown as GrowthBody;
}

/** Найдальша від осі точка нижніх 35% побудованого тіла, у радіусах. */
function measuredFootWidth(archetype: string, mother: boolean): number {
  let worst = 0;
  let built = 0;
  for (let index = 1; index <= SEEDS; index += 1) {
    const profile = buildCrystalProfile(body(archetype, mother, index * 7919), 'high');
    const polytope = intersectHalfSpaces(profile.planes!, polytopeTolerance(0.1));
    if (!polytope) continue;
    built += 1;
    const top = polytope.vertices.reduce((most, vertex) => Math.max(most, vertex.y), -Infinity);
    const low = polytope.vertices.reduce((least, vertex) => Math.min(least, vertex.y), Infinity);
    for (const vertex of polytope.vertices) {
      if (vertex.y > low + (top - low) * FOOT_SHARE) continue;
      worst = Math.max(worst, Math.hypot(vertex.x, vertex.z) / 0.1);
    }
  }
  // Порожня вибірка — не нуль: габітус, який не збудувався жодного разу,
  // мовчки проходив би будь-яку межу.
  expect(built, `${archetype} збудувалось хоч раз`).toBeGreaterThan(SEEDS / 2);
  return worst;
}

const MONARCH_HABITS = ['prismatic', 'massive', 'needle', 'tabular'] as const;
const CHILD_ARCHETYPES = [
  'prismatic', 'massive', 'needle', 'tabular', 'blade', 'fan', 'etched',
] as const;

describe('оголошена півширина підошви — це справжня півширина тіла (ADR-0125)', () => {
  it('монарх: жоден габітус не ширший за оголошене', () => {
    for (const habit of MONARCH_HABITS) {
      const measured = measuredFootWidth(habit, true);
      const declared = monarchFootWidth(habit);
      expect(declared, `монарх ${habit} вужчий за оголошене`).toBeGreaterThanOrEqual(measured);
      expect(declared, `монарх ${habit} оголошений із запасом`)
        .toBeLessThanOrEqual(measured * ALLOWED_SLACK);
    }
  });

  it('дитина: жоден архетип не ширший за оголошене', () => {
    for (const archetype of CHILD_ARCHETYPES) {
      const measured = measuredFootWidth(archetype, false);
      const declared = childFootWidth(archetype);
      expect(declared, `дитина ${archetype} вужча за оголошене`).toBeGreaterThanOrEqual(measured);
      expect(declared, `дитина ${archetype} оголошена із запасом`)
        .toBeLessThanOrEqual(measured * ALLOWED_SLACK);
    }
  });

  it('невідомий габітус дістає найширше з відомих, а не найвужче', () => {
    /*
     * Запобіжник має бути СТЕЛЕЮ. Якби невідома назва діставала
     * середнє чи перше-ліпше, новий габітус сідав би в колонію тісніше,
     * ніж дозволяє його тіло, — тобто саме та вада, яку закрив
     * ADR-0125, повернулась би тихо, разом із новою формою.
     */
    const monarchWidest = Math.max(...MONARCH_HABITS.map((habit) => monarchFootWidth(habit)));
    expect(monarchFootWidth('no-such-habit')).toBeGreaterThanOrEqual(monarchWidest);
    const childWidest = Math.max(...CHILD_ARCHETYPES.map((one) => childFootWidth(one)));
    expect(childFootWidth('no-such-archetype')).toBeGreaterThanOrEqual(childWidest);
  });
});
