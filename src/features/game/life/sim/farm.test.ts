import { describe, expect, it } from 'vitest';
import { firstDayOfWeek, dayInfo } from './calendar';
import { ACTIVITIES, doActivity } from './activities';
import { BASKET_MAX, EGGS_PER_ROUND, FARM_GAMES, FISH, FISH_ODDS, FRUIT_PRICE, farmReward, farmSummary, fishFor, fruitEarnings, isFarmGame } from './farm';
import { newLife, type LifeState } from './life';

// ============================================================
// Заняття садиби з міні-грою (ADR-0239, власник 2026-10-13): «1 яблуко на
// продаж коштує 1 гривню, слива — 2 гривні, груша — 3 гривні. За одну гру
// можна зібрати максимум 15 фруктів», «максимум за раунд 20 яєць»,
// «рибалка … з трьома видами риби: карась, окунь і короп».
// ============================================================

describe('ціни й нагорода', () => {
  it('ціни на продаж — як сказав власник; кошик — до 15, яєць — до 20 за раунд', () => {
    expect(FRUIT_PRICE).toEqual({ apple: 1, plum: 2, pear: 3 });
    expect(BASKET_MAX).toBe(15);
    expect(EGGS_PER_ROUND).toBe(20);
  });

  it('гроші за сад — сума цін зібраного', () => {
    expect(fruitEarnings({ apple: 4, plum: 3, pear: 2 })).toBe(4 + 6 + 6);
    expect(fruitEarnings({})).toBe(0);
    // Повний кошик груш — найдорожчий, повний кошик яблук — найдешевший.
    expect(fruitEarnings({ pear: BASKET_MAX })).toBe(45);
    expect(fruitEarnings({ apple: BASKET_MAX })).toBe(15);
    expect(farmReward('orchard', { apple: 4, plum: 3, pear: 2 }, 0.6).earned).toBe(16);
  });

  it('три види риби: карась найчастіше, короп найрідше; кидок 0..1 → вид', () => {
    expect([...FISH]).toEqual(['karas', 'okun', 'korop']);
    expect(FISH.reduce((s, f) => s + FISH_ODDS[f], 0)).toBeCloseTo(1, 10);
    expect(FISH_ODDS.karas).toBeGreaterThan(FISH_ODDS.okun);
    expect(FISH_ODDS.okun).toBeGreaterThan(FISH_ODDS.korop);
    expect(fishFor(0)).toBe('karas');
    expect(fishFor(0.5499)).toBe('karas');
    expect(fishFor(0.55)).toBe('okun');
    expect(fishFor(0.8499)).toBe('okun');
    expect(fishFor(0.8501)).toBe('korop');
    expect(fishFor(0.9999)).toBe('korop');
  });

  it('город, курник і ставок гріють стосунки з мамою тим більше, що краще зіграно', () => {
    expect(farmReward('garden', {}, 0).mom).toBe(0);
    expect(farmReward('garden', { potato: 5 }, 1).mom).toBe(0.5);
    expect(farmReward('eggs', { eggs: 0, broken: 20 }, 0).mom).toBe(0);
    expect(farmReward('eggs', { eggs: 20 }, 1).mom).toBe(0.4);
    expect(farmReward('eggs', { eggs: 10 }, 0.5).mom).toBe(0.2);
    expect(farmReward('fishing', { missed: 5 }, 0).mom).toBe(0);
    expect(farmReward('fishing', { okun: 1 }, 0.2).mom).toBe(0.2);
    // Гроші — лише за сад: решта — для дому.
    for (const id of ['garden', 'eggs', 'fishing'] as const) expect(farmReward(id, { eggs: 20, potato: 9, korop: 3 }, 1).earned).toBe(0);
  });

  it('картка після гри: що зібрано й скільки це', () => {
    expect(farmSummary('orchard', { apple: 2, pear: 1 })).toEqual(['Яблука: 2 × 1 ₴ = 2 ₴', 'Груші: 1 × 3 ₴ = 3 ₴', 'Разом на продаж: 5 ₴']);
    expect(farmSummary('orchard', {})).toEqual(['Кошик порожній', 'Разом на продаж: 0 ₴']);
    expect(farmSummary('eggs', { eggs: 17, broken: 3 })).toEqual(['Яєць у кошику: 17 з 20', 'Розбилось: 3']);
    expect(farmSummary('fishing', { karas: 2, korop: 1, missed: 2 })).toEqual(['Карась: 2', 'Окунь: 0', 'Короп: 1', 'Зірвалось: 2']);
    expect(farmSummary('garden', { potato: 3, corn: 1, moles: 2, weeds: 4 })).toEqual(['Картопля: 3', 'Кукурудза: 1', 'Кротів прогнано: 2', "Бур'янів вирвано: 4"]);
    expect(() => farmSummary('gym', {})).toThrow('без міні-гри');
  });
});

describe('заняття садиби', () => {
  const summer = Array.from({ length: 7 * 52 }, (_, d) => firstDayOfWeek(17) + d).find((d) => dayInfo(d).season === 'summer')!;
  const s = (patch: Partial<LifeState> = {}): LifeState => ({ ...newLife(21, 'adult'), city: 'zhylyntsi', day: summer, minute: 10 * 60, doneToday: [], ...patch });

  it('кожна гра садиби — заняття в Жилинцях, і навпаки', () => {
    for (const id of FARM_GAMES) expect(ACTIVITIES.find((a) => a.id === id)?.city, id).toBe('zhylyntsi');
    expect(isFarmGame('orchard')).toBe(true);
    expect(isFarmGame('gym')).toBe(false);
  });

  it('без зіграної гри заняття не зараховується; сад платить за зібране', () => {
    for (const id of FARM_GAMES) expect(() => doActivity(s(), id), id).toThrow('Спершу — сама гра');
    const before = s();
    const after = doActivity(before, 'orchard', { score: 1, tally: { apple: 5, plum: 5, pear: 5 } }).state;
    expect(after.money - before.money).toBe(5 + 10 + 15);
    expect(after.doneToday).toContain('act:orchard');
  });

  it('курник: що більше яєць мамі в кошик, то тепліше з мамою', () => {
    const base = s({ hearts: { mom: 6, dima: 6, friend: 6 } });
    const none = doActivity(base, 'eggs', { score: 0, tally: { eggs: 0, broken: 20 } }).state.hearts.mom;
    const all = doActivity(base, 'eggs', { score: 1, tally: { eggs: 20, broken: 0 } }).state.hearts.mom;
    expect(none).toBeCloseTo(6.1, 10);
    expect(all).toBeCloseTo(6.5, 10);
  });
});
