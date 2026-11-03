import { describe, expect, it } from 'vitest';
import { firstDayOfWeek } from './calendar';
import { TRAVEL_CITY_IDS } from './content';
import { DIMA_LAST_GRADE, LifeRuleError, dutyToday, moveHome, newLife, sleep, storyEnded, storySeen, today, type LifeState } from './life';
import { parseSave, serialize } from './save';
import { familyAt } from '../world/vyshneve';

// ============================================================
// Історія Діми (ADR-0239, власник 2026-11-03: «додати гру за Діму, щоб у
// головному меню можна було вибрати персонажа»). Сюжет — з Godot-порту гри:
// народився 23 січня 2003-го у Вишневому, садочок «Чебурашка» з вересня
// 2008-го, школа до 3 класу, потім батьки розлучаються, і Діма переїжджає
// до бабусі в село — там історія поки закінчується.
// ============================================================

/** Останній вечір тижня життя `week` (уранці — наступний тиждень). */
function lastNightOf(state: LifeState, week: number): LifeState {
  return { ...state, story: null, day: firstDayOfWeek(week + 1) - 1 };
}

describe('Історія Діми', () => {
  it('починається у Вишневому, у квартирі, з вступних сторінок; календар — на рік пізніше за Лєнин', () => {
    const dima = newLife(7, 'dima');
    expect(dima.hero).toBe('dima');
    expect(dima.home).toBe('vyshneve');
    expect(dima.city).toBe('vyshneve');
    expect(dima.story).toBe('intro');
    const lena = newLife(7, 'sadok');
    expect(lena.hero).toBe('lena');
    expect(lena.story).toBeNull();
    // Той самий тиждень життя — садочок, але Діма йде туди у вересні 2008-го, на рік пізніше.
    expect(today(dima).stage).toBe('sadok');
    expect(today(dima).calendarYear).toBe(today(lena).calendarYear + 1);
    expect(today(dima).calendarYear).toBe(2008);
    expect(today(dima).age).toBe(today(lena).age);
  });

  it('вступ закривається раз; розлучення — ні: далі гри поки нема', () => {
    const seen = storySeen(newLife(7, 'dima'));
    expect(seen.story).toBeNull();
    expect(() => storySeen(seen)).toThrow(LifeRuleError);
    expect(() => storySeen({ ...seen, story: 'divorce' })).toThrow(LifeRuleError);
  });

  it('садочок і школа — у Вишневому', () => {
    const dima = { ...newLife(7, 'dima'), story: null };
    expect(dutyToday(dima)).toMatchObject({ kind: 'sadok', city: 'vyshneve', building: 'sadok' });
    const school = { ...dima, day: firstDayOfWeek(2) };
    expect(dutyToday(school)).toMatchObject({ kind: 'school', city: 'vyshneve', building: 'school', title: '2 клас' });
  });

  it('після 3 класу батьки розлучаються, і історія доходить до кінця; раніше — ні', () => {
    const dima = newLife(7, 'dima');
    const second = sleep(lastNightOf(dima, DIMA_LAST_GRADE - 1)).state;
    expect(second.story).toBeNull();
    expect(storyEnded(second)).toBe(false);
    const third = sleep(lastNightOf(dima, DIMA_LAST_GRADE)).state;
    expect(third.story).toBe('divorce');
    expect(storyEnded(third)).toBe(true);
    // У Лєни після 3 класу нічого такого не стається.
    const lena = sleep(lastNightOf(newLife(7, 'sadok'), DIMA_LAST_GRADE)).state;
    expect(lena.story).toBeNull();
  });

  it('Вишневе — лише Дімине: квитків туди нема й переїхати туди не можна', () => {
    expect(TRAVEL_CITY_IDS).not.toContain('vyshneve');
    const adult = { ...newLife(7, 'adult'), city: 'vyshneve' as const };
    expect(() => moveHome(adult, 'vyshneve')).toThrow(LifeRuleError);
  });

  it('герой і сторінки зберігаються; старий сейв без героя — Лєнин', () => {
    const dima = newLife(7, 'dima');
    expect(parseSave(serialize(dima))).toMatchObject({ hero: 'dima', story: 'intro', home: 'vyshneve' });
    const { hero: _hero, story: _story, ...old } = newLife(7, 'sadok');
    expect(parseSave(JSON.stringify(old))).toMatchObject({ hero: 'lena', story: null });
  });
});

describe('Родина Діми вдома (розклад з порту)', () => {
  const at = (week: number, dow: number) => today({ ...newLife(7, 'dima'), day: firstDayOfWeek(week) + dow });

  it('уночі всі сплять', () => {
    const f = familyAt(23 * 60, at(1, 0));
    expect([f.mom.task, f.dad.task, f.vlad.task]).toEqual(['спить', 'спить', 'спить']);
  });

  it('у будень удень батьки на роботі, Владік у садочку — нікого нема вдома', () => {
    const f = familyAt(12 * 60, at(1, 0));
    expect([f.mom.spot, f.dad.spot, f.vlad.spot]).toEqual([null, null, null]);
    expect(f.vlad.task).toBe('у садочку');
  });

  it('у вихідний мама на кухні, тато біля телевізора, Владік з кубиками', () => {
    const f = familyAt(10 * 60, at(1, 5));
    expect(f.mom.task).toBe('готує сніданок');
    expect(f.dad.task).toBe('дивиться телевізор');
    expect(f.vlad.task).toBe('будує вежу з кубиків');
  });

  it('у рік розлучення (3 клас) увечері мама мовчки миє посуд, тато стоїть на лоджії сам', () => {
    const f = familyAt(19 * 60, at(DIMA_LAST_GRADE, 5));
    expect(f.mom.task).toBe('мовчки миє посуд');
    expect(f.dad.task).toBe('стоїть на лоджії сам');
    const earlier = familyAt(19 * 60, at(DIMA_LAST_GRADE - 1, 5));
    expect(earlier.dad.task).toBe('дивиться телевізор');
  });
});
