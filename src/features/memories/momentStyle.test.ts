import { describe, expect, it } from 'vitest';
import { albumColumns, photoAspect } from './momentStyle';

describe('пропорції кадру в альбомі', () => {
  it('те саме фото завжди тієї самої форми', () => {
    expect(photoAspect(7)).toBe(photoAspect(7));
  });

  it('форм справді кілька, а не одна', () => {
    // Однакові квадрати дають каталог товарів, а не альбом.
    const shapes = new Set(Array.from({ length: 200 }, (_v, i) => photoAspect(i + 1)));
    expect(shapes.size).toBeGreaterThanOrEqual(3);
  });

  it('усі форми придатні для CSS aspect-ratio', () => {
    for (let id = 1; id <= 200; id += 1) {
      expect(photoAspect(id)).toBeGreaterThan(0);
      expect(Number.isFinite(photoAspect(id))).toBe(true);
    }
  });
});

describe('розкладка альбому', () => {
  const photos = (count: number) => Array.from({ length: count }, (_v, i) => ({ id: i + 1 }));

  it('жодне фото не загубилось і не подвоїлось', () => {
    for (const count of [0, 1, 2, 3, 7, 10]) {
      const lanes = albumColumns(photos(count));
      const flat = lanes.flat().map((p) => p.id);
      expect(flat).toHaveLength(count);
      expect(new Set(flat).size).toBe(count);
    }
  });

  it('перші два кадри стають ПОРУЧ, а не один під одним', () => {
    /*
     * Заради чого колонки набираються тут, а не через `column-count`.
     * Обидва CSS-механізми розкладають по вертикалі: перше фото опиняється
     * над другим, і хронологія, яку пара щойно склала руками, читається
     * зигзагом.
     */
    const lanes = albumColumns(photos(2));
    expect(lanes[0]).toHaveLength(1);
    expect(lanes[1]).toHaveLength(1);
    expect(lanes[0]![0]!.id).toBe(1);
    expect(lanes[1]![0]!.id).toBe(2);
  });

  it('колонки не розходяться по висоті', () => {
    // Жадібний набір: наступний кадр іде в коротшу колонку. Якби він ішов
    // по черзі, колонка з високими кадрами звисала б на пів екрана.
    const lanes = albumColumns(photos(9));
    const height = (lane: { id: number }[]) =>
      lane.reduce((sum, p) => sum + 1 / photoAspect(p.id), 0);
    expect(Math.abs(height(lanes[0]!) - height(lanes[1]!))).toBeLessThan(1.4);
  });

  it('одне фото не лишає порожньої колонки в розмітці', () => {
    const lanes = albumColumns(photos(1));
    expect(lanes[0]).toHaveLength(1);
    expect(lanes[1]).toHaveLength(0);
  });

  it('порожній альбом дає порожні колонки, а не виняток', () => {
    expect(albumColumns([])).toEqual([[], []]);
  });

  it('кількість колонок задається ззовні — на широкому екрані їх три', () => {
    const lanes = albumColumns(photos(6), 3);
    expect(lanes).toHaveLength(3);
    expect(lanes.flat()).toHaveLength(6);
  });

  it('вироджена кількість колонок не ділить на нуль', () => {
    expect(albumColumns(photos(3), 0)).toHaveLength(1);
  });
});
