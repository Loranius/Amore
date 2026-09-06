import { describe, expect, it } from 'vitest';
import { parseScheduleReminderResult } from './useScheduleReminder';

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
