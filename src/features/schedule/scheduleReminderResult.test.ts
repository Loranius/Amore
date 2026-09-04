import { describe, expect, it } from 'vitest';
import { parseScheduleReminderResult } from './useScheduleReminder';

/*
 * Контракт відповіді RPC нагадування (міграція
 * `20260904120000_quiet_notifications_on_days_off.sql`).
 *
 * Станів чотири, і четвертий — `recipient_off_duty` — з'явився разом із
 * тишею у вихідний. Він мусить проходити, а все незнайоме — ламатись:
 * якби невідоме значення тихо ставало успіхом, портал казав би
 * «нагадування надіслано» там, де база його не створила, і відправник
 * чекав би відповіді, якої не буде.
 */
describe('відповідь нагадування про графік', () => {
  it('пропускає всі чотири оголошені стани', () => {
    for (const value of ['sent', 'already_sent', 'already_complete', 'recipient_off_duty']) {
      expect(parseScheduleReminderResult(value)).toBe(value);
    }
  });

  it('ламається на незнайомому значенні, а не вдає успіх', () => {
    for (const value of ['ok', '', 'SENT', null, undefined, 0, 1, {}, ['sent']]) {
      expect(() => parseScheduleReminderResult(value)).toThrow(/invalid result/);
    }
  });
});
