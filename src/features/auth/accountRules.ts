// ============================================================
// Правила акаунта за поштою (ADR-0228) — чисті, без мережі.
// ------------------------------------------------------------
// Вимога власника: пароль лише латиницею й щонайменше з однією цифрою.
// «Лише латиницею» читається буквально: жодної кирилиці чи інших
// абеток, жодних пробілів — тільки друковані символи ASCII. Щоб пароль
// не був самою цифрою «1», стоять ще дві межі: довжина від 8 і хоча б
// одна латинська літера.
//
// Екран показує причини поштучно, поки людина друкує, а не після
// натискання кнопки: так правило видно, а не вгадується.
// ============================================================

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 64;

/** Код із листа: рівно шість цифр. */
export const CODE_RE = /^\d{6}$/;

export type PasswordProblem = 'length' | 'non_latin' | 'no_digit' | 'no_letter';

export const PASSWORD_PROBLEM_TEXT: Record<PasswordProblem, string> = {
  length: `від ${PASSWORD_MIN} до ${PASSWORD_MAX} символів`,
  non_latin: 'лише латинські літери, цифри й знаки — без кирилиці й пробілів',
  no_digit: 'хоча б одна цифра',
  no_letter: 'хоча б одна латинська літера',
};

/** Порядок — як на екрані: спершу те, що людина порушує найчастіше. */
export const PASSWORD_RULES: readonly PasswordProblem[] = ['non_latin', 'no_digit', 'no_letter', 'length'];

export function passwordProblems(password: string): PasswordProblem[] {
  const problems: PasswordProblem[] = [];
  if (!/^[\x21-\x7E]*$/.test(password)) problems.push('non_latin');
  if (!/[0-9]/.test(password)) problems.push('no_digit');
  if (!/[A-Za-z]/.test(password)) problems.push('no_letter');
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) problems.push('length');
  return problems;
}

export function normaliseEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Пошта «схожа на пошту»: щось@щось.щось, без пробілів. Остаточно її
 * перевіряє лист із кодом — сюди не варто тягнути RFC 5322.
 */
export function isEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normaliseEmail(raw));
}

export type SeatGender = 'male' | 'female';

export const GENDER_TEXT: Record<SeatGender, string> = { male: 'Чоловік', female: 'Жінка' };

/**
 * Місце за статтю. Місце без позначки (пару створено до ADR-0228 без
 * статі) підходить будь-якій відповіді — інакше його не можна було б
 * прив'язати взагалі. `null` — такого місця немає: портал уже має пару.
 */
export function seatForGender<T extends { id: number; gender: SeatGender | null }>(
  seats: readonly T[],
  gender: SeatGender,
): T | null {
  return seats.find((s) => s.gender === gender) ?? seats.find((s) => s.gender === null) ?? null;
}
