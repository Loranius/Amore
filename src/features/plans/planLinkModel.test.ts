// ============================================================
// Тести зв'язків плану.
//
// Кожен тест називає інваріант, який перевіряє (.claude/rules/tests.md).
// ============================================================
import { describe, expect, it } from 'vitest';
import { isLinked, linksOfPlan, resolveLinks, type LinkCatalog } from './planLinkModel';
import type { PlanLinkRow, PlanRow } from '@/types';

const plan = (over: Partial<PlanRow> = {}): PlanRow => ({
  id: 1, title: 'Вікенд у Карпатах', description: null, category: 'trip', status: 'planning',
  cover_url: null, url: null, start_date: null, end_date: null, start_time: null,
  date_precision: 'none', location_name: null, place_id: null, budget: null,
  proposed_by: null, confirmed: true, created_by: 1, created_at: '2026-07-01T10:00:00Z',
  updated_at: '2026-07-01T10:00:00Z', completed_at: null,
  ...over,
});

const link = (over: Partial<PlanLinkRow> = {}): PlanLinkRow => ({
  plan_id: 1, target_type: 'wish', target_id: 10, created_at: '2026-07-02T10:00:00Z', ...over,
});

const catalog: LinkCatalog = {
  wish: new Map([[10, { title: 'Нові лижі' }], [11, { title: 'Термос' }]]),
  place: new Map([[20, { title: 'Буковель', subtitle: 'Івано-Франківська' }]]),
  memory: new Map([[30, { title: '14 серпня 2025' }]]),
};

describe('linksOfPlan', () => {
  it('бере лише свої зв\'язки — чужий план у список не потрапляє', () => {
    const mine = link();
    const theirs = link({ plan_id: 2, target_id: 11 });
    expect(linksOfPlan(plan(), [mine, theirs])).toEqual([mine]);
  });
});

describe('resolveLinks', () => {
  it('ціль без назви пропускається: рядок пережив своє бажання', () => {
    // target_id навмисно без зовнішнього ключа, тож видалення бажання
    // лишає осиротілий рядок. Показувати «щось» замість назви гірше,
    // ніж не показувати нічого.
    const orphan = link({ target_id: 999 });
    expect(resolveLinks([link(), orphan], catalog)).toEqual([
      { type: 'wish', id: 10, title: 'Нові лижі' },
    ]);
  });

  it('невидима читачеві ціль так само не показується', () => {
    // Вішлист віддає лише дозволене; порожній довідник — це і є
    // «читач цього не бачить», і малювати заглушку означало б
    // повідомити про існування прихованого.
    expect(resolveLinks([link()], { wish: new Map() })).toEqual([]);
  });

  it('порядок сталий: бажання, місця, спогади — і за id всередині типу', () => {
    // Без цього дві прив'язки, зроблені в одну секунду, мінялись би
    // місцями між перемальовуваннями.
    const rows = [
      link({ target_type: 'memory', target_id: 30 }),
      link({ target_type: 'wish', target_id: 11 }),
      link({ target_type: 'place', target_id: 20 }),
      link({ target_type: 'wish', target_id: 10 }),
    ];
    expect(resolveLinks(rows, catalog).map((r) => `${r.type}:${r.id}`))
      .toEqual(['wish:10', 'wish:11', 'place:20', 'memory:30']);
  });

  it('підзаголовок переноситься, коли він є', () => {
    expect(resolveLinks([link({ target_type: 'place', target_id: 20 })], catalog))
      .toEqual([{ type: 'place', id: 20, title: 'Буковель', subtitle: 'Івано-Франківська' }]);
  });

  it('порожній довідник не падає, а віддає порожньо', () => {
    expect(resolveLinks([link()], {})).toEqual([]);
  });
});

describe('isLinked', () => {
  it('збіг мусить бути за трьома полями одразу, а не за одним id', () => {
    const rows = [link({ target_type: 'wish', target_id: 10 })];
    expect(isLinked(plan(), 'wish', 10, rows)).toBe(true);
    // Той самий id, але інший тип — це інша річ.
    expect(isLinked(plan(), 'place', 10, rows)).toBe(false);
    // Той самий зв'язок, але в іншого плану.
    expect(isLinked(plan({ id: 2 }), 'wish', 10, rows)).toBe(false);
  });
});
