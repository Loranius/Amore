import { describe, expect, it } from 'vitest';
import { groupPlans } from './planGroups';
import type { PlanCategory, PlanRow, PlanStatus } from '@/types';

// ============================================================
// Три купки планів під календарем.
// ------------------------------------------------------------
// Об'єднаний модуль показує плани одразу під місяцем, і групування тут —
// рішення, а не оформлення: воно відповідає на «що з планом робити», і
// помилка в ньому не падає, а тихо ховає план не в тій купці.
// ============================================================

function plan(patch: Partial<PlanRow> & { id: number }): PlanRow {
  return {
    title: `План ${patch.id}`,
    description: null,
    category: 'other' as PlanCategory,
    status: 'planning' as PlanStatus,
    cover_url: null,
    url: null,
    start_date: null,
    end_date: null,
    start_time: null,
    date_precision: 'day',
    location_name: null,
    place_id: null,
    budget: null,
    proposed_by: null,
    confirmed: true,
    created_by: 1,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...patch,
  } as PlanRow;
}

const TODAY = new Date('2026-08-11T12:00:00Z');

describe('plans split into three piles under the month', () => {
  it('keeps a dated plan ahead, a dateless one among ideas', () => {
    const { upcoming, ideas } = groupPlans([
      plan({ id: 1, start_date: '2026-08-20' }),
      plan({ id: 2, start_date: null }),
    ], TODAY);
    expect(upcoming.map((item) => item.id)).toEqual([1]);
    expect(ideas.map((item) => item.id)).toEqual([2]);
  });

  it('treats a closed plan as closed even when its date is ahead', () => {
    // Виконаний наперед план лишається виконаним. Без цієї умови він стояв би
    // першим серед «найближчих» — тобто модуль пропонував би зробити те, що
    // вже зроблено.
    const { upcoming, closed } = groupPlans([
      plan({ id: 3, start_date: '2026-09-01', status: 'done' as PlanStatus }),
      plan({ id: 4, start_date: '2026-09-02' }),
    ], TODAY);
    expect(upcoming.map((item) => item.id)).toEqual([4]);
    expect(closed.map((item) => item.id)).toEqual([3]);
  });

  it('counts postponed and cancelled as closed too, not as ideas', () => {
    // Відкладений план дати не має — і без перевірки на закритість осів би
    // серед ідей, тобто серед того, що ще попереду.
    const { ideas, closed } = groupPlans([
      plan({ id: 5, start_date: null, status: 'postponed' as PlanStatus }),
      plan({ id: 6, start_date: null, status: 'cancelled' as PlanStatus }),
      plan({ id: 7, start_date: null }),
    ], TODAY);
    expect(ideas.map((item) => item.id)).toEqual([7]);
    expect(closed.map((item) => item.id).sort()).toEqual([5, 6]);
  });

  it('loses nothing and duplicates nothing', () => {
    const all = [
      plan({ id: 1, start_date: '2026-08-20' }),
      plan({ id: 2, start_date: null }),
      plan({ id: 3, start_date: '2026-01-01', status: 'done' as PlanStatus }),
      plan({ id: 4, start_date: '2026-12-31' }),
      plan({ id: 5, start_date: null, status: 'cancelled' as PlanStatus }),
    ];
    const { upcoming, ideas, closed } = groupPlans(all, TODAY);
    const seen = [...upcoming, ...ideas, ...closed].map((item) => item.id).sort();
    expect(seen).toEqual([1, 2, 3, 4, 5]);
  });

  it('puts the nearest plan first among the upcoming', () => {
    const { upcoming } = groupPlans([
      plan({ id: 1, start_date: '2026-12-01' }),
      plan({ id: 2, start_date: '2026-08-14' }),
      plan({ id: 3, start_date: '2026-09-30' }),
    ], TODAY);
    expect(upcoming.map((item) => item.id)).toEqual([2, 3, 1]);
  });

  it('survives an empty list', () => {
    expect(groupPlans([], TODAY)).toEqual({ upcoming: [], ideas: [], closed: [] });
  });
});
