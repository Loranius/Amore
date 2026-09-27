import { describe, expect, it } from 'vitest';
import {
  DECK_COMMIT_SHARE,
  DECK_FLICK_SPEED,
  deckMove,
  deckResist,
  deckStep,
} from './ideaDeckSwipe';

// ============================================================
// Свайп колоди «Що наступне?» (ADR-0213).
// ------------------------------------------------------------
// ВИМОГА ВЛАСНИКА: «свайп вверх — перехід на наступний план, свайп вниз —
// на попередній, каруселлю; прибери кнопку "далі"».
// ============================================================

const HEIGHT = 300;

describe('куди гортає свайп', () => {
  it('угору — наступний, униз — попередній', () => {
    expect(deckMove(-HEIGHT * 0.4, 0, HEIGHT, 5)).toBe('next');
    expect(deckMove(HEIGHT * 0.4, 0, HEIGHT, 5)).toBe('prev');
  });

  it('короткий повільний рух не гортає — картка повертається на місце', () => {
    expect(deckMove(-HEIGHT * DECK_COMMIT_SHARE * 0.5, -0.1, HEIGHT, 5)).toBe('stay');
  });

  it('короткий, але різкий свайп гортає', () => {
    expect(deckMove(-30, -DECK_FLICK_SPEED * 1.5, HEIGHT, 5)).toBe('next');
    expect(deckMove(30, DECK_FLICK_SPEED * 1.5, HEIGHT, 5)).toBe('prev');
  });

  it('кидок проти ходу пальця не гортає', () => {
    expect(deckMove(-30, DECK_FLICK_SPEED * 2, HEIGHT, 5)).toBe('stay');
  });

  it('одна картка не гортається нікуди', () => {
    expect(deckMove(-HEIGHT, -2, HEIGHT, 1)).toBe('stay');
  });

  it('биті числа не гортають', () => {
    expect(deckMove(Number.NaN, 0, HEIGHT, 5)).toBe('stay');
    expect(deckMove(-HEIGHT, Number.NaN, 0, 5)).toBe('next');
  });
});

describe('каруселлю: без кінця й початку', () => {
  it('з останнього вгору — на перший, з першого вниз — на останній', () => {
    expect(deckStep(4, 'next', 5)).toBe(0);
    expect(deckStep(0, 'prev', 5)).toBe(4);
    expect(deckStep(2, 'stay', 5)).toBe(2);
  });

  it('порожня колода не ділить на нуль', () => {
    expect(deckStep(3, 'next', 0)).toBe(0);
  });
});

describe('опір пальцю', () => {
  it('картка йде за пальцем, але не далі за межу — і знак зберігається', () => {
    expect(deckResist(10, HEIGHT)).toBeGreaterThan(8);
    expect(Math.abs(deckResist(-5000, HEIGHT))).toBeLessThan(HEIGHT * 0.6);
    expect(deckResist(-50, HEIGHT)).toBeLessThan(0);
    expect(deckResist(0, HEIGHT)).toBe(0);
  });
});
