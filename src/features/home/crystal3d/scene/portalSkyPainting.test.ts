import { describe, expect, it } from 'vitest';
import {
  PORTAL_SKY_LAYOUT,
  PORTAL_SKY_LOOKS,
  PORTAL_SKY_PAINT_HEIGHT as H,
  PORTAL_SKY_PAINT_WIDTH as W,
  hexToRgb,
  paintPortalSky,
} from './portalSkyPainting';

// ============================================================
// Намальоване небо (ADR-0210).
// ------------------------------------------------------------
// Кольори неба виміряні з еталона власника пікселями. Ці перевірки
// тримають саме заміри й рішення, а не «гарно»: гарно перевіряє знімок.
// ============================================================

const light = paintPortalSky(PORTAL_SKY_LOOKS.light);
const dark = paintPortalSky(PORTAL_SKY_LOOKS.dark);

function at(pixels: Uint8Array, u: number, v: number): [number, number, number] {
  const x = Math.min(W - 1, Math.floor(u * W));
  const y = Math.min(H - 1, Math.floor(v * H));
  const i = (y * W + x) * 4;
  return [pixels[i]!, pixels[i + 1]!, pixels[i + 2]!];
}

function luminance([r, g, b]: readonly number[]): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r!) + 0.7152 * channel(g!) + 0.0722 * channel(b!);
}

function distance(a: readonly number[], b: readonly number[]): number {
  return Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);
}

describe('небо детерміноване', () => {
  it('два малювання дають ті самі байти', () => {
    // Власний хеш-шум, стале зерно: небо однакове на кожному відкритті.
    const again = paintPortalSky(PORTAL_SKY_LOOKS.light);
    expect(again.length).toBe(W * H * 4);
    let same = true;
    for (let i = 0; i < again.length; i += 97) if (again[i] !== light[i]) { same = false; break; }
    expect(same).toBe(true);
  });
});

describe('кольори — з еталона власника', () => {
  it('зеніт — глибокий індиго, як у еталоні (#1b2654 на y 0.01)', () => {
    expect(distance(at(light, 0.5, 0.01), hexToRgb('#1b2654'))).toBeLessThan(28);
  });

  it('біля сонця за кристалом тепло: червоного більше за синій', () => {
    const [r, , b] = at(light, PORTAL_SKY_LAYOUT.sunX, PORTAL_SKY_LAYOUT.sunY);
    expect(r).toBeGreaterThan(b);
    expect(r).toBeGreaterThan(230);
  });

  it('море хмар під обрієм — лавандове, світліше за зеніт', () => {
    const sea = at(light, 0.2, 0.7);
    expect(luminance(sea)).toBeGreaterThan(luminance(at(light, 0.5, 0.02)) * 4);
  });

  it('темна тема — той самий кадр, темніший у середньому', () => {
    let lightSum = 0;
    let darkSum = 0;
    for (let i = 0; i < light.length; i += 4 * 31) {
      lightSum += light[i]! + light[i + 1]! + light[i + 2]!;
      darkSum += dark[i]! + dark[i + 1]! + dark[i + 2]!;
    }
    expect(darkSum).toBeLessThan(lightSum * 0.7);
  });
});

describe('тиха зона за текстом шапки', () => {
  /*
   * ВИМОГА. Привітання й лічильник лежать прямо на небі світлим
   * чорнилом. Освітлена хмара за ними з'їла б контраст — тому по центру
   * вгорі хмар немає, як і в еталоні (там вони по кутах).
   */
  it('по центру вгорі небо тримається градієнта, а не хмари', () => {
    for (let v = 0.03; v <= 0.2; v += 0.03) {
      for (let u = 0.35; u <= 0.65; u += 0.05) {
        // Найсвітліше, що допускає світле чорнило з 4.5:1: L ≤ 0.16.
        expect(luminance(at(light, u, v))).toBeLessThan(0.16);
      }
    }
  });

  it('по краях на тій самій висоті хмари Є — зона тиха лише там, де текст', () => {
    let brightest = 0;
    for (let v = 0.05; v <= 0.25; v += 0.01) {
      for (const u of [0.03, 0.08, 0.92, 0.97]) brightest = Math.max(brightest, luminance(at(light, u, v)));
    }
    expect(brightest).toBeGreaterThan(0.2);
  });
});
