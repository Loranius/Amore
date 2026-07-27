// ============================================================
// Інваріант інерції бульбашок: рух не залежить від частоти кадрів.
// ------------------------------------------------------------
// Вимога походить від скарги власника, що бульбашка «не котиться».
// Найпростіша реалізація — множити швидкість на константу щокадру —
// прив'язує фізику до частоти оновлення екрана: на 120 Гц кидок гасне
// вдвічі швидше, ніж на 60. Телефон власника може віддавати і 60, і 120
// залежно від режиму енергозбереження, тож це не теоретичний випадок.
//
// Перевіряємо саме композицію: два півкроки мусять дати рівно те саме,
// що один цілий. Це властивість, яку наївна реалізація порушує.
// ============================================================
import { describe, expect, it } from 'vitest';
import { bubbleFollow, bubbleFriction } from './WishlistBubblePhysics';

describe('bubble inertia is frame-rate independent', () => {
  it('composes friction over split frames', () => {
    for (const delta of [0.5, 1, 1.5, 2.2]) {
      const whole = bubbleFriction(delta);
      const halves = bubbleFriction(delta / 2) * bubbleFriction(delta / 2);
      expect(halves).toBeCloseTo(whole, 12);
    }
  });

  it('composes drag follow over split frames', () => {
    for (const delta of [0.5, 1, 1.5, 2.2]) {
      const remainingWhole = 1 - bubbleFollow(delta);
      const half = 1 - bubbleFollow(delta / 2);
      expect(half * half).toBeCloseTo(remainingWhole, 12);
    }
  });

  it('slows down, never speeds up', () => {
    expect(bubbleFriction(1)).toBeGreaterThan(0);
    expect(bubbleFriction(1)).toBeLessThan(1);
    expect(bubbleFriction(2)).toBeLessThan(bubbleFriction(1));
  });

  it('rolls markedly longer than the previous 0.955 per frame', () => {
    // Пройдений шлях після кидка = v0 · Σ fⁿ = v0 / (1 − f).
    const glide = (f: number) => 1 / (1 - f);
    const previous = glide(0.955);
    const current = glide(bubbleFriction(1));
    expect(current).toBeGreaterThan(previous * 1.7);
    // І не перетворюється на більярд: верхня межа теж записана.
    expect(current).toBeLessThan(previous * 2.6);
  });

  it('pins the bubble to the finger when motion is reduced', () => {
    expect(bubbleFollow(1, true)).toBe(1);
    expect(bubbleFollow(0.4, true)).toBe(1);
  });

  it('lags behind the finger by a visible amount at 60 Hz', () => {
    const follow = bubbleFollow(1);
    expect(follow).toBeGreaterThan(0.2);
    expect(follow).toBeLessThan(0.5);
  });
});
