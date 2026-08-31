import { describe, expect, it } from 'vitest';
import type { EvolutionSourceSnapshot } from '@/engine/evolution/adapters';
import type { PortalSources } from '@/features/world/portalSources';
import { EMPTY_YEAR_FILL, relationshipYearFills } from './yearFills';

// ============================================================
// Заради чого взагалі існує заповнення історії.
// ------------------------------------------------------------
// Пара, яка разом одинадцять років, отримує одинадцять ОДНАКОВИХ
// порожніх років. Ці перевірки тримають три числа, на яких стоїть увесь
// план онбордингу:
//
//   1. порожній рік — це 0.3, а не 0, і всі порожні роки однакові;
//   2. одна щорічна річниця піднімає ВСІ минулі роки одразу;
//   3. чотири модулі й сім подій на рік дають ~0.68, тобто вдвічі з
//      гаком більше за порожній.
//
// Якщо котресь із них зміниться в рушії, онбординг обіцятиме пар те,
// чого артефакт не зробить, — і впаде саме тут, а не на живому екрані.
// ============================================================

const START = '2015-06-10';
const AS_OF = '2026-06-01T00:00:00.000Z';

function emptySnapshot(): EvolutionSourceSnapshot {
  return {
    calendarEvents: [],
    plans: [],
    wishlistItems: [],
    mapPlaces: [],
    memories: [],
    memoryLinks: [],
    media: [],
  };
}

function sourcesWith(snapshot: Partial<EvolutionSourceSnapshot>): PortalSources {
  return {
    relationshipStartedAt: START,
    userIds: [1, 2],
    sharedDaysOff: [],
    snapshot: { ...emptySnapshot(), ...snapshot },
  };
}

const fills = (sources: PortalSources) => relationshipYearFills(sources, AS_OF, 'couple:test');

describe('роки давньої пари', () => {
  it('порожня історія дає однакову стелю порожнечі в кожному завершеному році', () => {
    const summary = fills(sourcesWith({}));
    const completed = summary.years.filter((year) => year.complete);

    expect(completed.length).toBe(10);
    for (const year of completed) {
      expect(year.fill, `рік ${year.label}`).toBeCloseTo(EMPTY_YEAR_FILL, 3);
    }
    expect(summary.emptyCount).toBe(completed.length);
  });

  it('одна щорічна річниця піднімає ВСІ минулі роки', () => {
    /*
     * Найбільший важіль усього онбордингу, і він уже стоїть у рушії:
     * `adapters/calendar.ts` для події з `yearly` сам породжує по одній
     * події на КОЖЕН рік від дати до сьогодні. Тобто чотири дотики на
     * першому кроці закривають вісь календаря в усіх одинадцятьох роках.
     */
    const summary = fills(sourcesWith({
      calendarEvents: [{
        id: 1, date: START, type: 'anniversary', yearly: true, isMilestone: true,
      }],
    }));

    expect(summary.emptyCount).toBe(0);
    for (const year of summary.years.filter((y) => y.complete)) {
      expect(year.fill, `рік ${year.label}`).toBeGreaterThan(EMPTY_YEAR_FILL);
    }
  });

  it('та сама річниця БЕЗ щорічності лишає всі наступні роки порожніми', () => {
    // Перевірка того, що важіль — саме `yearly`, а не наявність події.
    const summary = fills(sourcesWith({
      calendarEvents: [{
        id: 1, date: START, type: 'anniversary', yearly: false, isMilestone: true,
      }],
    }));

    expect(summary.emptyCount).toBeGreaterThanOrEqual(9);
  });

  it('чотири модулі й сім подій піднімають рік удвічі з гаком', () => {
    /*
     * Ціль проходу по роках, названа числом: не сто речей, а сім у
     * чотирьох модулях.
     *
     * Дати навмисно з ОДНОГО року стосунків, а не з одного календарного:
     * рік пари тут іде з 10 червня по 9 червня, і перша редакція цієї
     * перевірки розклала сім подій по двох роках (0.48 і 0.66), бо
     * рахувала календарними. Рік стосунків — не рік у календарі, і
     * онбординг питатиме саме про перший.
     */
    const year = '2017';
    const summary = fills(sourcesWith({
      calendarEvents: [{
        id: 1, date: `${year}-06-20`, type: 'anniversary', yearly: false, isMilestone: false,
      }],
      memories: [
        { id: 1, memoryDate: `${year}-07-02`, datePrecision: 'day', takenAt: null, createdAt: `${year}-07-02` },
        { id: 2, memoryDate: `${year}-08-14`, datePrecision: 'day', takenAt: null, createdAt: `${year}-08-14` },
        { id: 3, memoryDate: `${year}-11-30`, datePrecision: 'day', takenAt: null, createdAt: `${year}-11-30` },
      ],
      mapPlaces: [{
        id: 1, category: 'travel', visitedAt: `${year}-07-20`, createdAt: `${year}-07-20`,
        rating: null, city: 'Львів', country: 'Україна',
      }],
      media: [
        { id: 1, status: 'done', createdAt: `${year}-09-05` },
        { id: 2, status: 'done', createdAt: `${year}-12-11` },
      ],
    }));

    const filled = summary.years.find((entry) => entry.label === Number(year));
    expect(filled).toBeDefined();
    expect(filled!.fill).toBeGreaterThan(EMPTY_YEAR_FILL * 2);
  });

  it('без дати початку немає ані років, ані вигаданих чисел', () => {
    const summary = relationshipYearFills(
      { ...sourcesWith({}), relationshipStartedAt: '' },
      AS_OF,
      'couple:test',
    );

    expect(summary.years).toEqual([]);
    expect(summary.averageFill).toBe(0);
  });
});
