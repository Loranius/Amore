// ============================================================
// Новий план — одне поле й три перемикачі (ADR-0256).
// ============================================================
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { planDateInput } from './AddPlanModal';

const source = readFileSync(join(__dirname, 'AddPlanModal.tsx'), 'utf8');

describe('дата з форми', () => {
  it('без дати — задум', () => {
    expect(planDateInput('', '', false)).toEqual({ start_date: null, end_date: null, date_precision: 'none' });
  });

  it('один день — точний день, і кінець не пишеться', () => {
    expect(planDateInput('2026-11-07', '2026-11-10', false))
      .toEqual({ start_date: '2026-11-07', end_date: null, date_precision: 'day' });
  });

  it('кілька днів — період; кінець не раніше й не в той самий день', () => {
    expect(planDateInput('2026-11-07', '2026-11-10', true))
      .toEqual({ start_date: '2026-11-07', end_date: '2026-11-10', date_precision: 'range' });
    expect(planDateInput('2026-11-07', '2026-11-07', true).date_precision).toBe('day');
    expect(planDateInput('2026-11-07', '2026-11-01', true).date_precision).toBe('day');
    expect(planDateInput('2026-11-07', '', true).date_precision).toBe('day');
  });
});

describe('форма коротка', () => {
  it('заголовок без надпису над ним і без абзацу пояснення', () => {
    expect(source).toContain('>Новий план</h2>');
    expect(source).not.toContain('plan-create-eyebrow');
    expect(source).not.toContain('plan-create-accordion');
  });

  it('три перемикачі й головна дія за станом', () => {
    expect(source).toContain("category === 'other' ? 'Тип'");
    for (const label of ['Дата', 'Фото']) expect(source).toMatch(new RegExp(`\\n\\s*${label}\\n`));
    expect(source).toContain("dated ? 'Запланувати' : 'Зберегти задум'");
  });

  it('екрана успіху з другим вибором більше немає', () => {
    expect(source).not.toContain('plan-create-success');
    expect(source).not.toContain('Продовжити планування');
  });
});
