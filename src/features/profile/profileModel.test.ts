import { describe, expect, it } from 'vitest';
import {
  DISPLAY_NAME_MAX,
  birthdayEventTitle,
  birthdayProblem,
  displayNameProblem,
  parseProfile,
  personInitial,
  profileSettingKey,
  serialiseProfile,
  toPerson,
} from './profileModel';
import { asUserName } from '@/lib/guards';
import type { AppUser } from '@/types';

/*
 * ВИМОГА (ADR-0180): профіль людини — підпис, фото й дата народження —
 * живе у ТРЬОХ місцях, і жодне з них не вибране на зручність:
 *
 *   • підпис і фото → `settings`, рядок `profile:<id>`;
 *   • дата народження → подія `type:'birthday'` з `person_user_id`;
 *   • ім'я-КЛЮЧ у `users` лишається недоторканим, бо за ним розходяться
 *     стовпці графіка, жіноча група в «Замірах» і вибірка джерел
 *     кристала.
 *
 * Тут перевіряється саме та частина, яку можна перевірити без бази:
 * розбір, запис, злиття й межі того, що портал погодиться показати.
 */

describe('ключ у settings', () => {
  it('один рядок на людину, з префіксом, за яким його знаходить `.like`', () => {
    // `useProfiles()` шукає всі профілі запитом `.like('key','profile:%')`.
    // Якби ключ не мав префікса, запит забрав би пів таблиці.
    expect(profileSettingKey(1)).toBe('profile:1');
    expect(profileSettingKey(42)).toBe('profile:42');
  });
});

describe('розбір значення з бази', () => {
  /*
   * Значення пише портал, але прочитати його можна й з бази, куди міг
   * залізти хто завгодно. Зіпсований рядок мусить дати ПОРОЖНІЙ профіль,
   * а не впасти: екран налаштувань — єдине місце, де це можна полагодити.
   */
  it('читає обидва поля', () => {
    expect(parseProfile('{"displayName":"Дімасік","photoUrl":"https://x/y.jpg"}')).toEqual({
      displayName: 'Дімасік',
      photoUrl: 'https://x/y.jpg',
    });
  });

  it('сміття дає порожній профіль, а не виняток', () => {
    for (const raw of ['', '   ', 'не json', '[]', 'null', '123', undefined, null, 42, {}]) {
      expect(parseProfile(raw)).toEqual({});
    }
  });

  it('поля не того типу просто не беруться', () => {
    expect(parseProfile('{"displayName":7,"photoUrl":{"a":1}}')).toEqual({});
    // Порожній рядок — це «не задано», а не підпис завдовжки нуль.
    expect(parseProfile('{"displayName":"   "}')).toEqual({});
  });

  it('обрізає пробіли по краях', () => {
    expect(parseProfile('{"displayName":"  Лєна  "}')).toEqual({ displayName: 'Лєна' });
  });
});

describe('запис', () => {
  it('порожні поля не потрапляють у рядок', () => {
    // Інакше в базі лежало б `{"photoUrl":""}`, і `parseProfile` мусив би
    // вдруге вирішувати те, що вже вирішено тут.
    expect(serialiseProfile({ displayName: '  Діма  ', photoUrl: '' })).toBe('{"displayName":"Діма"}');
    expect(serialiseProfile({})).toBe('{}');
  });

  it('туди й назад без втрат', () => {
    const profile = { displayName: 'Лєнусік', photoUrl: 'https://x/1.webp' };
    expect(parseProfile(serialiseProfile(profile))).toEqual(profile);
  });
});

describe('межі підпису', () => {
  it('порожнє ім’я не приймається — портал ним звертається', () => {
    expect(displayNameProblem('')).not.toBeNull();
    expect(displayNameProblem('   ')).not.toBeNull();
  });

  it(`довше за ${DISPLAY_NAME_MAX} символів не приймається`, () => {
    /*
     * Не примха: підпис стоїть у чипах, вкладках графіка й доці, і всі
     * вони однорядкові. На межі — приймаємо, за межею — ні.
     */
    expect(displayNameProblem('я'.repeat(DISPLAY_NAME_MAX))).toBeNull();
    const tooLong = displayNameProblem('я'.repeat(DISPLAY_NAME_MAX + 1));
    expect(tooLong).not.toBeNull();
    // Помилка називає ЧИСЛА, бо інакше єдиний вихід — стирати навмання.
    expect(tooLong).toContain(String(DISPLAY_NAME_MAX + 1));
  });

  it('звичайне ім’я проходить', () => {
    expect(displayNameProblem('Дімасік-найкращий')).toBeNull();
    expect(displayNameProblem('  Лєна  ')).toBeNull();
  });
});

describe('межі дати народження', () => {
  const today = new Date('2026-09-14T00:00:00Z');

  it('порожнє — це «ще не записали», а не помилка', () => {
    // Порожнє поле — валідний стан: воно прибирає подію з календаря.
    expect(birthdayProblem('', today)).toBeNull();
  });

  it('приймає РРРР-ММ-ДД', () => {
    expect(birthdayProblem('1995-03-07', today)).toBeNull();
  });

  it('не приймає майбутнє', () => {
    // Подія «день народження» щорічна; дата з майбутнього дала б
    // щорічну подію, якої ще не було жодного разу.
    expect(birthdayProblem('2026-09-15', today)).not.toBeNull();
    expect(birthdayProblem('2026-09-14', today)).toBeNull(); // сьогодні — можна
  });

  it('не приймає інший формат і неіснуючу дату', () => {
    // Повідомлення веде до КАЛЕНДАРЯ, а не вчить синтаксису: поле рідне,
    // воно малює дату мовою телефона, і «введи РРРР-ММ-ДД» суперечило б
    // тому, що людина бачить на екрані.
    expect(birthdayProblem('07.03.1995', today)).toContain('календар');
    expect(birthdayProblem('07.03.1995', today)).not.toBeNull();
    expect(birthdayProblem('1995-13-07', today)).not.toBeNull();
  });

  it('раніше за 1900 — радше одруківка', () => {
    expect(birthdayProblem('1899-12-31', today)).not.toBeNull();
    expect(birthdayProblem('1900-01-01', today)).toBeNull();
  });
});

describe('назва події дня народження', () => {
  it('складається з ПІДПИСУ, а не з ключа', () => {
    /*
     * У календарі має стояти те саме ім'я, яким портал звертається до
     * людини скрізь. Інакше перейменування видно всюди, крім однієї
     * події, — і саме там воно найпомітніше.
     */
    expect(birthdayEventTitle('Дімасік')).toBe('День народження — Дімасік');
  });
});

describe('злиття ключа, профілю й дати', () => {
  /*
   * Ім'я будується `asUserName`, а не літералом: після зняття унії
   * `'Діма' | 'Лєна'` (ADR-0209) `UserName` — брендований рядок, тобто
   * значення, яке ПРОЙШЛО межу з базою. Літерал тут скомпілювався б лише
   * через каст, а каст у тесті приховав би саму межу, яку тест і описує.
   */
  const user: AppUser = { id: 1, name: asUserName('Діма')! };

  it('без профілю підпис падає на ім’я-ключ', () => {
    // Портал ніколи не показує порожнього імені: доки профілю немає (або
    // RLS його не віддала), людину звати так, як у `users`.
    const person = toPerson(user, undefined, null);
    expect(person.displayName).toBe('Діма');
    expect(person.photoUrl).toBeNull();
    expect(person.birthday).toBeNull();
  });

  it('ключ лишається ключем навіть після перейменування', () => {
    /*
     * ЦЕ ГОЛОВНИЙ ІНВАРІАНТ ADR-0180. `users.name` — розвилка коду
     * (жіноча група в «Замірах», вибірка джерел кристала), і підпис не
     * має права її зрушити.
     */
    const person = toPerson(user, { displayName: 'Дімасік' }, '1995-03-07');
    expect(person.name).toBe('Діма');
    expect(person.displayName).toBe('Дімасік');
    expect(person.birthday).toBe('1995-03-07');
  });
});

describe('ініціал у кружечку', () => {
  it('одна літера, у верхньому регістрі', () => {
    // Одна, а не дві: імена тут короткі й особисті, і «ДМ» читалось би
    // як абревіатура установи.
    expect(personInitial('дімасік')).toBe('Д');
    expect(personInitial('  Лєна ')).toBe('Л');
  });

  it('порожнє ім’я не валить рендер', () => {
    expect(personInitial('')).toBe('?');
  });
});
