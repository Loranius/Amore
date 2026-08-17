import { describe, expect, it } from 'vitest';
import { sinceLabel } from './EventDetails';

const TODAY = new Date(Date.UTC(2026, 7, 17));

describe('sinceLabel', () => {
  it('сьогоднішня подія так і каже', () => {
    expect(sinceLabel('2026-08-17', TODAY)).toBe('сьогодні');
  });

  it('майбутня подія не рахує від’ємних днів', () => {
    // Річниці бувають попереду — «-30 днів тому» було б безглуздям.
    expect(sinceLabel('2026-12-31', TODAY)).toBe('попереду');
  });

  it('дні, місяці й роки міняються на своїх межах', () => {
    expect(sinceLabel('2026-08-16', TODAY)).toBe('1 день тому');
    expect(sinceLabel('2026-08-14', TODAY)).toBe('3 дні тому');
    expect(sinceLabel('2026-08-02', TODAY)).toBe('15 днів тому');
    expect(sinceLabel('2026-06-17', TODAY)).toBe('2 місяці тому');
    expect(sinceLabel('2022-12-26', TODAY)).toBe('3 роки тому');
  });

  it('українська множина не збивається на 11–14', () => {
    // 11 днів — «днів», а не «день»: саме цей виняток найлегше загубити.
    expect(sinceLabel('2026-08-06', TODAY)).toBe('11 днів тому');
    expect(sinceLabel('2026-08-05', TODAY)).toBe('12 днів тому');
    expect(sinceLabel('2026-08-03', TODAY)).toBe('14 днів тому');
    expect(sinceLabel('2026-08-04', TODAY)).toBe('13 днів тому');
  });

  it('двадцять один день — «день», а не «днів»', () => {
    expect(sinceLabel('2026-07-27', TODAY)).toBe('21 день тому');
  });

  it('зіпсута дата не ламає панель', () => {
    expect(sinceLabel('', TODAY)).toBeNull();
    expect(sinceLabel('не дата', TODAY)).toBeNull();
  });

  it('пояс не перекидає добу', () => {
    // Дати в базі без часу; порівняння йде з UTC-полудня, тож зсув на кілька
    // годин у будь-який бік не робить «сьогодні» вчорашнім.
    expect(sinceLabel('2026-08-17', new Date(Date.UTC(2026, 7, 17, 23, 59)))).toBe('сьогодні');
    expect(sinceLabel('2026-08-17', new Date(Date.UTC(2026, 7, 17, 0, 1)))).toBe('сьогодні');
  });
});
