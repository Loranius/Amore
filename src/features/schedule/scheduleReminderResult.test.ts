import { describe, expect, it } from 'vitest';
/*
 * ІМПОРТ ІЗ ЧИСТОГО МОДУЛЯ, а не з гака (ADR-0172). Гак на першому рядку
 * тягне `@/lib/supabase`, який кидає виняток при імпорті, коли немає
 * ключів. На машині розробника вони є в `.env.local`, у CI — немає, тож
 * цей файл падав саме там і тільки там: 2531 тест зелений, конвеєр
 * червоний, а локальний прогін нічого не показував.
 */
import { parseScheduleReminderResult } from './scheduleReminderResult';

/*
 * Контракт відповіді RPC нагадування (міграція
 * `20260906190000_drop_quiet_notifications_on_days_off.sql` повернула її
 * до редакції `20260727123000_schedule_fill_reminders.sql`).
 *
 * Станів три. Четвертий, `recipient_off_duty`, жив тут разом із «тишею у
 * вихідний» і пішов разом із нею — і тепер мусить ЛАМАТИСЬ, як усе
 * незнайоме: якби невідоме значення тихо ставало успіхом, портал казав би
 * «нагадування надіслано» там, де база його не створила, і відправник
 * чекав би відповіді, якої не буде.
 */
describe('відповідь нагадування про графік', () => {
  it('пропускає всі три оголошені стани', () => {
    for (const value of ['sent', 'already_sent', 'already_complete']) {
      expect(parseScheduleReminderResult(value)).toBe(value);
    }
  });

  it('ламається на незнайомому значенні, а не вдає успіх', () => {
    for (const value of [
      'ok', '', 'SENT', 'recipient_off_duty', null, undefined, 0, 1, {}, ['sent'],
    ]) {
      expect(() => parseScheduleReminderResult(value)).toThrow(/invalid result/);
    }
  });
});
