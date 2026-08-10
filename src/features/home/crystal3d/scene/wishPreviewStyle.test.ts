import { describe, expect, it } from 'vitest';
import {
  WISH_PREVIEW_CALM,
  WISH_PREVIEW_CLEAR,
  wishPreviewStyle,
} from './wishPreviewStyle';

// ============================================================
// Прев'ю бажання — вимога власника про візуальну цілісність вішліста.
// ------------------------------------------------------------
// «Фотографії занадто контрастні й чужорідні, ефект вставленої картинки»;
// прев'ю мають бути приглушені, тоновані в палітру й напівпрозорі, а різкість
// приходити при відкритті. Ці властивості — не смак, а сама вимога.
// ============================================================

describe('wish preview stylisation', () => {
  it('keeps the resting preview softer than the opened one in every dimension', () => {
    // Якби хоч одна пара чисел перевернулась, тап робив би картинку глухішою,
    // а не чіткішою — і це видно лише на живому екрані.
    expect(WISH_PREVIEW_CALM.saturation).toBeLessThan(WISH_PREVIEW_CLEAR.saturation);
    expect(WISH_PREVIEW_CALM.contrast).toBeLessThan(WISH_PREVIEW_CLEAR.contrast);
    expect(WISH_PREVIEW_CALM.opacity).toBeLessThan(WISH_PREVIEW_CLEAR.opacity);
    // Тонування — навпаки: у спокої прев'ю глибше зведене в колір світу.
    expect(WISH_PREVIEW_CALM.tint).toBeGreaterThan(WISH_PREVIEW_CLEAR.tint);
  });

  it('never shows the raw photo through the stone, even wide open', () => {
    // Повне, чесне фото живе в картці бажання. Крізь камінь воно лишається
    // включенням, а не наліпкою — інакше повертається рівно та вада, з якої
    // почалась ця зміна.
    expect(WISH_PREVIEW_CLEAR.saturation).toBeLessThan(1);
    expect(WISH_PREVIEW_CLEAR.opacity).toBeLessThan(1);
    expect(WISH_PREVIEW_CLEAR.tint).toBeGreaterThan(0);
  });

  it('walks from calm to clear and stops at both ends', () => {
    expect(wishPreviewStyle(0)).toEqual(WISH_PREVIEW_CALM);
    expect(wishPreviewStyle(1)).toEqual(WISH_PREVIEW_CLEAR);
    // Фокус — це згладжена величина, і на переході вона може вийти за межі
    // або прийти з порожньої сцени як NaN. Ані те, ані те не має ставати
    // від'ємною насиченістю в шейдері.
    expect(wishPreviewStyle(-3)).toEqual(WISH_PREVIEW_CALM);
    expect(wishPreviewStyle(9)).toEqual(WISH_PREVIEW_CLEAR);
    expect(wishPreviewStyle(Number.NaN)).toEqual(WISH_PREVIEW_CALM);
  });

  it('moves every dimension monotonically with focus', () => {
    let previous = wishPreviewStyle(0);
    for (let step = 1; step <= 10; step += 1) {
      const next = wishPreviewStyle(step / 10);
      expect(next.saturation).toBeGreaterThan(previous.saturation);
      expect(next.contrast).toBeGreaterThan(previous.contrast);
      expect(next.opacity).toBeGreaterThan(previous.opacity);
      expect(next.tint).toBeLessThan(previous.tint);
      previous = next;
    }
  });
});
