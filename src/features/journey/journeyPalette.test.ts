import { describe, expect, it } from 'vitest';
import { Color } from 'three';
import { hslToRgb, journeyHue, journeyPalette, levelColour, starTints } from './journeyPalette';

describe('відтінок пари', () => {
  it('без насіння небо лишається базовим фіолетовим порталу', () => {
    expect(journeyHue(null)).toBeCloseTo(226.2247191011, 6);
  });

  it('та сама пара — той самий відтінок', () => {
    expect(journeyHue('couple-42')).toBe(journeyHue('couple-42'));
  });

  it('інша пара — інший відтінок', () => {
    expect(journeyHue('couple-42')).not.toBe(journeyHue('couple-43'));
  });

  it('жодна пара не виходить за смугу палітри порталу', () => {
    // Регрес: раніше відтінок був повним обертом, і на живому екрані небо
    // цієї пари вийшло салатовим посеред фіолетового світу.
    for (let index = 0; index < 400; index += 1) {
      const hue = journeyHue(`couple-${index}`);
      const distance = Math.abs(((hue - 260.2247191011 + 540) % 360) - 180);
      expect(distance).toBeLessThanOrEqual(34.0001);
    }
  });
});

describe('кольори рівнів', () => {
  it('важлива й звичайна не залежать від пари', () => {
    // Рівень означає те саме в усіх парах; якби він їхав за ДНК, «важлива» в
    // двох пар була б різного кольору.
    expect(journeyPalette('couple-1').important).toBe(journeyPalette('couple-2').important);
    expect(journeyPalette('couple-1').regular).toBe(journeyPalette('couple-2').regular);
  });

  it('ключова бере неон пари', () => {
    const palette = journeyPalette('couple-1');
    expect(levelColour(palette, 'key')).toBe(palette.key);
    expect(levelColour(palette, 'important')).toBe(palette.important);
    expect(levelColour(palette, 'regular')).toBe(palette.regular);
  });

  it('обрані власником кольори не змінились', () => {
    const palette = journeyPalette(null);
    expect(palette.important).toBe('hsl(44 92% 62%)'); // жовта
    expect(palette.regular).toBe('hsl(184 76% 58%)'); // бірюзова
  });
});

describe('hslToRgb', () => {
  it('чисті кольори переводяться точно', () => {
    expect(hslToRgb('hsl(0 100% 50%)')).toEqual([1, 0, 0]);
    expect(hslToRgb('hsl(120 100% 50%)')).toEqual([0, 1, 0]);
    expect(hslToRgb('hsl(240 100% 50%)')).toEqual([0, 0, 1]);
  });

  it('без насиченості дає сірий', () => {
    expect(hslToRgb('hsl(200 0% 40%)')).toEqual([0.4, 0.4, 0.4]);
  });

  it('кольори палітри лишаються в межах 0…1', () => {
    const palette = journeyPalette('couple-42');
    for (const colour of [palette.key, palette.keyCore, palette.important, palette.regular]) {
      for (const channel of hslToRgb(colour)) {
        expect(channel).toBeGreaterThanOrEqual(0);
        expect(channel).toBeLessThanOrEqual(1);
      }
    }
  });

  it('жовта справді жовта, бірюзова справді бірюзова', () => {
    const [yellowR, yellowG, yellowB] = hslToRgb('hsl(44 92% 62%)');
    expect(yellowR).toBeGreaterThan(yellowB);
    expect(yellowG).toBeGreaterThan(yellowB);
    const [cyanR, cyanG, cyanB] = hslToRgb('hsl(184 76% 58%)');
    expect(cyanG).toBeGreaterThan(cyanR);
    expect(cyanB).toBeGreaterThan(cyanR);
  });

  it('не HSL — це помилка, а не мовчазний чорний', () => {
    expect(() => hslToRgb('#b06bff')).toThrow();
  });
});

describe('starTints', () => {
  const palette = journeyPalette('couple-42');
  const stars = [
    { core: true, level: 'key' as const },
    { core: false, level: 'key' as const },
    { core: false, level: 'important' as const },
    { core: false, level: 'regular' as const },
  ];

  function rgbAt(tints: Float32Array, index: number): [number, number, number] {
    return [tints[index * 3]!, tints[index * 3 + 1]!, tints[index * 3 + 2]!];
  }

  it('дає по три числа на зірку', () => {
    expect(starTints(stars, palette)).toHaveLength(stars.length * 3);
  });

  it('жодна зірка не виходить білою', () => {
    /*
     * Регрес, який знайшов ЛИШЕ живий екран.
     *
     * Кольори будувались через `THREE.Color.set()`, а його розбірник знає лише
     * старий синтаксис `hsl(184, 76%, 58%)` з комами. Наш запис сучасний, через
     * пробіли (він їде ще й у CSS-змінні), і на ньому `set()` мовчки лишає
     * білий. На знімку всі вісім зірок вийшли однаковим нейтральним світінням:
     * бірюзова звичайна, жовта важлива й неонова ключова стали нерозрізненні.
     */
    const tints = starTints(stars, palette);
    for (let index = 0; index < stars.length; index += 1) {
      const [r, g, b] = rgbAt(tints, index);
      const spread = Math.max(r, g, b) - Math.min(r, g, b);
      expect(spread).toBeGreaterThan(0.05);
    }
  });

  it('три рівні дають три РІЗНІ відтінки', () => {
    const tints = starTints(stars, palette);
    const [key, important, regular] = [1, 2, 3].map((index) => rgbAt(tints, index));
    const apart = (a: number[], b: number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);
    expect(apart(key!, important!)).toBeGreaterThan(0.25);
    expect(apart(important!, regular!)).toBeGreaterThan(0.25);
    expect(apart(key!, regular!)).toBeGreaterThan(0.25);
  });

  it('звичайна справді бірюзова, важлива справді жовта', () => {
    const tints = starTints(stars, palette);
    const [, importantG, importantB] = rgbAt(tints, 2);
    const [regularR, regularG, regularB] = rgbAt(tints, 3);
    expect(importantG).toBeGreaterThan(importantB);
    expect(regularG).toBeGreaterThan(regularR);
    expect(regularB).toBeGreaterThan(regularR);
  });

  it('ядро світліше за звичайну ключову', () => {
    const tints = starTints(stars, palette);
    const luminance = (rgb: number[]) => 0.2126 * rgb[0]! + 0.7152 * rgb[1]! + 0.0722 * rgb[2]!;
    expect(luminance(rgbAt(tints, 0))).toBeGreaterThan(luminance(rgbAt(tints, 1)));
  });

  it('порожній набір дає порожній масив', () => {
    expect(starTints([], palette)).toHaveLength(0);
  });
});

describe('чому не THREE.Color', () => {
  it('THREE.Color НЕ розбирає наш синтаксис — саме тому конвертер свій', () => {
    // Це не тест на three, а закріплення причини. Якщо колись `Color.set()`
    // навчиться сучасного синтаксису, цей тест впаде й скаже, що обхід можна
    // знімати.
    const parsed = new Color();
    parsed.set('hsl(184 76% 58%)');
    expect(parsed.getHexString()).toBe('ffffff');

    const legacy = new Color();
    legacy.set('hsl(184, 76%, 58%)');
    expect(legacy.getHexString()).not.toBe('ffffff');
  });
});
