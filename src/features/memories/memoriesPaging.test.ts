import { describe, expect, it } from 'vitest';
import {
  MEMORIES_FIRST_PAGE,
  MEMORIES_PAGE_STEP,
  hasMoreMemories,
  initialMemoriesCount,
  nextMemoriesCount,
} from './memoriesPaging';

describe('нарощування галереї спогадів', () => {
  it('перша пачка не залежить від розміру архіву', () => {
    // Це і є вимога: перший кадр розділу коштує однаково на тридцяти
    // семи спогадах і на п'ятистах.
    expect(initialMemoriesCount(500)).toBe(MEMORIES_FIRST_PAGE);
    expect(initialMemoriesCount(5000)).toBe(MEMORIES_FIRST_PAGE);
  });

  it('малий архів показується цілком, без порожньої позначки', () => {
    expect(initialMemoriesCount(9)).toBe(9);
    expect(hasMoreMemories(9, 9)).toBe(false);
  });

  it('ніколи не показує більше, ніж є', () => {
    expect(nextMemoriesCount(24, 30)).toBe(30);
    expect(nextMemoriesCount(30, 30)).toBe(30);
  });

  it('НІКОЛИ не зменшує показане', () => {
    // Головна вимога нарощування. Зменшення прибрало б із-під пальця вже
    // намальовані картки, і прокрутка стрибнула б — саме та вада, проти
    // якої це все й зроблено.
    for (const [current, total] of [[48, 100], [24, 24], [72, 50], [0, 0]]) {
      expect(nextMemoriesCount(current!, total!)).toBeGreaterThanOrEqual(
        Math.min(current!, total!),
      );
    }
    // Навіть коли архів раптом ужався (спогад видалили в іншій вкладці),
    // показане не «відкочується» нижче нового розміру.
    expect(nextMemoriesCount(72, 50)).toBe(50);
  });

  it('крок додає рівно пачку, поки архів більший', () => {
    expect(nextMemoriesCount(24, 500)).toBe(24 + MEMORIES_PAGE_STEP);
  });

  it('порожній архів не ламає арифметику', () => {
    expect(initialMemoriesCount(0)).toBe(0);
    expect(nextMemoriesCount(0, 0)).toBe(0);
    expect(hasMoreMemories(0, 0)).toBe(false);
  });

  it('відʼємні значення не пролазять', () => {
    // Захисна гілка: `shown` у стані ніколи не буває відʼємним, але
    // від'ємний РОЗМІР архіву обнуляється, а не перетворюється на «мінус
    // стільки-то карток».
    expect(initialMemoriesCount(-3)).toBe(0);
    // Обмеження розміром архіву сильніше за крок: −5 + 24 = 19, але
    // спогадів лише 10, тож і показати можна щонайбільше 10.
    expect(nextMemoriesCount(-5, 10)).toBe(10);
  });
});
