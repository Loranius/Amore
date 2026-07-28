// ============================================================
// Заготовки свят.
// ------------------------------------------------------------
// Два інваріанти:
//   • щойно додане свято дивиться ВПЕРЕД. Підставити поточний рік
//     наосліп означало б, що додане в серпні Різдво лягає нормально, а
//     доданий у серпні Новий рік одразу опиняється в минулому з
//     «−230 днів»;
//   • двічі той самий день не пропонується. Звірка йде за днем і
//     місяцем, бо власник міг назвати свято своїми словами.
// ============================================================
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HOLIDAY_PRESETS, missingPresets, presetDate } from './holidayPresets';
import type { EventRow } from '@/types';

/** Вівторок, 28 липня 2026, 09:00 за Києвом. */
const NOW = new Date('2026-07-28T09:00:00+03:00');
const originalTZ = process.env.TZ;

beforeEach(() => {
  process.env.TZ = 'Europe/Kyiv';
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
  process.env.TZ = originalTZ;
});

const event = (date: string): EventRow => ({
  id: 1, title: 'Подія', description: null, date, created_by: 1,
  type: 'holiday', yearly: true, metadata: null, is_milestone: false,
} as EventRow);

describe('presetDate', () => {
  it('свято, що цього року вже минуло, іде на наступний рік', () => {
    expect(presetDate('03-08')).toBe('2027-03-08');
    expect(presetDate('01-01')).toBe('2027-01-01');
  });

  it('свято, що ще попереду, лишається в цьому році', () => {
    expect(presetDate('08-24')).toBe('2026-08-24');
    expect(presetDate('12-25')).toBe('2026-12-25');
  });

  it('сьогоднішнє свято — це сьогодні, а не наступний рік', () => {
    // 28 липня — День Української Державності, і сьогодні саме воно.
    expect(presetDate('07-28')).toBe('2026-07-28');
  });

  it('усі заготовки дають дату в майбутньому або сьогодні', () => {
    const today = '2026-07-28';
    for (const p of HOLIDAY_PRESETS) {
      expect(presetDate(p.md) >= today).toBe(true);
    }
  });
});

describe('missingPresets', () => {
  it('порожній календар — пропонуються всі', () => {
    expect(missingPresets([])).toHaveLength(HOLIDAY_PRESETS.length);
  });

  it('зайнятий день не пропонується вдруге', () => {
    const left = missingPresets([event('2020-08-24')]);
    expect(left.some((p) => p.md === '08-24')).toBe(false);
    expect(left).toHaveLength(HOLIDAY_PRESETS.length - 1);
  });

  it('звірка за днем і місяцем, а не за роком чи назвою', () => {
    // Власник міг завести своє «Незалежність» будь-яким роком і словами.
    expect(missingPresets([event('1999-08-24')]).some((p) => p.md === '08-24')).toBe(false);
  });

  it('сусідній день нічого не займає', () => {
    expect(missingPresets([event('2026-08-25')]).some((p) => p.md === '08-24')).toBe(true);
  });

  it('несправна дата в базі не валить добірку', () => {
    expect(missingPresets([event('не дата')])).toHaveLength(HOLIDAY_PRESETS.length);
  });
});

describe('HOLIDAY_PRESETS', () => {
  it('усі дати у форматі MM-DD і календарно можливі', () => {
    for (const p of HOLIDAY_PRESETS) {
      expect(p.md).toMatch(/^\d{2}-\d{2}$/);
      const [m, d] = p.md.split('-').map(Number);
      expect(m).toBeGreaterThanOrEqual(1);
      expect(m).toBeLessThanOrEqual(12);
      expect(d).toBeGreaterThanOrEqual(1);
      expect(d).toBeLessThanOrEqual(31);
    }
  });

  it('жодного дубля по даті', () => {
    const days = HOLIDAY_PRESETS.map((p) => p.md);
    expect(new Set(days).size).toBe(days.length);
  });

  it('немає 29 лютого — рухомі й високосні дати сюди не потрапляють', () => {
    // Заготовка мусить існувати щороку; рухомі свята (Великдень, День
    // матері) свідомо не входять у список.
    expect(HOLIDAY_PRESETS.some((p) => p.md === '02-29')).toBe(false);
  });
});
