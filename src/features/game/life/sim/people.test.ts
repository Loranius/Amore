import { describe, expect, it } from 'vitest';
import { firstDayOfWeek } from './calendar';
import { CITY_IDS } from './content';
import { newLife, type LifeState } from './life';
import {
  CLOSE_LEVEL,
  FRIEND_LEVEL,
  RESIDENTS,
  chat,
  coffeeCheck,
  coffeeWith,
  friendship,
  giftResident,
  lineFor,
  meetResident,
  relationName,
  residentsIn,
} from './people';
import { parseSave, serialize } from './save';

// ============================================================
// Власник, 2026-10-04: «додай можливість знайомств». Знайомство — у місті
// людини; дружба росте від розмов, подарунків і кави; близька дружба вчить.
// ============================================================

const at = (patch: Partial<LifeState> = {}): LifeState => ({
  ...newLife(13, 'adult'),
  day: firstDayOfWeek(17) + 1,
  minute: 9 * 60,
  doneToday: [],
  ...patch,
});

describe('знайомства', () => {
  it('у кожному місті є з ким познайомитися', () => {
    for (const city of CITY_IDS) expect(RESIDENTS.some((r) => r.city === city)).toBe(true);
  });

  it('одногрупниця — лише з університету; знайомство — у її місті', () => {
    const kid = { ...newLife(1), city: 'vinnytsia' as const };
    expect(residentsIn(kid, 'vinnytsia').map((r) => r.id)).not.toContain('iryna');
    expect(() => meetResident(at({ city: 'kyiv' }), 'iryna')).toThrow(/Вінниця/);
  });

  it('познайомитись → поговорити раз на день → подружитися → кава й навчання', () => {
    let s = meetResident(at({ city: 'vinnytsia' }), 'taras').state;
    expect(friendship(s, 'taras')).toBeGreaterThan(0);
    expect(relationName(s, 'taras')).toBe('Знайомі');
    expect(() => chat(s, 'taras')).toThrow(/вже/);
    expect(coffeeCheck(s, 'taras').ok).toBe(false);
    for (let d = 1; friendship(s, 'taras') < FRIEND_LEVEL; d += 1) s = chat({ ...s, day: s.day + 1, doneToday: [] }, 'taras').state;
    expect(relationName(s, 'taras')).toBe('Друг');
    s = coffeeWith({ ...s, doneToday: [] }, 'taras').state;
    // Близька дружба вчить навички людини.
    const close = { ...s, people: { ...s.people, taras: CLOSE_LEVEL }, doneToday: [] };
    expect(chat(close, 'taras').state.skills.charm).toBe(close.skills.charm + 1);
  });

  it('подарунок із сумки зближує; репліка стабільна протягом дня', () => {
    const s = meetResident(at({ city: 'odesa', gifts: ['tulips'] }), 'katya').state;
    const gifted = giftResident({ ...s, doneToday: [] }, 'katya', 'tulips').state;
    expect(friendship(gifted, 'katya')).toBeGreaterThan(friendship(s, 'katya'));
    expect(gifted.gifts).toEqual([]);
    expect(lineFor(s, 'katya')).toBe(lineFor(s, 'katya'));
  });

  it('сейв зберігає знайомства, старий сейв без них читається', () => {
    const s = meetResident(at({ city: 'lviv' }), 'ostap').state;
    expect(parseSave(serialize(s)).people).toEqual(s.people);
    const old = JSON.parse(serialize(s)) as Record<string, unknown>;
    delete old.people;
    expect(parseSave(JSON.stringify(old)).people).toEqual({});
  });
});
