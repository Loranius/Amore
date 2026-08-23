import { describe, expect, it } from 'vitest';
import { parseSeenEventIds } from './useGrowthSinceLastVisit';

// ============================================================
// Розбір збереженого списку бачених подій.
// ------------------------------------------------------------
// Тут вирішується не формат, а те, ЧИ БУВ візит. `null` вмикає гілку
// «перший візит», у якій підпису немає взагалі; порожня множина —
// протилежне: візит був, і все нове справді нове. Переплутати ці два
// стани означає або мовчати назавжди, або одного разу оголосити
// приростом усю історію пари.
// ============================================================

describe('пам’ять бачених подій', () => {
  it('відсутній запис — це перший візит, а не порожній список', () => {
    expect(parseSeenEventIds(null)).toBeNull();
  });

  it('порожній масив — це візит, у якому нічого не було', () => {
    const parsed = parseSeenEventIds('[]');
    expect(parsed).not.toBeNull();
    expect(parsed!.size).toBe(0);
  });

  it('читає збережені ключі', () => {
    const parsed = parseSeenEventIds('["a","b","a"]');
    expect([...parsed!].sort()).toEqual(['a', 'b']);
  });

  it('зіпсований вміст мовчить, а не рахує приріст', () => {
    // Краще не сказати нічого, ніж оголосити новим усе.
    expect(parseSeenEventIds('{')).toBeNull();
    expect(parseSeenEventIds('null')).toBeNull();
    expect(parseSeenEventIds('"a"')).toBeNull();
    expect(parseSeenEventIds('{"a":1}')).toBeNull();
  });

  it('чужі елементи в масиві відкидаються поштучно', () => {
    const parsed = parseSeenEventIds('["a",1,null,"b"]');
    expect([...parsed!].sort()).toEqual(['a', 'b']);
  });
});
