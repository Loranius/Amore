// ============================================================
// Тести розкладки планів по календарю.
//
// Кожен тест називає інваріант, який перевіряє (.claude/rules/tests.md).
// Дата не заморожується: жодна з цих функцій не питає «сьогодні» —
// вони відповідають лише на «чи випадає план на цей день».
// ============================================================
import { describe, expect, it } from 'vitest';
import { planOccupiesDate, planShowsInGrid, plansByDay, plansOnDate } from './calendarPlans';
import type { PlanRow } from '@/types';

const plan = (over: Partial<PlanRow> = {}): PlanRow => ({
  id: 1, title: 'План', description: null, category: 'other', status: 'planning',
  cover_url: null, url: null, start_date: '2026-08-12', end_date: null, start_time: null,
  date_precision: 'day', location_name: null, place_id: null, budget: null, proposed_by: null,
  confirmed: true, created_by: 1, created_at: '2026-07-01T10:00:00Z',
  updated_at: '2026-07-01T10:00:00Z', completed_at: null,
  ...over,
});

describe('planShowsInGrid', () => {
  it('неточна дата в сітку не потрапляє — її нема де поставити чесно', () => {
    for (const p of ['month', 'season', 'year', 'none'] as const) {
      expect(planShowsInGrid(plan({ date_precision: p }))).toBe(false);
    }
  });

  it('виконаний план лишається: він таки відбувся того дня', () => {
    // Минула подія в сітці стоїть, і виконаний план нічим від неї не
    // відрізняється — прибрати його означало б стерти минулий місяць.
    expect(planShowsInGrid(plan({ status: 'done' }))).toBe(true);
  });

  it('скасований і відкладений зникають: їхня дата вже нічого не означає', () => {
    expect(planShowsInGrid(plan({ status: 'cancelled' }))).toBe(false);
    expect(planShowsInGrid(plan({ status: 'postponed' }))).toBe(false);
  });
});

describe('plansByDay', () => {
  it('план на конкретний день стоїть рівно в одному дні', () => {
    const byDay = plansByDay([plan()], 2026, 8);
    expect([...byDay.keys()]).toEqual([12]);
    expect(byDay.get(12)?.[0]?.id).toBe(1);
  });

  it('чужий місяць не бачить нічого', () => {
    expect(plansByDay([plan()], 2026, 9).size).toBe(0);
    expect(plansByDay([plan()], 2025, 8).size).toBe(0);
  });

  it('період займає кожен свій день, а не лише перший', () => {
    // Інакше 13 серпня виглядало б вільним посеред походу.
    const trip = plan({ date_precision: 'range', start_date: '2026-08-12', end_date: '2026-08-14' });
    expect([...plansByDay([trip], 2026, 8).keys()]).toEqual([12, 13, 14]);
  });

  it('період через межу місяця відрізається по краях місяця', () => {
    const trip = plan({ date_precision: 'range', start_date: '2026-08-30', end_date: '2026-09-02' });
    expect([...plansByDay([trip], 2026, 8).keys()]).toEqual([30, 31]);
    expect([...plansByDay([trip], 2026, 9).keys()]).toEqual([1, 2]);
  });

  it('період без кінця читається як один день', () => {
    const half = plan({ date_precision: 'range', end_date: null });
    expect([...plansByDay([half], 2026, 8).keys()]).toEqual([12]);
  });

  it('зіпсований діапазон не ковтає план', () => {
    // Кінець раніше початку — це помилка вводу, а не привід тихо
    // прибрати план із календаря.
    const broken = plan({ date_precision: 'range', start_date: '2026-08-12', end_date: '2026-08-01' });
    expect([...plansByDay([broken], 2026, 8).keys()]).toEqual([12]);
  });

  it('порядок усередині дня сталий — за id, а не за порядком у масиві', () => {
    const a = plan({ id: 7 });
    const b = plan({ id: 3 });
    expect(plansByDay([a, b], 2026, 8).get(12)?.map((p) => p.id)).toEqual([3, 7]);
  });
});

/*
 * ЗВЕДЕННЯ ДВОХ КАЛЕНДАРІВ (ADR-0202, аудит §4.2).
 *
 * `/plans` ставив позначку на КОЖНОМУ дні діапазону, `/schedule` — лише
 * на `start_date`. З одного рядка виходили дві протилежні картини: у
 * «Планах» риска під усіма тридцятьма днями вересня, у «Графіку» — під
 * жодним, і при цьому підпис «крапка в кутку дня — на нього вже є план».
 *
 * Правило тепер одне: позначка стоїть там, де план займає ДЕНЬ, а не
 * ввесь місяць. Межа — сам місяць, одиниця, яку сітка показує; числа зі
 * стелі («довший за N днів») тут немає навмисно.
 */
describe('позначка стоїть там, де план займає день, а не ввесь місяць', () => {
  // Той самий план, що й на знімку аудиту.
  const REPAIR = plan({
    id: 42, title: 'Ремонт хати', date_precision: 'range',
    start_date: '2026-07-01', end_date: '2028-01-01',
  });

  it('ремонт на 549 днів не займає в вересні жодного дня', () => {
    // Він таки триває — але не займає ЖОДНОГО дня окремо: відповідь
    // «усі тридцять» тотожна відповіді «жоден».
    expect([...plansByDay([REPAIR], 2026, 9).keys()]).toEqual([]);
    expect(plansOnDate([REPAIR], '2026-09-15')).toEqual([]);
  });

  it('…але свої краї показує, і саме в тих місяцях, де вони стоять', () => {
    expect([...plansByDay([REPAIR], 2026, 7).keys()], 'початок у липні').toEqual([1]);
    expect([...plansByDay([REPAIR], 2028, 1).keys()], 'кінець у січні').toEqual([1]);
  });

  it('обидва екрани дістають ту саму відповідь', () => {
    /*
     * Інваріант, заради якого все й робилось: сітка «Планів» питає по
     * днях місяця, «Графік» — по ISO-даті, і це та сама функція.
     */
    for (const day of [1, 15, 30]) {
      const iso = `2026-09-${String(day).padStart(2, '0')}`;
      expect(plansByDay([REPAIR], 2026, 9).has(day))
        .toBe(plansOnDate([REPAIR], iso).length > 0);
    }
  });

  it('період, що накрив місяць рівно, лишає обидва краї', () => {
    const month = plan({ date_precision: 'range', start_date: '2026-09-01', end_date: '2026-09-30' });
    expect([...plansByDay([month], 2026, 9).keys()]).toEqual([1, 30]);
  });

  it('період, що почався в цьому місяці й пішов далі, лишає початок', () => {
    const long = plan({ date_precision: 'range', start_date: '2026-09-01', end_date: '2026-12-31' });
    expect([...plansByDay([long], 2026, 9).keys()]).toEqual([1]);
    expect([...plansByDay([long], 2026, 10).keys()], 'жовтень накрито цілком').toEqual([]);
  });

  it('короткий похід нічого не втратив — правило його не чіпає', () => {
    // Три дні не накривають серпня, тож усе, як було.
    const trip = plan({ date_precision: 'range', start_date: '2026-08-12', end_date: '2026-08-14' });
    expect([...plansByDay([trip], 2026, 8).keys()]).toEqual([12, 13, 14]);
    expect(planOccupiesDate(trip, '2026-08-13')).toBe(true);
  });

  it('похід через межу місяця теж — жодного місяця він не накриває', () => {
    const trip = plan({ date_precision: 'range', start_date: '2026-08-30', end_date: '2026-09-02' });
    expect([...plansByDay([trip], 2026, 8).keys()]).toEqual([30, 31]);
    expect([...plansByDay([trip], 2026, 9).keys()]).toEqual([1, 2]);
  });

  it('лютий короткий, і це не робить його особливим', () => {
    // Межа — місяць, а не «тридцять днів»: у лютому 2027-го їх 28.
    const feb = plan({ date_precision: 'range', start_date: '2027-02-01', end_date: '2027-02-28' });
    expect([...plansByDay([feb], 2027, 2).keys()]).toEqual([1, 28]);
  });

  it('день поза планом не займає нічого', () => {
    expect(planOccupiesDate(REPAIR, '2026-06-30'), 'до початку').toBe(false);
    expect(planOccupiesDate(REPAIR, '2028-01-02'), 'після кінця').toBe(false);
  });

  it('порядок у дні сталий і в новій формі теж', () => {
    const a = plan({ id: 7 });
    const b = plan({ id: 3 });
    expect(plansOnDate([a, b], '2026-08-12').map((p) => p.id)).toEqual([3, 7]);
  });
});

// Перевірка `plansByMonth` пішла разом із функцією — вона рахувала плани для
// річного огляду календаря, якого більше немає.
