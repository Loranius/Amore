// ============================================================
// Ручний порядок усередині дня.
// ------------------------------------------------------------
// Інваріант, який тут стережеться: перестановка зберігається так, щоб її
// не змогли скасувати метадані. `sort_order` нумерується з 1 (0 —
// «ніколи не чіпали») і записується лише для тих рядків, які справді
// поїхали з місця.
//
// Пара з groupMemoriesByDate: там перевірено, що ручний порядок
// перемагає час зйомки; тут — що він узагалі коректно рахується.
// ============================================================
import { describe, expect, it } from 'vitest';
import { moveMemory, orderChanged, orderPatch } from './memoriesOrder';
import type { MemoryRow } from '@/types';

const photo = (id: number, sortOrder = 0): MemoryRow => ({
  id,
  photo_url: `https://example/${id}.jpg`,
  moment_id: null,
  storage_bucket: null,
  storage_path: null,
  memory_date: '2026-07-14',
  date_precision: 'day',
  taken_at: null,
  caption: null,
  uploaded_by: 1,
  sort_order: sortOrder,
  created_at: '2026-07-14T10:00:00Z',
});

describe('moveMemory', () => {
  it('пересуває знімок на одну позицію вгору', () => {
    expect(moveMemory(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b']);
  });

  it('пересуває знімок на одну позицію вниз', () => {
    expect(moveMemory(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
  });

  it('край списку — не помилка, а просто нічого не відбувається', () => {
    // Кнопка «вгору» в першого знімка мусить бути безпечною: інакше
    // кожен виклик мав би сам перевіряти межі.
    expect(moveMemory(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
    expect(moveMemory(['a', 'b'], 1, 1)).toEqual(['a', 'b']);
  });

  it('не змінює вхідний масив', () => {
    const src = ['a', 'b', 'c'];
    moveMemory(src, 0, 1);
    expect(src).toEqual(['a', 'b', 'c']);
  });

  it('жоден знімок не губиться й не дублюється', () => {
    const src = ['a', 'b', 'c', 'd'];
    for (const [i, d] of [[0, 3], [3, -3], [1, 2], [2, -1]] as const) {
      expect([...moveMemory(src, i, d)].sort()).toEqual(src);
    }
  });
});

describe('orderPatch', () => {
  it('нумерує з одиниці, а не з нуля', () => {
    // Нуль — значення за замовчуванням; якби перший знімок теж отримав
    // нуль, база не відрізнила б «поставили першим» від «не чіпали».
    expect(orderPatch([photo(7), photo(8)])).toEqual([
      { id: 7, sort_order: 1 },
      { id: 8, sort_order: 2 },
    ]);
  });

  it('пише лише ті рядки, що справді змінились', () => {
    const patch = orderPatch([photo(1, 1), photo(9, 5), photo(3, 3)]);
    expect(patch).toEqual([{ id: 9, sort_order: 2 }]);
  });

  it('порядок, що вже збережений, не дає жодного запису', () => {
    expect(orderPatch([photo(1, 1), photo(2, 2), photo(3, 3)])).toEqual([]);
  });

  it('порожній день не дає запису', () => {
    expect(orderPatch([])).toEqual([]);
  });
});

describe('orderChanged', () => {
  it('бачить перестановку', () => {
    const a = [photo(1), photo(2)];
    expect(orderChanged(a, [a[1]!, a[0]!])).toBe(true);
  });

  it('незмінений список не вважається зміненим', () => {
    const a = [photo(1), photo(2)];
    expect(orderChanged(a, [...a])).toBe(false);
  });

  it('зникнення знімка теж зміна', () => {
    const a = [photo(1), photo(2)];
    expect(orderChanged(a, [a[0]!])).toBe(true);
  });
});
