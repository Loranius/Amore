import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// ============================================================
// Регресія (власник, 2026-10-04): панель дня графіка ховалась під доком.
// Усередині сторінки її `z-index: 220` не виходив за шар вмісту, і док
// (`z-index: 50`) перекривав нижню частину аркуша. Панель мусить жити в
// `document.body` і стояти вище за док.
// ============================================================

const source = readFileSync(fileURLToPath(new URL('./ScheduleDayDetails.tsx', import.meta.url)), 'utf8');
const css = readFileSync(fileURLToPath(new URL('./schedule.css', import.meta.url)), 'utf8');

describe('панель дня графіка над доком', () => {
  it('рендериться порталом у document.body', () => {
    expect(source).toMatch(/createPortal\(/);
    expect(source).toMatch(/document\.body/);
  });

  it('шар затемнення вищий за док (50)', () => {
    const rule = css.slice(css.indexOf('.sched-day-overlay {'), css.indexOf('}', css.indexOf('.sched-day-overlay {')));
    expect(Number(/z-index:\s*(\d+)/.exec(rule)?.[1])).toBeGreaterThan(50);
  });
});
