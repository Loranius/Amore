import { describe, expect, it } from 'vitest';
import { ANNUAL_HEAD_SHARE } from './colonyFormations';
import {
  buildReefPlan,
  type BuildReefPlanInput,
  type ReefHistoryEvent,
} from './reefAssembly';

const STARTED = '2022-12-26';

function plan(overrides: Partial<BuildReefPlanInput> = {}): ReturnType<typeof buildReefPlan> {
  return buildReefPlan({
    relationshipStartedAt: STARTED,
    asOf: '2026-08-25',
    leapDayPolicy: 'feb-28',
    seed: 4242,
    events: [],
    sharedDaysOff: [],
    theme: 'dark',
    ...overrides,
  });
}

function events(...pairs: Array<[string, ReefHistoryEvent['module']]>): ReefHistoryEvent[] {
  return pairs.map(([occurredAt, module]) => ({ occurredAt, module }));
}

describe('рік стосунків — одна колонія', () => {
  it('колоній рівно стільки, скільки прожитих років, і в порядку', () => {
    // 26.12.2022 → 25.08.2026: три закриті роки й четвертий у розпалі.
    const reef = plan();
    expect(reef.colonies).toHaveLength(4);
    expect(reef.colonies.map((colony) => colony.id)).toEqual([
      'reef:year:1', 'reef:year:2', 'reef:year:3', 'reef:year:4',
    ]);
    expect(reef.colonies.map((colony) => colony.complete)).toEqual([true, true, true, false]);
  });

  it('пара першого дня вже має колонію', () => {
    const reef = plan({ asOf: STARTED });
    expect(reef.colonies).toHaveLength(1);
    expect(reef.colonies[0]!.complete).toBe(false);
    expect(reef.colonies[0]!.size.bodies).toBeGreaterThanOrEqual(3);
  });
});

describe('минуле не переписується', () => {
  it('закрита колонія не міняється від того, що минув час', () => {
    /*
     * ГОЛОВНЕ правило власника, і воно тут не декларація.
     *
     * Той самий вміст, дві різні «сьогодні»: 2025 і 2026. Голова за цей
     * час виросла, місце колоній на ній поїхало разом із поверхнею — а
     * РОЗМІР перших двох років мусить лишитись той самий до числа.
     */
    const history = events(
      ['2023-03-01', 'memories'], ['2023-07-14', 'plans'],
      ['2024-05-05', 'map'], ['2024-09-09', 'media'],
    );
    const earlier = plan({ asOf: '2025-01-01', events: history });
    const later = plan({ asOf: '2026-08-25', events: history });
    expect(later.head.radius).toBeGreaterThan(earlier.head.radius);
    for (let year = 0; year < 2; year += 1) {
      expect(later.colonies[year]!.size, `рік ${year + 1}`)
        .toEqual(earlier.colonies[year]!.size);
      expect(later.colonies[year]!.bodies).toEqual(earlier.colonies[year]!.bodies);
      expect(later.colonies[year]!.fill).toEqual(earlier.colonies[year]!.fill);
    }
  });

  it('подія цього року не чіпає колоній минулих років', () => {
    const before = plan({ events: events(['2023-03-01', 'memories']) });
    const after = plan({
      events: events(['2023-03-01', 'memories'], ['2026-08-01', 'plans']),
    });
    for (let year = 0; year < 3; year += 1) {
      expect(after.colonies[year]!.size, `рік ${year + 1}`).toEqual(before.colonies[year]!.size);
    }
    expect(after.colonies[3]!.fill).toBeGreaterThan(before.colonies[3]!.fill);
  });

  it('дописане в старий рік у нього й лягає — це дозволено', () => {
    /*
     * Названа межа, і тест її ПРИШПИЛЮЄ, щоб її колись не «полагодили».
     *
     * «Заморожений» стосується ЧАСУ, а не вмісту: пара, яка прийшла на
     * портал на третій рік, мусить мати змогу заповнити перші два.
     * Спогад, датований 2023-м, робить колонію 2023-го повнішою — і це
     * правильно, бо той рік справді був такий.
     */
    const empty = plan();
    const filled = plan({
      events: events(
        ['2023-02-02', 'memories'], ['2023-04-04', 'plans'],
        ['2023-06-06', 'map'], ['2023-08-08', 'media'],
      ),
    });
    expect(filled.colonies[0]!.fill).toBeGreaterThan(empty.colonies[0]!.fill);
    expect(filled.colonies[0]!.size.radius).toBeGreaterThan(empty.colonies[0]!.size.radius);
    expect(filled.colonies[2]!.size).toEqual(empty.colonies[2]!.size);
  });
});

describe('колонія не наздоганяє голову', () => {
  it('жодна колонія не переступає своєї частки', () => {
    const busy = events(
      ...Array.from({ length: 40 }, (_, index) => [
        `202${3 + (index % 4)}-0${1 + (index % 9)}-15`,
        (['calendar', 'plans', 'wishlist', 'map', 'memories', 'media'] as const)[index % 6]!,
      ] as [string, ReefHistoryEvent['module']]),
    );
    for (const asOf of ['2023-06-01', '2025-01-01', '2026-08-25']) {
      const reef = plan({ asOf, events: busy });
      for (const colony of reef.colonies) {
        expect(colony.size.radius, `${asOf}, ${colony.id}`)
          .toBeLessThanOrEqual(reef.head.radius * ANNUAL_HEAD_SHARE + 1e-6);
      }
    }
  });

  it('прив’язка кожної колонії лежить на куполі', () => {
    const reef = plan();
    for (const colony of reef.colonies) {
      const { x, y, z } = colony.anchor.point;
      const value = (x * x + z * z) / (reef.head.radius * reef.head.radius)
        + (y * y) / (reef.head.rise * reef.head.rise);
      expect(value, colony.id).toBeCloseTo(1, 4);
    }
  });
});

describe('широта життя й наповненість', () => {
  it('ширше життя — ширша голова', () => {
    // Однакова кількість подій, різна кількість РІЗНИХ модулів.
    const narrow = plan({
      events: events(
        ['2023-03-01', 'memories'], ['2023-04-01', 'memories'],
        ['2023-05-01', 'memories'], ['2023-06-01', 'memories'],
      ),
    });
    const wide = plan({
      events: events(
        ['2023-03-01', 'memories'], ['2023-04-01', 'plans'],
        ['2023-05-01', 'map'], ['2023-06-01', 'media'],
      ),
    });
    expect(wide.head.radius).toBeGreaterThan(narrow.head.radius);
  });

  it('спільні вихідні піднімають рік, який модулі описали бідно', () => {
    const alone = plan();
    const together = plan({
      sharedDaysOff: Array.from({ length: 30 }, (_, index) => `2023-0${1 + (index % 9)}-1${index % 10}`),
    });
    expect(together.colonies[0]!.fill).toBeGreaterThan(alone.colonies[0]!.fill);
  });
});

describe('риф належить своїй парі', () => {
  it('ті самі дані — той самий риф', () => {
    expect(plan()).toEqual(plan());
  });

  it('інший посів — інші колонії', () => {
    expect(plan({ seed: 1 }).colonies[0]!.bodies)
      .not.toEqual(plan({ seed: 2 }).colonies[0]!.bodies);
  });

  it('два роки з однаковою наповненістю не близнюки', () => {
    /*
     * Кожна колонія має ВЛАСНИЙ посів, і це видно рівно в одному:
     * `reefAnnualColonySize` лишає році тремтіння в одне тіло, щоб два
     * однаково прожиті роки не виходили копіями. Порожня історія на
     * дванадцять років дає дванадцять однакових наповненостей — тож
     * якби посів був спільний, усі вони мали б однакову кількість тіл.
     */
    const long = plan({ relationshipStartedAt: '2014-03-10', asOf: '2026-08-25' });
    const closed = long.colonies.filter((colony) => colony.complete);
    expect(closed.length).toBeGreaterThan(10);
    expect(new Set(closed.map((colony) => colony.fill)).size, 'роки мали б бути однаково порожні')
      .toBe(1);
    expect(new Set(closed.map((colony) => colony.size.bodies)).size, 'усі роки — копії')
      .toBeGreaterThan(1);
  });

  it('інша дата початку — інший колір', () => {
    expect(plan().tint.rgb).not.toEqual(plan({ relationshipStartedAt: '2019-04-07' }).tint.rgb);
  });

  it('тема міняє світлість, а не пару', () => {
    expect(plan({ theme: 'light' }).tint.rgb).not.toEqual(plan({ theme: 'dark' }).tint.rgb);
    expect(plan({ theme: 'light' }).colonies).toEqual(plan({ theme: 'dark' }).colonies);
  });
});
