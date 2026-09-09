// ============================================================
// Результат RPC нагадування — ЧИСТА частина, без клієнта бази.
// ------------------------------------------------------------
// ЧОМУ ОКРЕМИЙ ФАЙЛ. Розбір відповіді жив у `useScheduleReminder.ts`, а
// той на першому ж рядку тягне `@/lib/supabase`, який КИДАЄ ВИНЯТОК ПРИ
// ІМПОРТІ, коли немає `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`. На
// машині розробника вони є в `.env.local`, у CI — немає, тож набір падав
// саме там і тільки там: `Failed Suites 1`, 2531 тест зелений, а конвеєр
// червоний (ADR-0172).
//
// Чиста функція не має жодних причин залежати від мережі. Тепер її можна
// перевірити тим самим тестом, але без клієнта — і CI бачить те саме, що
// й розробник.
// ============================================================

export type ScheduleReminderResult =
  | 'sent'
  | 'already_sent'
  | 'already_complete';

const RESULTS: readonly ScheduleReminderResult[] = [
  'sent', 'already_sent', 'already_complete',
];

/**
 * Відповідь RPC → результат, або виняток.
 *
 * Список станів може змінитись разом із базою (стан `recipient_off_duty`
 * тут був і пішов разом із «тишею у вихідний»), і незнайоме значення
 * мусить ЛАМАТИСЬ, а не проходити мовчки. Мовчазне проходження коштувало
 * б рівно того, заради чого перевірка й існує: портал сказав би
 * «нагадування надіслано» там, де база його не створила.
 */
export function parseScheduleReminderResult(data: unknown): ScheduleReminderResult {
  if (RESULTS.includes(data as ScheduleReminderResult)) return data as ScheduleReminderResult;
  throw new Error('Schedule reminder RPC returned an invalid result');
}
