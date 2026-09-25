import { describe, expect, it } from 'vitest';
import { USER_NAME_MAX, asUserName, toAppUser } from './guards';

// ============================================================
// Межа з базою для імені людини (ADR-0209).
// ------------------------------------------------------------
// ВИМОГА. `users.name` у базі — звичайний `text`. Портал мусить впускати
// будь-яке розумне ім'я, бо інакше зареєстрована пара не може увійти.
//
// ВАДА, ЗА ФАКТОМ ЯКОЇ НАПИСАНО. `toAppUser` пропускав лише `'Діма'` і
// `'Лєна'`, а на решті повертав `null` — і `useUsers` цей `null`
// ВІДФІЛЬТРОВУВАВ. Тобто пара з іншими іменами не отримувала помилки:
// вона просто не існувала для екрана входу. Тиха відмова, той самий клас,
// що й ADR-0203.
//
// Тесту на `guards.ts` не було зовсім, хоч це файл, чия єдина робота —
// стояти на межі з базою.
// ============================================================

describe('asUserName впускає будь-яке розумне імʼя', () => {
  it('імена цієї пари лишаються тими самими', () => {
    // Інваріант ADR-0180: `users.name` — розвилка коду, і зняття унії не
    // має права зрушити її для цієї пари ні на символ.
    expect(asUserName('Діма')).toBe('Діма');
    expect(asUserName('Лєна')).toBe('Лєна');
  });

  it('чуже імʼя більше не зникає', () => {
    expect(asUserName('Олексій')).toBe('Олексій');
    expect(asUserName('Marie')).toBe('Marie');
    expect(asUserName('Анна-Марія')).toBe('Анна-Марія');
  });

  it('обрізає пробіли, а не приймає їх усередину порталу', () => {
    expect(asUserName('  Лєна  ')).toBe('Лєна');
  });

  it('відмовляє там, де імені немає', () => {
    expect(asUserName('')).toBeNull();
    expect(asUserName('   ')).toBeNull();
    expect(asUserName(null)).toBeNull();
    expect(asUserName(undefined)).toBeNull();
    expect(asUserName(42)).toBeNull();
  });

  it('тримає межу довжини, названу екраном', () => {
    const longest = 'я'.repeat(USER_NAME_MAX);
    expect(asUserName(longest)).toBe(longest);
    expect(asUserName(`${longest}я`)).toBeNull();
  });
});

describe('toAppUser не мовчить і не бреше', () => {
  it('віддає користувача з обрізаним іменем', () => {
    expect(toAppUser({ id: 7, name: ' Олексій ' })).toEqual({ id: 7, name: 'Олексій' });
  });

  it('порожній рядок — це не людина', () => {
    // Тут `null` правильний: рядок є, імені немає. Але саме через цей
    // `null` і зникала пара, тому вимога нижче — про ЩО САМЕ дає `null`.
    expect(toAppUser({ id: 7, name: '  ' })).toBeNull();
    expect(toAppUser(null)).toBeNull();
    expect(toAppUser(undefined)).toBeNull();
  });
});
