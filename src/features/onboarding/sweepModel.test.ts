import { describe, expect, it } from 'vitest';
import { sweepStepOf, yearsBehind } from './sweepModel';
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

  it('річниця, додана ПОЗА онбордингом, закриває крок', () => {
    /*
     * Заради цього крок і виводиться, а не зберігається. Збережений крок
     * не знав би про подію, створену в календарі, і питав би те, що вже
     * є, — а другий стан, який розходиться з першим, тут уже коштував
     * не однієї вади.
     */
    expect(sweepStepOf({ relationshipStartedAt: '2015-06-10', yearlyAnniversaryCount: 1 }))
      .toBe('done');
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
