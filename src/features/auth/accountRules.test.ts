import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CODE_RE, isEmail, passwordProblems } from './accountRules';

// ============================================================
// Правила акаунта за поштою (ADR-0228). Вимога власника дослівно:
// «Пароль має містити лише латинську (англійську) мову і від однієї
// цифри»; код підтвердження — шість цифр.
// ============================================================

describe('пароль', () => {
  it('латиниця з цифрою проходить', () => {
    expect(passwordProblems('amore2022')).toEqual([]);
    expect(passwordProblems('Tiflis!9x')).toEqual([]);
  });

  it('кирилиця заборонена — навіть одна літера', () => {
    expect(passwordProblems('amore2022ї')).toContain('non_latin');
    expect(passwordProblems('кохання2022')).toContain('non_latin');
  });

  it('пробіл і невидимі символи — теж не латиниця', () => {
    expect(passwordProblems('amore 2022')).toContain('non_latin');
    expect(passwordProblems('amore 2022')).toContain('non_latin');
  });

  it('без цифри не проходить', () => {
    expect(passwordProblems('amoreamore')).toEqual(['no_digit']);
  });

  it('сама цифра — не пароль: потрібна хоча б одна латинська літера й 8 символів', () => {
    expect(passwordProblems('1')).toEqual(['no_letter', 'length']);
    expect(passwordProblems('12345678')).toEqual(['no_letter']);
    expect(passwordProblems('a1')).toEqual(['length']);
  });
});

describe('пошта й код', () => {
  it('пошта — щось@щось.щось без пробілів', () => {
    expect(isEmail(' Lena@Example.com ')).toBe(true);
    expect(isEmail('lena@example')).toBe(false);
    expect(isEmail('le na@example.com')).toBe(false);
  });

  it('код — рівно шість цифр', () => {
    expect(CODE_RE.test('042917')).toBe(true);
    expect(CODE_RE.test('42917')).toBe(false);
    expect(CODE_RE.test('04291a')).toBe(false);
  });
});

describe('сервер тримає ті самі межі, що й екран', () => {
  const fn = readFileSync(join(__dirname, '../../../supabase/functions/portal-account/index.ts'), 'utf8');

  it('прив\'язує лише службові місця й лише старим PIN місця', () => {
    expect(fn).toContain('const SEAT_DOMAIN = "@portal.app"');
    expect(fn).toContain('register_pin_attempt');
    expect(fn).toContain('const PIN_RE = /^\\d{8}$/');
  });

  it('хто кличе — з токена, а не з тіла запиту', () => {
    expect(fn).toContain('admin.auth.getUser(token)');
    expect(fn).toContain('email_confirmed_at');
  });

  it('старий акаунт місця блокується, а не видаляється', () => {
    expect(fn).toContain('ban_duration');
    expect(fn).not.toContain('deleteUser');
  });
});
