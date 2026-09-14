// ============================================================
// Профіль людини — як її звати, як вона виглядає, коли народилась.
// ------------------------------------------------------------
// ДЕ ЦЕ ЖИВЕ Й ЧОМУ САМЕ ТАМ. Три речі — три різні місця, і жодне з них
// не вибране на зручність:
//
//   • ІМ'Я ТА ФОТО → `settings`, ключ `profile:<id>`, значення JSON.
//     Таблиця `users` для клієнта відкрита ТІЛЬКИ НА ЧИТАННЯ і тільки в
//     двох колонках: `grant select (id, name)` (`migrations.sql`). Тобто
//     переписати `users.name` із порталу неможливо за побудовою — і це
//     навмисна межа безпеки, а не недогляд.
//
//   • ДЕНЬ НАРОДЖЕННЯ → `events`, рядок `type: 'birthday'`, `yearly`,
//     `person_user_id`. Не копія в профілі: у порталі вже є одне місце,
//     де живуть дати, і календар із «Планами» показують його самі. Два
//     джерела однієї дати розійшлися б того дня, коли хтось поправить
//     одне.
//
// ЧОМУ ІМ'Я ДЛЯ ПОКАЗУ ОКРЕМЕ ВІД ІМЕНІ-КЛЮЧА. `users.name` — це не
// підпис, а ІДЕНТИЧНІСТЬ: за ним розходяться стовпці графіка, жіноча
// група в «Замірах» і вибірка джерел кристала. Перейменувати ключ
// означало б переписати кожну таку розвилку. Тому портал ЗВЕРТАЄТЬСЯ
// іменем із профілю, а РОЗРІЗНЯЄ людей ключем — і одне не заважає
// другому.
// ============================================================
import type { AppUser, UserName } from '@/types';

/** Профіль, як він лежить у `settings`. Обидва поля необов'язкові. */
export interface UserProfile {
  /** Як портал звертається до людини. Порожнє — беремо ім'я-ключ. */
  displayName?: string;
  /** Публічне посилання на фото в Storage. */
  photoUrl?: string;
}

/** Людина так, як її бачить екран: ключ, підпис, фото, дата народження. */
export interface Person extends AppUser {
  /** Ім'я для показу. Ніколи не порожнє: падає назад на ім'я-ключ. */
  displayName: string;
  photoUrl: string | null;
  /** 'YYYY-MM-DD' або `null`, якщо дата ще не записана. */
  birthday: string | null;
}

/** Ключ у таблиці `settings`. Один рядок на людину. */
export function profileSettingKey(userId: number): string {
  return `profile:${userId}`;
}

/**
 * Розбір значення з `settings`.
 *
 * Значення там — рядок, який писав портал, але прочитати його можна й з
 * бази, куди міг залізти хто завгодно. Тому тут не `JSON.parse as
 * UserProfile`, а перевірка кожного поля: зіпсований рядок дає порожній
 * профіль, а не падіння екрана налаштувань.
 */
export function parseProfile(raw: unknown): UserProfile {
  if (typeof raw !== 'string' || raw.trim() === '') return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    const record = parsed as Record<string, unknown>;
    const profile: UserProfile = {};
    if (typeof record['displayName'] === 'string' && record['displayName'].trim() !== '') {
      profile.displayName = record['displayName'].trim();
    }
    if (typeof record['photoUrl'] === 'string' && record['photoUrl'].trim() !== '') {
      profile.photoUrl = record['photoUrl'].trim();
    }
    return profile;
  } catch {
    return {};
  }
}

/** Профіль у рядок для `settings`. */
export function serialiseProfile(profile: UserProfile): string {
  const clean: UserProfile = {};
  const name = profile.displayName?.trim();
  const photo = profile.photoUrl?.trim();
  if (name) clean.displayName = name;
  if (photo) clean.photoUrl = photo;
  return JSON.stringify(clean);
}

/**
 * Найдовше ім'я, яке портал погодиться показати.
 *
 * Не примха: підпис стоїть у чипах, вкладках графіка й доці, і всі вони
 * однорядкові. Двадцять чотири — це довжина, за якої «Дімасік-найкращий»
 * ще вміщається в чип на 412 px, а речення замість імені вже ні.
 */
export const DISPLAY_NAME_MAX = 24;

/** Що не так із введеним іменем, словами пари. Або `null`, якщо все гаразд. */
export function displayNameProblem(value: string): string | null {
  const name = value.trim();
  if (name === '') return 'Ім’я не може бути порожнім — портал ним звертається.';
  if (name.length > DISPLAY_NAME_MAX) {
    return `Задовге для чипа й вкладки: ${name.length} символів із ${DISPLAY_NAME_MAX}.`;
  }
  return null;
}

/** Що не так із датою народження. Або `null`. */
export function birthdayProblem(value: string, today = new Date()): string | null {
  if (value === '') return null; // Порожнє — це «ще не записали», а не помилка.
  /*
   * Формат тут НЕ ПОЯСНЮЄТЬСЯ парі, і це навмисно: поле — рідне
   * `<input type="date">`, воно малює дату в мові телефона (на знімку з
   * пісочниці — `01/23/2003`), а `value` завжди віддає ISO. Підказка
   * «введи РРРР-ММ-ДД» суперечила б тому, що людина бачить на екрані.
   * Перевірка лишається — бо в поле може приїхати значення з бази, — але
   * говорить про наслідок, а не про синтаксис.
   */
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Дату не вдалось прочитати — обери її в календарі.';
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return 'Такої дати немає в календарі.';
  if (date.getTime() > today.getTime()) return 'Дата народження в майбутньому.';
  if (date.getUTCFullYear() < 1900) return 'Раніше за 1900 рік — це радше одруківка.';
  return null;
}

/**
 * Назва події дня народження.
 *
 * Складається з підпису, а не з ключа: у календарі має стояти те саме
 * ім'я, яким портал звертається до людини скрізь.
 */
export function birthdayEventTitle(displayName: string): string {
  return `День народження — ${displayName}`;
}

/** Людина зі злиття ключа, профілю й дати з подій. */
export function toPerson(
  user: AppUser,
  profile: UserProfile | undefined,
  birthday: string | null,
): Person {
  return {
    id: user.id,
    name: user.name,
    displayName: profile?.displayName ?? user.name,
    photoUrl: profile?.photoUrl ?? null,
    birthday,
  };
}

/**
 * Ініціали для кружечка, поки фото немає.
 *
 * Одна літера, а не дві: імена тут короткі й особисті, і «ДМ» замість
 * «Д» читалось би як абревіатура установи.
 */
export function personInitial(displayName: string): string {
  return (displayName.trim()[0] ?? '?').toUpperCase();
}

/** Ім'я-ключ лишається тим, чим було: розвилки коду дивляться сюди. */
export type PersonKey = UserName;
