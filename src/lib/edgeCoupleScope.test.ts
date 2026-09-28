import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// ============================================================
// Edge-функції працюють із правами сервера й бачать УСІ пари (ADR-0229).
// Кожна, що пише в Telegram чи читає дані пари, мусить звужуватись до
// пари запису або того, хто пише. До ADR-0229 усі три брали всіх
// користувачів порталу: з другою парою сповіщення, нагадування й списки
// однієї пари йшли б людям з іншої. Ці тести стережуть джерело, бо
// Deno-функції не запускаються у vitest.
// ============================================================

const fn = (name: string) =>
  readFileSync(join(__dirname, `../../supabase/functions/${name}/index.ts`), 'utf8');

describe('db-notify: сповіщення лише своїй парі', () => {
  const src = fn('db-notify');

  it('жодного вибору всіх користувачів порталу', () => {
    expect(src).not.toMatch(/getAllUsers\(/);
    expect(src).toContain('async function coupleUsers(coupleId');
  });

  it('вільний ліміт — рядок пари, а не рядок id = 1', () => {
    expect(src).not.toContain('eq("id", 1)');
    expect(src).toContain('.eq("couple_id", chatCouple)');
  });

  it('запис без пари нікому не розсилається', () => {
    expect(src).toContain('skipped: "no_couple"');
  });

  it('прямий виклик wish_fulfilled — лише з пари власника бажання', () => {
    expect(src).toContain('callerCouple !== await coupleOfUser(payload.ownerId)');
  });

  it('тексти не вшиті під конкретну пару', () => {
    expect(src).not.toContain('Дімусік');
    expect(src).not.toContain('Лєнусік');
  });
});

describe('event-reminders: нагадування учасникам пари події', () => {
  const src = fn('event-reminders');
  it('отримувачі — за парою події й плану', () => {
    expect(src).toContain('recipientsOf(ev.couple_id)');
    expect(src).toContain('recipientsOf((plan as any).couple_id)');
  });
});

describe('tg-commands: команди в межах пари того, хто пише', () => {
  const src = fn('tg-commands');
  it('партнер — з тієї ж пари, а не «будь-хто, окрім себе»', () => {
    expect(src).not.toContain('.neq("id", userId).limit(1)');
    expect(src).toContain('coupleUserIds(me.couple_id)');
  });
  it('покупки, страви й графік — лише своєї пари', () => {
    expect(src.match(/\.eq\("couple_id", coupleId\)/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  });
  it('стать для розмірів — з рядка, а не з імені', () => {
    expect(src).not.toContain('target.name === "Лєна"');
  });
});
