import { describe, expect, it } from 'vitest';
import { capped, threadBetween, VISIBLE_TASKS, type MapRect } from './planMapLayout';

const FRAME: MapRect = { left: 0, top: 0, width: 384, height: 739 };

const rect = (left: number, top: number, width: number, height: number): MapRect =>
  ({ left, top, width, height });

describe('capped', () => {
  it('віддає перші N і рахує решту', () => {
    const { shown, hidden } = capped(['a', 'b', 'c', 'd', 'e'], VISIBLE_TASKS);
    expect(shown).toEqual(['a', 'b', 'c', 'd']);
    expect(hidden).toBe(1);
  });

  it('нічого не ховає, коли список коротший за стелю', () => {
    expect(capped(['a'], VISIBLE_TASKS)).toEqual({ shown: ['a'], hidden: 0 });
  });

  it('не чіпає вхідний масив', () => {
    const source = ['a', 'b', 'c', 'd', 'e', 'f'];
    capped(source, 2);
    expect(source).toHaveLength(6);
  });
});

describe('threadBetween', () => {
  it('між рядами йде від низу верхнього блока до верху нижнього', () => {
    const upper = rect(0, 0, 200, 100);
    const lower = rect(20, 160, 200, 100);
    const thread = threadBetween(upper, lower, FRAME)!;

    expect(thread.from).toEqual({ x: 100, y: 100 });
    expect(thread.to).toEqual({ x: 120, y: 160 });
    expect(thread.d.startsWith('M 100 100 C')).toBe(true);
  });

  it('порядок аргументів не змінює нитку', () => {
    const upper = rect(0, 0, 200, 100);
    const lower = rect(20, 160, 200, 100);
    expect(threadBetween(lower, upper, FRAME)).toEqual(threadBetween(upper, lower, FRAME));
  });

  it('у сусідів по ряду нитка йде вбік, від краю до краю', () => {
    const left = rect(0, 40, 180, 120);
    const right = rect(220, 60, 160, 120);
    const thread = threadBetween(left, right, FRAME)!;

    expect(thread.from.x).toBe(180);
    expect(thread.to.x).toBe(220);
    // Виходить нижче середини лівого блока, входить вище середини правого:
    // нитка йде за поглядом, а не строго горизонтально.
    expect(thread.from.y).toBeGreaterThan(left.top + left.height / 2);
    expect(thread.to.y).toBeLessThan(right.top + right.height / 2);
  });

  it('тісні сусіди не з’єднуються — там крива стає закарлючкою', () => {
    const left = rect(0, 40, 186, 120);
    const right = rect(197, 60, 187, 120);
    expect(right.left - (left.left + left.width)).toBe(11);
    expect(threadBetween(left, right, FRAME)).toBeNull();
  });

  it('координати рахуються від полотна карти, а не від екрана', () => {
    const frame = rect(14, 58, 384, 739);
    const upper = rect(14, 58, 200, 100);
    const lower = rect(14, 220, 200, 100);
    const thread = threadBetween(upper, lower, frame)!;

    expect(thread.from).toEqual({ x: 100, y: 100 });
    expect(thread.to).toEqual({ x: 100, y: 162 });
  });

  it('нічого не малює, доки блоки не розкладені', () => {
    expect(threadBetween(rect(0, 0, 0, 0), rect(0, 0, 200, 100), FRAME)).toBeNull();
  });
});
