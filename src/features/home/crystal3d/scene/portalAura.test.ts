import { describe, expect, it } from 'vitest';
import { PORTAL_AURA_SIZE, portalAuraFalloff, portalAuraPixels } from './portalAura';

// ============================================================
// Аура кристала (ADR-0210): форма марева за кристалом.
// ============================================================

describe('аура кристала', () => {
  it('гасне РІВНО до нуля на краю — інакше квадрат спрайта видно в небі', () => {
    expect(portalAuraFalloff(1)).toBe(0);
    expect(portalAuraFalloff(1.4)).toBe(0);
    const pixels = portalAuraPixels();
    // Усі чотири кути квадрата — поза колом, тож прозорі.
    for (const [x, y] of [[0, 0], [PORTAL_AURA_SIZE - 1, 0], [0, PORTAL_AURA_SIZE - 1], [PORTAL_AURA_SIZE - 1, PORTAL_AURA_SIZE - 1]]) {
      expect(pixels[(y! * PORTAL_AURA_SIZE + x!) * 4 + 3]).toBe(0);
    }
  });

  it('найяскравіша в центрі й спадає монотонно — марево, а не кільце', () => {
    expect(portalAuraFalloff(0)).toBe(1);
    let previous = Number.POSITIVE_INFINITY;
    for (let r = 0; r <= 1; r += 0.05) {
      const value = portalAuraFalloff(r);
      expect(value).toBeLessThanOrEqual(previous);
      expect(Number.isFinite(value)).toBe(true);
      previous = value;
    }
  });

  it('форма лише в альфі: колір дає палітра, тож одна текстура на обидві теми', () => {
    const pixels = portalAuraPixels(8);
    for (let at = 0; at < pixels.length; at += 4) {
      expect([pixels[at], pixels[at + 1], pixels[at + 2]]).toEqual([255, 255, 255]);
    }
  });

  it('детермінована: два виклики дають ті самі байти', () => {
    expect(portalAuraPixels()).toEqual(portalAuraPixels());
  });
});
