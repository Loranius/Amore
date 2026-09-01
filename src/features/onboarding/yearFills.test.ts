import { describe, expect, it } from 'vitest';
import type {
  EvolutionSourceSnapshot,
  MapPlaceSource,
  MediaSource,
  PlanSource,
  WishlistSource,
} from '@/engine/evolution/adapters';
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
        { id: 1, status: 'done', createdAt: `${year}-09-05`, finishedAt: null },
        { id: 2, status: 'done', createdAt: `${year}-12-11`, finishedAt: null },
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

// ============================================================
// Скільки насправді вартий прохід по роках.
// ------------------------------------------------------------
// Екран колись писав парі «вже N із СЕМИ, після яких рік перестає бути
// порожнім». Сімку ніхто не міряв — її придумав я. Вимір показав інше, і
// саме тому ці два числа тепер стоять у тесті: щоб наступна редакція
// копірайту сперлась на рушій, а не на відчуття.
// ============================================================

const MID_2017 = '2017-12-09';

function donePlan(id: number, category: string): PlanSource {
  return {
    id,
    category,
    status: 'done',
    startDate: MID_2017,
    endDate: null,
    completedAt: `${MID_2017}T12:00:00.000Z`,
    createdAt: MID_2017,
  };
}

function grantedWish(id: number): WishlistSource {
  return {
    id,
    fulfilled: true,
    fulfilledAt: `${MID_2017}T12:00:00.000Z`,
    giftDate: MID_2017,
    isShared: true,
    priority: null,
    ownerId: 1,
    fulfilledById: 2,
  };
}

const fillOf2017 = (sources: PortalSources): number => (
  fills(sources).years.find((year) => year.label === 2017)!.fill
);

describe('віхи року: перша важить більше за наступні шість', () => {
  it('одна віха вже виводить рік із порожнечі', () => {
    /*
     * 0.3 → 0.392. Наповненість зважена в бік ШИРОТИ (`yearActivity`:
     * 0.6 за модулі, 0.4 за обсяг), тож перший же виконаний план
     * відкриває рокові цілий модуль із шести.
     */
    expect(fillOf2017(sourcesWith({}))).toBeCloseTo(EMPTY_YEAR_FILL, 3);
    expect(fillOf2017(sourcesWith({ plans: [donePlan(1, 'trip')] }))).toBeCloseTo(0.392, 3);
  });

  it('сім віх дають менше, ніж удвічі більше за одну', () => {
    /*
     * 0.473 проти 0.392 — шість додаткових дотиків додають 0.081, тобто
     * менше за перший. Усі вони пишуть в ОДИН модуль, а глибина в
     * межах модуля насичується (`YEAR_DEPTH_HALF_SATURATION`).
     *
     * Звідси й правило екрана: обіцяти можна вихід із порожнечі, а не
     * «сім, після яких рік нарешті рахується».
     */
    const seven = [1, 2, 3, 4, 5, 6, 7].map((id) => donePlan(id, 'trip'));
    const many = fillOf2017(sourcesWith({ plans: seven }));

    expect(many).toBeCloseTo(0.473, 3);
    expect(many).toBeLessThan(0.392 * 2);
  });

  it('другий модуль важить більше за шість зайвих віх у першому', () => {
    /*
     * План + подарунок (0.48) переважує СІМ планів (0.473). Це вимір, а
     * не смак, і з нього випливає наступний крок плану: прохід по роках
     * упреться не в кількість фішок, а в те, що лише `plans` уміє
     * зберегти спогад, у якого пара пам'ятає рік, а не день
     * (`date_precision`). Поки другий такий модуль не з'явиться, фішки
     * лишаються в одному.
     */
    const two = fillOf2017(sourcesWith({
      plans: [donePlan(1, 'trip')],
      wishlistItems: [grantedWish(1)],
    }));
    const seven = fillOf2017(sourcesWith({
      plans: [1, 2, 3, 4, 5, 6, 7].map((id) => donePlan(id, 'trip')),
    }));

    expect(two).toBeGreaterThan(seven);
  });
});

// ============================================================
// Карта: модуль, який почали втрачати.
// ------------------------------------------------------------
// `adapters/map.ts` починається з `if (!row.visitedAt) continue`, а
// єдиний живий шлях створення мітки (`useEnsurePlacePin`) цього поля не
// ставив; другий, у `useMapPinMutations`, не має жодного споживача.
//
// Старі мітки пари датовані — правило колись працювало й зникло з коду,
// тож невидимими ставали САМЕ НОВІ. Перевірки нижче тримають не історію,
// а ціну: скільки коштує мітка без дати й скільки з нею.
// ============================================================

function visitedPlace(id: number, visitedAt: string | null): MapPlaceSource {
  return {
    id,
    category: 'visited',
    visitedAt,
    createdAt: MID_2017,
    rating: null,
    city: 'Львів',
    country: 'Україна',
  };
}

describe('мітка без дати невидима рушієві', () => {
  it('три справжні місця без дати лишають рік РІВНО порожнім', () => {
    /*
     * Не «менше, ніж могло б» — рівно 0.3, стеля порожнечі. Три поїздки,
     * позначені на власній карті, важать стільки ж, скільки рік, у якому
     * не сталось нічого.
     */
    const places = { mapPlaces: [1, 2, 3].map((id) => visitedPlace(id, null)) };

    expect(fillOf2017(sourcesWith(places))).toBeCloseTo(EMPTY_YEAR_FILL, 3);
    expect(fills(sourcesWith(places)).emptyCount).toBe(10);
  });

  it('одна датована мітка важить стільки ж, скільки весь важіль річниць', () => {
    /*
     * 0.480 → 0.566, тобто +0.086. Для порівняння: щорічна річниця
     * піднімає рік на 0.092. Одне датоване місце вартує майже того
     * самого — і саме тому крок «де ви були того року?» стоїть у проході
     * поруч із віхами, а не замість них.
     */
    const withoutPlace = fillOf2017(sourcesWith({
      calendarEvents: [{
        id: 1, date: START, type: 'anniversary', yearly: true, isMilestone: true,
      }],
      plans: [donePlan(1, 'trip')],
    }));
    const withPlace = fillOf2017(sourcesWith({
      calendarEvents: [{
        id: 1, date: START, type: 'anniversary', yearly: true, isMilestone: true,
      }],
      plans: [donePlan(1, 'trip')],
      mapPlaces: [visitedPlace(1, MID_2017)],
    }));

    expect(withoutPlace).toBeCloseTo(0.480, 3);
    expect(withPlace).toBeCloseTo(0.566, 3);
  });
});

// ============================================================
// Медіа: 194 позиції в одному році — і що з цим зробила колонка.
// ------------------------------------------------------------
// До 2026-09-01 `adaptMedia` датував переглянуте днем СТВОРЕННЯ рядка,
// бо іншої дати в таблиці не було. На робочій базі власника це поклало
// всі 194 переглянуті позиції в ЧЕТВЕРТИЙ рік стосунків — той, коли
// вотчліст завели в порталі, — а роки 1–3 не дістали від медіа нічого.
//
// Колонка `finished_at` (ADR-0080) розводить ці дві дати. Перевірки
// нижче тримають обидва боки: що вона справді керує роком і що
// запасний шлях на `created_at` нікуди не зник.
// ============================================================

function watched(id: number, finishedAt: string | null, createdAt: string): MediaSource {
  return { id, status: 'done', createdAt, finishedAt };
}

describe('медіа датується завершенням, а не створенням рядка', () => {
  it('рядок, СТВОРЕНИЙ сьогодні, піднімає той рік, у якому його закінчили', () => {
    /*
     * Саме цей випадок і є прохід по роках: пара каже «ми дивились це у
     * сімнадцятому», рядок з'являється сьогодні. Без `finished_at` він
     * ліг би в поточний рік, і крок обіцяв би те, чого не робить.
     */
    const summary = fills(sourcesWith({
      media: [watched(1, `${MID_2017}T12:00:00.000Z`, '2026-09-01T10:00:00.000Z')],
    }));

    const seventeen = summary.years.find((year) => year.label === 2017)!;
    expect(seventeen.fill).toBeGreaterThan(EMPTY_YEAR_FILL);
  });

  it('без дати завершення рік і далі бере день створення', () => {
    /*
     * Запасний шлях лишається чинним: 194 позиції власника засіяні
     * рівно з `created_at`, і артефакт після міграції не зрушив.
     */
    const summary = fills(sourcesWith({
      media: [watched(1, null, `${MID_2017}T12:00:00.000Z`)],
    }));

    expect(summary.years.find((year) => year.label === 2017)!.fill)
      .toBeGreaterThan(EMPTY_YEAR_FILL);
    expect(summary.years.find((year) => year.label === 2018)!.fill)
      .toBeCloseTo(EMPTY_YEAR_FILL, 3);
  });

  it('четвертий модуль переводить рік через ціль, названу на початку', () => {
    /*
     * ADR-0077 назвав ціль числом: 0.68. Три модулі, які прохід мав до
     * медіа, впирались у 0.613 — тобто ціль була недосяжна тим, що
     * екран пропонував. Четвертий дає 0.707.
     */
    const three: Partial<EvolutionSourceSnapshot> = {
      calendarEvents: [{
        id: 1, date: START, type: 'anniversary', yearly: true, isMilestone: true,
      }],
      plans: [1, 2, 3].map((id) => donePlan(id, 'trip')),
      mapPlaces: [1, 2, 3].map((id) => visitedPlace(id, MID_2017)),
    };
    const withMedia: Partial<EvolutionSourceSnapshot> = {
      ...three,
      media: [1, 2, 3].map((id) => watched(id, `${MID_2017}T12:00:00.000Z`, '2026-09-01')),
    };

    expect(fillOf2017(sourcesWith(three))).toBeCloseTo(0.613, 3);
    expect(fillOf2017(sourcesWith(withMedia))).toBeCloseTo(0.707, 3);
    expect(fillOf2017(sourcesWith(withMedia))).toBeGreaterThan(0.68);
  });
});
