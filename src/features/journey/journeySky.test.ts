import { describe, expect, it } from 'vitest';
import {
  JOURNEY_BAND_NORMAL,
  JOURNEY_NEBULA_HEIGHT as H,
  JOURNEY_NEBULA_WIDTH as W,
  JOURNEY_SKY_COLOURS,
  JOURNEY_STAR_COUNT,
  bandCloseness,
  hexToRgb,
  journeyStarField,
  nebulaDirection,
  paintJourneyNebula,
} from './journeySky';

// ============================================================
// Небо «Нашого шляху» (ADR-0214).
// ------------------------------------------------------------
// ВИМОГА ВЛАСНИКА: «при відкритті довго вантажиться фон і в поганій
// якості». Небо тепер малюється, а не вантажиться. Тут стережеться те, що
// відрізняє намальоване небо від зламаного: детермінованість, відсутність
// шва, колір у межах, виміряних зі скриншота власника, і зірки там, де
// смуга.
// ============================================================

// Менша розгортка — та сама функція; повна малюється у воркері.
const SMALL_W = 256;
const SMALL_H = 128;
const nebula = paintJourneyNebula(SMALL_W, SMALL_H);

function at(u: number, v: number): [number, number, number] {
  const x = Math.min(SMALL_W - 1, Math.floor(u * SMALL_W));
  const y = Math.min(SMALL_H - 1, Math.floor(v * SMALL_H));
  const i = (y * SMALL_W + x) * 4;
  return [nebula[i]!, nebula[i + 1]!, nebula[i + 2]!];
}

describe('туманність', () => {
  it('детермінована: два малювання дають ті самі байти', () => {
    const again = paintJourneyNebula(SMALL_W, SMALL_H);
    expect(Buffer.from(again).equals(Buffer.from(nebula))).toBe(true);
  });

  it('повна розгортка — 2:1, бо це сфера', () => {
    expect(W).toBe(H * 2);
  });

  it('без шва: перший і останній стовпчики — сусіди на сфері', () => {
    let worst = 0;
    for (let row = 0; row < SMALL_H; row += 1) {
      const left = (row * SMALL_W) * 4;
      const right = (row * SMALL_W + SMALL_W - 1) * 4;
      for (let c = 0; c < 3; c += 1) worst = Math.max(worst, Math.abs(nebula[left + c]! - nebula[right + c]!));
    }
    expect(worst).toBeLessThan(10);
  });

  it('темна, як на скриншоті власника: жоден піксель не світліший за найсвітліший колір палітри', () => {
    const ceiling = Math.max(...hexToRgb(JOURNEY_SKY_COLOURS.glow));
    let brightest = 0;
    let sum = 0;
    for (let i = 0; i < nebula.length; i += 4) {
      brightest = Math.max(brightest, nebula[i]!, nebula[i + 1]!, nebula[i + 2]!);
      sum += nebula[i]! + nebula[i + 1]! + nebula[i + 2]!;
    }
    expect(brightest).toBeLessThanOrEqual(ceiling + 1);
    // Середнє — у межах тіла туманності (#271528 на скриншоті), а не чорнота.
    const mean = sum / (nebula.length / 4) / 3;
    expect(mean).toBeGreaterThan(18);
    expect(mean).toBeLessThan(60);
  });

  it('смуга Чумацького Шляху світліша за полюси смуги', () => {
    let onBand = 0;
    let offBand = 0;
    let nOn = 0;
    let nOff = 0;
    for (let v = 0.02; v < 1; v += 0.02) {
      for (let u = 0; u < 1; u += 0.02) {
        const closeness = bandCloseness(nebulaDirection(u, v));
        const [r, g, b] = at(u, v);
        if (closeness > 0.8) { onBand += r + g + b; nOn += 1; }
        if (closeness < 0.05) { offBand += r + g + b; nOff += 1; }
      }
    }
    expect(nOn).toBeGreaterThan(20);
    expect(nOff).toBeGreaterThan(20);
    expect(onBand / nOn).toBeGreaterThan(offBand / nOff);
  });

  it('напрям розгортки — одиничний вектор (та сама угода, що в SphereGeometry)', () => {
    for (const [u, v] of [[0, 0.5], [0.25, 0.2], [0.9, 0.95]] as const) {
      const d = nebulaDirection(u, v);
      expect(Math.hypot(...d)).toBeCloseTo(1, 9);
    }
    expect(nebulaDirection(0.3, 1)[1]).toBeCloseTo(1, 9);
    expect(nebulaDirection(0.3, 0)[1]).toBeCloseTo(-1, 9);
  });
});

describe('зірки', () => {
  const field = journeyStarField();

  it('каталог повний і детермінований', () => {
    expect(field.sizes.length).toBe(JOURNEY_STAR_COUNT);
    const again = journeyStarField();
    expect(Array.from(again.positions.slice(0, 30))).toEqual(Array.from(field.positions.slice(0, 30)));
  });

  it('кожна зірка — на одиничній сфері, з розміром і кольором у межах', () => {
    for (let i = 0; i < field.sizes.length; i += 97) {
      const p = [field.positions[i * 3]!, field.positions[i * 3 + 1]!, field.positions[i * 3 + 2]!];
      expect(Math.hypot(...p)).toBeCloseTo(1, 4);
      expect(field.sizes[i]!).toBeGreaterThan(0.5);
      expect(field.sizes[i]!).toBeLessThan(5);
      for (let c = 0; c < 3; c += 1) {
        expect(field.colours[i * 3 + c]!).toBeGreaterThanOrEqual(0);
        expect(field.colours[i * 3 + c]!).toBeLessThanOrEqual(1);
      }
    }
  });

  it('як у справжнього неба: дрібних іскор набагато більше, ніж яскравих', () => {
    let small = 0;
    let large = 0;
    for (const size of field.sizes) {
      if (size < 1.6) small += 1;
      if (size > 3) large += 1;
    }
    // Виміряно: 7 682 дрібних проти 1 109 яскравих, тобто ~7:1. Межа ×5 —
    // запас, а не підгонка: пласкі розміри дали б 1:1.
    expect(small).toBeGreaterThan(large * 5);
    expect(large).toBeGreaterThan(0);
  });

  it('густішають уздовж смуги', () => {
    let near = 0;
    for (let i = 0; i < field.sizes.length; i += 1) {
      const d: [number, number, number] = [field.positions[i * 3]!, field.positions[i * 3 + 1]!, field.positions[i * 3 + 2]!];
      if (bandCloseness(d) > 0.5) near += 1;
    }
    // Частка сфери з близькістю > 0.5 — близько 0.28; зірок там помітно більше.
    expect(near / field.sizes.length).toBeGreaterThan(0.36);
    expect(Math.hypot(...JOURNEY_BAND_NORMAL)).toBeCloseTo(1, 9);
  });
});
