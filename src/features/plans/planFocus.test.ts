// ============================================================
// Тести фокуса модуля «Плани» (ADR-0207, варіант C).
//
// Кожен тест називає інваріант, який перевіряє (.claude/rules/tests.md).
// Дата заморожена: і фокус, і поступ залежать від «сьогодні», і без
// фіксованої точки ці тести ламались би раз на добу.
//
// «Сьогодні» взяте не зі стелі: 23 вересня 2026 — день, на який знімався
// демонстраційний макет і на який рахувались усі числа в ADR (84 з 549).
// ============================================================
import { describe, expect, it } from 'vitest';
import { focusPlan, ideaQueue, planProgress, scheduledPlans } from './planFocus';
import type { PlanRow } from '@/types';

const TODAY = new Date(2026, 8, 23); // 23 вересня 2026, локальна північ

const plan = (over: Partial<PlanRow> = {}): PlanRow => ({
  id: 1, title: 'План', description: null, category: 'other', status: 'planning',
  cover_url: null, url: null, start_date: null, end_date: null, start_time: null,
  date_precision: 'none', location_name: null, place_id: null, budget: null, proposed_by: null,
  confirmed: true, created_by: 1, created_at: '2026-07-01T10:00:00Z',
  updated_at: '2026-07-01T10:00:00Z', completed_at: null,
  ...over,
});

/** Справжній план пари: саме на ньому рахувались числа в ADR-0207. */
const renovation = plan({
  id: 24, title: 'Ремонт хати', category: 'home', status: 'preparing',
  start_date: '2026-07-01', end_date: '2028-01-01', date_precision: 'range',
});

describe('planProgress', () => {
  it('рахує поступ періоду, що триває', () => {
    // 1 липня 2026 → 1 січня 2028 = 549 днів; 1 липня → 23 вересня = 84.
    expect(planProgress(renovation, TODAY)).toEqual({
      elapsed: 84, total: 549, ratio: 84 / 549,
    });
  });

  it('мовчить про точний день: у нього немає поступу', () => {
    // Смуга на 0% чи 100% сказала б менше, ніж «через 4 дні».
    const day = plan({ start_date: '2026-09-20', date_precision: 'day' });
    expect(planProgress(day, TODAY)).toBeNull();
  });

  it('мовчить про період, який ще не почався', () => {
    // Інакше смуга стояла б на нулі місяцями й читалась як зламана.
    const ahead = plan({
      start_date: '2026-10-01', end_date: '2026-10-10', date_precision: 'range',
    });
    expect(planProgress(ahead, TODAY)).toBeNull();
  });

  it('мовчить про неточну дату', () => {
    const season = plan({ start_date: '2026-09-01', date_precision: 'season' });
    expect(planProgress(season, TODAY)).toBeNull();
  });

  it('не ділить на нуль на періоді завдовжки в день', () => {
    // `lastDayOf` читає зіпсований діапазон як один день, тож `total`
    // може бути нулем — і `elapsed / total` дав би Infinity.
    const sameDay = plan({
      start_date: '2026-09-23', end_date: '2026-09-23', date_precision: 'range',
    });
    const progress = planProgress(sameDay, TODAY);
    expect(progress).not.toBeNull();
    expect(Number.isFinite(progress!.ratio)).toBe(true);
    expect(progress!.ratio).toBe(1);
  });

  it('затискає частку в межах 0..1', () => {
    const over = plan({
      start_date: '2026-09-01', end_date: '2026-09-10', date_precision: 'range',
    });
    const progress = planProgress(over, TODAY);
    // План уже минув — сюди він не потрапить як фокус, але й тут
    // частка не має вискакувати за одиницю.
    if (progress !== null) {
      expect(progress.ratio).toBeLessThanOrEqual(1);
      expect(progress.ratio).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('focusPlan', () => {
  it('на даних пари показує «Ремонт хати»', () => {
    // Єдиний відкритий план із датою — і він ТРИВАЄ, тобто `nextPlan`
    // із planModel його не бачить (вона питає «що попереду»).
    const ideas = [
      plan({ id: 25, title: 'Брекети Лєні', status: 'idea' }),
      plan({ id: 9, title: 'Secret Garden', status: 'idea' }),
    ];
    expect(focusPlan([...ideas, renovation], TODAY)?.id).toBe(24);
  });

  it('те, що триває, має перевагу над тим, що попереду', () => {
    // ADR-0201 уже встановив це для сортування: те, що відбувається
    // зараз, і є найближчим.
    const ahead = plan({ id: 2, start_date: '2026-09-24', date_precision: 'day' });
    expect(focusPlan([ahead, renovation], TODAY)?.id).toBe(24);
  });

  it('серед кількох, що тривають, бере те, що скінчиться раніше', () => {
    const sooner = plan({
      id: 3, start_date: '2026-09-01', end_date: '2026-09-30', date_precision: 'range',
    });
    expect(focusPlan([renovation, sooner], TODAY)?.id).toBe(3);
  });

  it('серед майбутніх бере найближчий за стартом', () => {
    const far = plan({ id: 4, start_date: '2026-12-01', date_precision: 'day' });
    const near = plan({ id: 5, start_date: '2026-09-25', date_precision: 'day' });
    expect(focusPlan([far, near], TODAY)?.id).toBe(5);
  });

  it('не бере закритих і неточних', () => {
    const done = plan({ id: 6, status: 'done', start_date: '2026-09-24', date_precision: 'day' });
    const season = plan({ id: 7, start_date: '2026-09-01', date_precision: 'season' });
    expect(focusPlan([done, season], TODAY)).toBeNull();
  });

  it('порожній фокус — законний стан, а не помилка', () => {
    expect(focusPlan([], TODAY)).toBeNull();
    expect(focusPlan([plan({ status: 'idea' })], TODAY)).toBeNull();
  });
});

describe('ideaQueue', () => {
  it('найдавніший задум стоїть першим', () => {
    // Порядок — продуктова думка: показуємо те, що лежить найдовше.
    const queue = ideaQueue([
      plan({ id: 25, title: 'Брекети Лєні', status: 'idea', created_at: '2026-09-05T14:10:24Z' }),
      plan({ id: 7, title: 'Гончарство', status: 'idea', created_at: '2026-07-29T05:51:52Z' }),
      plan({ id: 10, title: 'Медична', status: 'idea', created_at: '2026-08-02T14:58:58Z' }),
    ]);
    expect(queue.map((item) => item.title)).toEqual(['Гончарство', 'Медична', 'Брекети Лєні']);
  });

  it('id розводить записи, створені в ту саму мить', () => {
    // У цієї пари чотири «Побачення, яке пам'ятаємо» створені за дві
    // секунди — без цього tie-break порядок був би невизначений.
    const same = '2026-09-06T19:49:55Z';
    const queue = ideaQueue([
      plan({ id: 29, status: 'idea', created_at: same }),
      plan({ id: 26, status: 'idea', created_at: same }),
      plan({ id: 28, status: 'idea', created_at: same }),
    ]);
    expect(queue.map((item) => item.id)).toEqual([26, 28, 29]);
  });

  it('бере лише відкриті й лише без дати', () => {
    const queue = ideaQueue([
      plan({ id: 1, status: 'idea' }),
      plan({ id: 2, status: 'done' }),
      plan({ id: 3, status: 'idea', start_date: '2026-10-01', date_precision: 'day' }),
    ]);
    expect(queue.map((item) => item.id)).toEqual([1]);
  });
});

describe('scheduledPlans', () => {
  it('віддає плани з датою, крім того, що вже у фокусі', () => {
    // Інакше план із датою міг би зникнути з екрана зовсім — це і є
    // названа «ціна» варіанта C, і саме її цей список закриває.
    const other = plan({ id: 2, start_date: '2026-10-01', date_precision: 'day' });
    const rows = scheduledPlans([renovation, other], TODAY, renovation);
    expect(rows.map((item) => item.id)).toEqual([2]);
  });

  it('найближчий за стартом стоїть першим', () => {
    const far = plan({ id: 4, start_date: '2026-12-01', date_precision: 'day' });
    const near = plan({ id: 5, start_date: '2026-09-25', date_precision: 'day' });
    expect(scheduledPlans([far, near], TODAY).map((item) => item.id)).toEqual([5, 4]);
  });

  it('закритих не бере', () => {
    const done = plan({ id: 6, status: 'done', start_date: '2026-09-24', date_precision: 'day' });
    expect(scheduledPlans([done], TODAY)).toEqual([]);
  });
});
