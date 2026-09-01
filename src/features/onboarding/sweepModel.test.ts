import { describe, expect, it } from 'vitest';
import { PLAN_CATEGORY_ORDER } from '@/features/plans/planConstants';
import { PLAN_PRESSURES } from '@/engine/evolution/adapters/rules';
import {
  YEAR_MILESTONES,
  middleOfYear,
  quietestYearIndex,
  sweepStepOf,
  yearContaining,
  yearsBehind,
} from './sweepModel';
import type { RelationshipYearFill } from './yearFills';

function year(index: number, complete: boolean): RelationshipYearFill {
  return {
    index,
    label: 2014 + index,
    startsAt: `${2014 + index}-06-10`,
    endsAt: `${2015 + index}-06-10`,
    complete,
    fill: 0.3,
  };
}

describe('крок заповнення історії виводиться з даних', () => {
  it('немає дати — питаємо дату', () => {
    expect(sweepStepOf({ relationshipStartedAt: '', yearlyAnniversaryCount: 3 })).toBe('date');
    expect(sweepStepOf({ relationshipStartedAt: '   ', yearlyAnniversaryCount: 3 })).toBe('date');
  });

  it('дата є, щорічних дат немає — питаємо річниці', () => {
    expect(sweepStepOf({ relationshipStartedAt: '2015-06-10', yearlyAnniversaryCount: 0 }))
      .toBe('anniversaries');
  });

  it('річниця, додана ПОЗА онбордингом, відкриває прохід по роках', () => {
    /*
     * Заради цього крок і виводиться, а не зберігається. Збережений крок
     * не знав би про подію, створену в календарі, і питав би те, що вже
     * є, — а другий стан, який розходиться з першим, тут уже коштував
     * не однієї вади.
     */
    expect(sweepStepOf({ relationshipStartedAt: '2015-06-10', yearlyAnniversaryCount: 1 }))
      .toBe('years');
  });

  it('стану «готово» немає навмисно', () => {
    /*
     * Прохід по роках не завершується сам: пара має право лишити рік
     * порожнім, і жодне число не скаже, що історія «заповнена». Тому
     * останній крок — це `years`, а вийти з нього можна будь-коли
     * кнопкою, а не досягнувши умови.
     */
    const steps = new Set([
      sweepStepOf({ relationshipStartedAt: '', yearlyAnniversaryCount: 0 }),
      sweepStepOf({ relationshipStartedAt: '2015-06-10', yearlyAnniversaryCount: 0 }),
      sweepStepOf({ relationshipStartedAt: '2015-06-10', yearlyAnniversaryCount: 9 }),
    ]);

    expect([...steps].sort()).toEqual(['anniversaries', 'date', 'years']);
  });
});

describe('віха сідає в середину року, а не на його межу', () => {
  it('середина — це середина', () => {
    // 365 днів, половина — 182.5, тобто 9 грудня о полудні. Очікування
    // «10 грудня» тут спершу й стояло: моя арифметика, не помилка коду.
    expect(middleOfYear('2017-06-10', '2018-06-10')).toBe('2017-12-09');
  });

  it('перевернутий або зіпсований проміжок віддає початок, а не NaN', () => {
    expect(middleOfYear('2018-06-10', '2017-06-10')).toBe('2018-06-10');
    expect(middleOfYear('нонсенс', '2018-06-10')).toBe('нонсенс');
  });
});

describe('прохід починається з найтихішого року', () => {
  it('береться найменш наповнений ЗАВЕРШЕНИЙ рік', () => {
    /*
     * Не перший: прохід кидають на середині, і кинути треба там, де вже
     * все одно порожньо.
     */
    const years = [
      { ...year(1, true), fill: 0.62 },
      { ...year(2, true), fill: 0.30 },
      { ...year(3, true), fill: 0.48 },
      { ...year(4, false), fill: 0.10 },
    ];

    expect(quietestYearIndex(years)).toBe(1);
  });

  it('коли завершених років ще немає — перший', () => {
    expect(quietestYearIndex([year(1, false)])).toBe(0);
    expect(quietestYearIndex([])).toBe(0);
  });
});

describe('смуга рахує роки позаду, а не стовпчики', () => {
  it('рік, який іде зараз, ще не прожитий', () => {
    /*
     * Регресія: смуга писала «4 роки разом» парі, яка разом три роки й
     * вісім місяців, бо брала довжину масиву. Головна тим часом чесно
     * рахувала 1344 дні — тобто два екрани порталу казали різне про той
     * самий факт.
     */
    const years = [year(1, true), year(2, true), year(3, true), year(4, false)];

    expect(yearsBehind(years)).toBe(3);
    expect(yearsBehind(years)).not.toBe(years.length);
  });

  it('порожня історія — нуль років позаду, а не помилка', () => {
    expect(yearsBehind([])).toBe(0);
  });
});

describe('фішки року обіцяють рівно те, що зробить рушій', () => {
  it('кожна категорія відома і порталу, і рушію', () => {
    /*
     * Дві перевірки, бо в цієї помилки два тихих кінці. Портал намалює
     * невідому категорію без значка; рушій же НЕ відкине її, а підмінить
     * на `other` (`adapters/plans.ts`) — і «Подорож» ростиме сталістю,
     * тобто рік вийде не тим, чим його назвали.
     */
    for (const milestone of YEAR_MILESTONES) {
      expect(PLAN_CATEGORY_ORDER, milestone.label).toContain(milestone.category);
      expect(Object.keys(PLAN_PRESSURES), milestone.label).toContain(milestone.category);
    }
  });

  it('фішки не обіцяють каналів, яких у них немає', () => {
    /*
     * Підказка екрана називає три канали поіменно: подорож —
     * дослідження, переїзд — сталість, весілля — значущість. Якщо
     * PLAN_PRESSURES колись переїде, впаде саме ця перевірка, а не
     * довіра пари до екрана.
     */
    const channelOf = (label: string) => {
      const milestone = YEAR_MILESTONES.find((entry) => entry.label.startsWith(label))!;
      return PLAN_PRESSURES[milestone.category]!;
    };

    expect(channelOf('Подорож').exploration).toBeGreaterThan(0.5);
    expect(channelOf('Переїзд').stability).toBeGreaterThan(0.5);
    expect(channelOf('Весілля').significance).toBeGreaterThan(0.2);
  });
});

describe('день знаходить свій рік стосунків', () => {
  const years = [year(1, true), year(2, true), year(3, false)];

  it('день усередині року', () => {
    // Рік 1 тут іде з 10.06.2015 по 10.06.2016 — не календарний.
    expect(yearContaining(years, '2015-07-01')!.index).toBe(1);
    expect(yearContaining(years, '2016-12-31')!.index).toBe(2);
  });

  it('день річниці належить рокові, який ПОЧИНАЄТЬСЯ', () => {
    /*
     * Межа тут не дрібниця: рік стосунків іде від річниці до річниці, і
     * якби обидва кінці були включними, 10 червня належало б двом рокам
     * одразу — а місце, додане того дня, підняло б не той рік.
     */
    expect(yearContaining(years, '2016-06-10')!.index).toBe(2);
    expect(yearContaining(years, '2015-06-10')!.index).toBe(1);
  });

  it('день поза історією не вигадує року', () => {
    expect(yearContaining(years, '2009-01-01')).toBeNull();
    expect(yearContaining(years, '')).toBeNull();
  });

  it('позначку часу приймає так само, як день', () => {
    // З бази дата приходить і як `YYYY-MM-DD`, і як позначка часу.
    expect(yearContaining(years, '2015-07-01T12:00:00.000Z')!.index).toBe(1);
  });
});
