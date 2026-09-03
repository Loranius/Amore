// ============================================================
// Що екран показує в році — і чого він НЕ має права прибирати.
// ------------------------------------------------------------
// ЗАПИТ ВЛАСНИКА: «не можна видаляти "що було того року" які випадково
// додав». Кнопка видалення — найнебезпечніша річ на цьому екрані, бо
// кожен рядок тут справжній: план у «Планах», мітка на карті, фільм у
// вотчлісті. Тому головний інваріант цього файлу не «видалення працює», а
// зворотний: **рядок пари не отримує кнопки видалення НІКОЛИ**.
//
// Підпис проходу — чотири умови для плану (`sweepEntries.ts`), і кожна з
// них перевірена окремим падінням: досить зламати одну, щоб рядок
// перестав вважатись своїм.
// ============================================================
import { describe, expect, it } from 'vitest';
import { middleOfYear } from './sweepModel';
import { SWEEP_STAMP, sweepEntriesFor, type SweepEntryRows } from './sweepEntries';
import type { RelationshipYearFill } from './yearFills';

const YEAR: RelationshipYearFill = {
  index: 1,
  label: 2022,
  startsAt: '2022-12-26',
  endsAt: '2023-12-26',
  complete: true,
  fill: 0.42,
};

const NEXT_YEAR: RelationshipYearFill = {
  ...YEAR, index: 2, label: 2023, startsAt: '2023-12-26', endsAt: '2024-12-26',
};

const MIDDLE = middleOfYear(YEAR.startsAt, YEAR.endsAt);

/** План рівно такий, яким його пише прохід (`useHistorySweep.addMilestone`). */
const sweepPlan = (id: number, title: string) => ({
  id,
  title,
  status: 'done',
  startDate: MIDDLE,
  completedAt: `${MIDDLE}${SWEEP_STAMP}`,
  datePrecision: 'year',
});

const rows = (partial: Partial<SweepEntryRows>): SweepEntryRows => ({
  plans: [], places: [], watched: [], ...partial,
});

describe('чим наповнений рік', () => {
  it('показує все, що в році лежить, а не лише свої рядки', () => {
    /*
     * Інакше число й перелік розходились би: лічильник рахує рік цілком,
     * і список, який показує половину, плутав би сильніше за саме число.
     */
    const entries = sweepEntriesFor(rows({
      plans: [
        sweepPlan(2, 'Подорож'),
        {
          id: 1,
          title: 'Ремонт на кухні',
          status: 'done',
          startDate: '2023-04-02',
          completedAt: '2023-04-02T18:31:07.412Z',
          datePrecision: 'day',
        },
      ],
    }), YEAR);
    expect(entries.milestone.map((entry) => entry.label))
      .toEqual(['Подорож', 'Ремонт на кухні']);
  });

  it('рядок пари не отримує кнопки видалення', () => {
    const entries = sweepEntriesFor(rows({
      plans: [{
        id: 1,
        title: 'Ремонт на кухні',
        status: 'done',
        startDate: '2023-04-02',
        completedAt: '2023-04-02T18:31:07.412Z',
        datePrecision: 'day',
      }],
    }), YEAR);
    expect(entries.milestone[0]?.removable).toBe(false);
  });

  it('свій рядок прибирається', () => {
    const entries = sweepEntriesFor(rows({ plans: [sweepPlan(2, 'Подорож')] }), YEAR);
    expect(entries.milestone[0]?.removable).toBe(true);
  });

  /*
   * Кожна умова підпису — окремо. Досить зламати одну, і рядок мусить
   * перестати вважатись своїм: саме на цьому тримається обіцянка не
   * видалити чужого плану.
   */
  it.each([
    ['інший день', { startDate: '2023-04-02', completedAt: '2023-04-02T12:00:00.000Z' }],
    ['інший час', { completedAt: `${MIDDLE}T09:14:52.881Z` }],
    ['точність до дня', { datePrecision: 'day' }],
    ['не виконаний', { status: 'idea' }],
  ])('план із підписом «%s» не наш', (_name, patch) => {
    const entries = sweepEntriesFor(rows({
      plans: [{ ...sweepPlan(2, 'Подорож'), ...patch }],
    }), YEAR);
    // Рядок або поза роком, або в році без кнопки — але ніколи з нею.
    expect(entries.milestone.every((entry) => !entry.removable)).toBe(true);
  });

  it('не бере рядків із сусіднього року', () => {
    const entries = sweepEntriesFor(rows({ plans: [sweepPlan(2, 'Подорож')] }), NEXT_YEAR);
    expect(entries.milestone).toEqual([]);
  });

  it('мітка карти належить рокові за своєю датою', () => {
    const entries = sweepEntriesFor(rows({
      places: [
        { id: 5, title: 'Кав\'ярня', city: 'Київ', visitedAt: MIDDLE },
        { id: 6, title: 'Набережна', city: 'Київ', visitedAt: '2023-07-19' },
        { id: 7, title: 'Львів', city: null, visitedAt: '2025-01-04' },
      ],
    }), YEAR);
    expect(entries.place.map((entry) => [entry.label, entry.removable]))
      .toEqual([['Кав\'ярня', true], ['Набережна', false]]);
  });

  it('переглянуте впізнається за тим самим підписом', () => {
    const entries = sweepEntriesFor(rows({
      watched: [
        { id: 9, title: 'Severance', type: 'series', finishedAt: `${MIDDLE}${SWEEP_STAMP}` },
        { id: 8, title: 'Dune', type: 'movie', finishedAt: '2023-05-02T21:40:11.003Z' },
      ],
    }), YEAR);
    expect(entries.watched.map((entry) => [entry.label, entry.detail, entry.removable]))
      .toEqual([['Severance', 'серіал', true], ['Dune', 'фільм', false]]);
  });

  it('своє — зверху, і найновіше першим', () => {
    /*
     * Помилковий дотик щойно стався, тобто його рядок наймолодший. Він
     * має бути там, де по нього потягнеться рука, а не сьомим у списку.
     */
    const entries = sweepEntriesFor(rows({
      plans: [
        sweepPlan(2, 'Подорож'),
        sweepPlan(41, 'Весілля'),
        {
          id: 30,
          title: 'Ремонт',
          status: 'done',
          startDate: '2023-04-02',
          completedAt: '2023-04-02T18:31:07.412Z',
          datePrecision: 'day',
        },
      ],
    }), YEAR);
    expect(entries.milestone.map((entry) => entry.label))
      .toEqual(['Весілля', 'Подорож', 'Ремонт']);
  });

  it('порожній рік дає порожні списки, а не відсутні', () => {
    const entries = sweepEntriesFor(rows({}), YEAR);
    expect(entries).toEqual({ milestone: [], place: [], watched: [] });
  });
});

describe('запис часу з бази', () => {
  /*
   * ВАДА, ЧЕРЕЗ ЯКУ ЕКРАН НЕ ДАВАВ ПРИБРАТИ НІЧОГО ЗІ СВОГО Ж (ADR-0110).
   *
   * Портал пише `2023-06-27T12:00:00.000Z`, а PostgREST повертає ту саму
   * мить як `2023-06-27T12:00:00+00:00`. Порівняння РЯДКАМИ її не
   * впізнавало, тож кожна щойно додана віха поверталась із бази чужою:
   * тьмяною, без хрестика, з приміткою «міняють там, де завели».
   *
   * Тест іде від того, що ВІДДАЄ БАЗА, а не від того, що пише портал, —
   * інакше він знову перевірятиме шлях, яким портал не ходить.
   */
  const postgrest = (day: string) => `${day}T12:00:00+00:00`;

  it('упізнає свій план, записаний так, як його віддає PostgREST', () => {
    const entries = sweepEntriesFor(rows({
      plans: [{
        id: 7,
        title: 'Переїзд',
        status: 'done',
        startDate: MIDDLE,
        completedAt: postgrest(MIDDLE),
        datePrecision: 'year',
      }],
    }), YEAR);

    expect(entries.milestone).toHaveLength(1);
    expect(entries.milestone[0]!.removable).toBe(true);
  });

  it('упізнає свій фільм, записаний так само', () => {
    const entries = sweepEntriesFor(rows({
      watched: [{ id: 3, title: 'Дюна', type: 'movie', finishedAt: postgrest(MIDDLE) }],
    }), YEAR);

    expect(entries.watched[0]!.removable).toBe(true);
  });

  it('не вважає своїм рядок пари, що просто трапився того самого дня', () => {
    // Полудень середини року — підпис; будь-який інший час ним не є.
    const entries = sweepEntriesFor(rows({
      watched: [{ id: 4, title: 'Свій фільм', type: 'movie', finishedAt: `${MIDDLE}T20:15:00+00:00` }],
    }), YEAR);

    expect(entries.watched[0]!.removable).toBe(false);
  });

  it('рядок БЕЗ ПОЯСА підписом не вважається — інакше відповідь залежала б від телефона', () => {
    /*
     * `Date.parse('2023-06-27T12:00:00')` читає рядок як МІСЦЕВИЙ час: у
     * Києві це 09:00Z, а на сервері тестів 12:00Z. Той самий рядок бази то
     * збігався б із підписом, то ні — залежно від того, хто дивиться.
     * Портал таких рядків не пише, тож єдина чесна відповідь — «не наш».
     */
    const entries = sweepEntriesFor(rows({
      watched: [{ id: 5, title: 'Хтозна', type: 'movie', finishedAt: `${MIDDLE}T12:00:00` }],
    }), YEAR);

    expect(entries.watched[0]!.removable).toBe(false);
  });
});
