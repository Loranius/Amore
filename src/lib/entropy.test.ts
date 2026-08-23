import { describe, expect, it } from 'vitest';
import { chance, freshSeed, pickOne, randomFloat, randomInt, randomToken, uuidV4 } from './entropy';

// ============================================================
// Ентропія — межі, а не випадковість.
// ------------------------------------------------------------
// Перевіряти «випадкове на вигляд» безглуздо; перевіряти треба те, що
// мусить бути правдою при БУДЬ-ЯКОМУ кидку. Тому косметичні функції
// приймають джерело параметром, і тест підставляє межі діапазону.
// ============================================================

/** UUID версії 4 за RFC 4122. */
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('uuidV4', () => {
  it('видає справжній UUID v4', () => {
    /*
     * **Виміряна вада.** Запасний варіант у `ArchiveGiftFormModal` будував
     * `${Date.now()}-${random}-0000-4000-8000-000000000000` — шість груп
     * замість п'яти й тринадцять символів у першій замість восьми. А
     * `p_request_id` у базі має тип `uuid`, тож Postgres відхилив би такий
     * запис із «invalid input syntax for type uuid».
     *
     * Не спрацьовувало це ніколи лише тому, що `crypto.randomUUID` є в усіх
     * сучасних браузерах — АЛЕ ЛИШЕ В БЕЗПЕЧНОМУ КОНТЕКСТІ. Портал по
     * звичайному http лишається без нього, і саме там запасний шлях і
     * спрацював би.
     */
    for (let attempt = 0; attempt < 50; attempt += 1) {
      expect(uuidV4()).toMatch(UUID_V4);
    }
  });

  it('не повторюється', () => {
    const seen = new Set(Array.from({ length: 500 }, () => uuidV4()));
    expect(seen.size).toBe(500);
  });

  it('старий запасний рядок цим тестом НЕ пройшов би', () => {
    // Регресійний доказ: саме та форма, що лежала в коді.
    const legacy = `${Date.now()}-${(0.5).toString(16).slice(2)}-0000-4000-8000-000000000000`;
    expect(legacy).not.toMatch(UUID_V4);
  });
});

describe('randomToken', () => {
  it('непорожній і без роздільників — іде в шлях сховища', () => {
    const token = randomToken();
    expect(token.length).toBeGreaterThan(0);
    expect(token).toMatch(/^[0-9a-z]+$/);
  });

  it('не повторюється в межах пачки', () => {
    // Два знімки, завантажені в одну мілісекунду, мають різні імена:
    // `upsert: false` перетворює збіг на помилку завантаження.
    const seen = new Set(Array.from({ length: 500 }, () => randomToken()));
    expect(seen.size).toBe(500);
  });
});

describe('freshSeed', () => {
  it('вкладається в 32 біти без знака', () => {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const seed = freshSeed();
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThanOrEqual(0xffffffff);
    }
  });
});

describe('randomInt', () => {
  it('обидві межі досяжні й діапазон не перевищується', () => {
    expect(randomInt(1, 50, () => 0)).toBe(1);
    // Кидок прямує до 1, але ніколи його не досягає — саме тому верхня
    // межа включна лише при цьому наближенні.
    expect(randomInt(1, 50, () => 0.999999)).toBe(50);
    expect(randomInt(0, 0xffff, () => 0.5)).toBe(0x8000);
  });

  it('однакові межі дають те саме число', () => {
    expect(randomInt(7, 7, () => 0.42)).toBe(7);
  });

  it('перевернутий діапазон — помилка, а не тихе сміття', () => {
    expect(() => randomInt(10, 3)).toThrow(RangeError);
  });
});

describe('randomFloat', () => {
  it('тримається діапазону', () => {
    expect(randomFloat(6, 13, () => 0)).toBe(6);
    expect(randomFloat(6, 13, () => 0.5)).toBe(9.5);
    expect(randomFloat(1.4, 2.4, () => 1)).toBeCloseTo(2.4);
  });
});

describe('pickOne', () => {
  it('бере елемент за позицією кидка', () => {
    const items = ['a', 'b', 'c'] as const;
    expect(pickOne(items, () => 0)).toBe('a');
    expect(pickOne(items, () => 0.5)).toBe('b');
    expect(pickOne(items, () => 0.999999)).toBe('c');
  });

  it('порожній список — `null`, а не падіння', () => {
    // Усі три місця виклику (привітання, страва, колір конфеті) мовчать,
    // коли обирати нема з чого.
    expect(pickOne([])).toBeNull();
  });
});

describe('chance', () => {
  it('0 — ніколи, 1 — завжди', () => {
    expect(chance(0, () => 0)).toBe(false);
    expect(chance(1, () => 0.999999)).toBe(true);
    expect(chance(0.6, () => 0.59)).toBe(true);
    expect(chance(0.6, () => 0.61)).toBe(false);
  });
});
