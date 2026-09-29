// ============================================================
// Код-запрошення партнера (ADR-0232) — правила, спільні для екрана
// входу й налаштувань. Справжня перевірка — у базі
// (`join_couple_with_invite`); тут лише те, що людина бачить до запиту.
// ============================================================

/**
 * Алфавіт коду — той самий, що в `create_couple_invite`: без 0/O, 1/I/L,
 * щоб код, продиктований уголос чи переписаний з екрана, не мав двозначних
 * знаків.
 */
export const INVITE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const INVITE_LENGTH = 8;

/**
 * Те, що людина вставила, → код. Регістр, пробіли й дефіс не мають
 * значення: база нормалізує так само, а людина може вставити і
 * «abcd-efgh», і «ABCD EFGH».
 */
export function normalizeInviteCode(raw: string): string {
  return raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

export type InviteCodeProblem = 'empty' | 'length' | 'alphabet';

export function inviteCodeProblem(raw: string): InviteCodeProblem | null {
  const code = normalizeInviteCode(raw);
  if (code.length === 0) return 'empty';
  if (code.length !== INVITE_LENGTH) return 'length';
  for (const ch of code) if (!INVITE_ALPHABET.includes(ch)) return 'alphabet';
  return null;
}

/** Що сказати людині про кожну проблему — спільне для обох екранів, де вводять код. */
export const INVITE_PROBLEM_TEXT: Readonly<Record<InviteCodeProblem, string>> = {
  empty: 'Введи код, який дав партнер.',
  length: `У коді ${INVITE_LENGTH} знаків — перевір, чи все переписано.`,
  alphabet: 'У коді немає нулів, одиниць і літер O, I, L — мабуть, там схожа літера чи цифра.',
};

/** Для показу: дві четвірки, як читають уголос. */
export function formatInviteCode(code: string): string {
  const clean = normalizeInviteCode(code);
  return clean.length === INVITE_LENGTH ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;
}

/**
 * «до 6 жовтня» — дата кінця дії в часовому поясі пари. Без року: код
 * живе тиждень.
 */
export function inviteExpiryText(expiresAt: string, timeZone: string): string {
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return '';
  return `до ${new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long', timeZone }).format(date)}`;
}
