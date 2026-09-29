import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  INVITE_ALPHABET,
  INVITE_LENGTH,
  formatInviteCode,
  inviteCodeProblem,
  inviteExpiryText,
  normalizeInviteCode,
} from './inviteCode';

// ============================================================
// Код-запрошення партнера (ADR-0232). Код видає й перевіряє база; клієнт
// мусить приймати рівно те, що база видає, і нормалізувати так само.
// ============================================================

const MIGRATION = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260929200000_couple_invites.sql'),
  'utf8',
);

describe('клієнт і база говорять одним кодом', () => {
  it('алфавіт і довжина — ті самі, що в create_couple_invite', () => {
    expect(MIGRATION).toContain(`v_alphabet constant text := '${INVITE_ALPHABET}'`);
    expect(MIGRATION).toContain(`for k in 0..${INVITE_LENGTH - 1} loop`);
    expect(INVITE_ALPHABET).toHaveLength(31);
  });

  it('в алфавіті немає знаків, які плутають на слух і на око', () => {
    for (const ch of '01OIL') expect(INVITE_ALPHABET).not.toContain(ch);
  });

  it('нормалізація як у join_couple_with_invite: регістр, пробіли й дефіс не важать', () => {
    expect(MIGRATION).toContain("upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'))");
    expect(normalizeInviteCode(' abcd-efgh ')).toBe('ABCDEFGH');
    expect(normalizeInviteCode('AB CD\tEF—GH')).toBe('ABCDEFGH');
  });
});

describe('що людина бачить до запиту', () => {
  it('порожньо, не та довжина, чужий знак — підказка без запиту до бази', () => {
    expect(inviteCodeProblem('  ')).toBe('empty');
    expect(inviteCodeProblem('ABCD')).toBe('length');
    expect(inviteCodeProblem('ABCD-EFG0')).toBe('alphabet');
    expect(inviteCodeProblem('abcd-efgh')).toBeNull();
  });

  it('показ — дві четвірки; неповний код лишається як є', () => {
    expect(formatInviteCode('abcdefgh')).toBe('ABCD-EFGH');
    expect(formatInviteCode('abc')).toBe('ABC');
  });

  it('кінець дії — день у поясі пари, без року', () => {
    // 2026-10-05T22:30Z — у Києві вже 6 жовтня.
    expect(inviteExpiryText('2026-10-05T22:30:00Z', 'Europe/Kyiv')).toBe('до 6 жовтня');
    expect(inviteExpiryText('не дата', 'Europe/Kyiv')).toBe('');
  });
});
