import { describe, expect, it } from 'vitest';
import { Color } from 'three';
import { hslToRgb, journeyHue, journeyPalette } from './journeyPalette';

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

describe('палітра пари', () => {
  it('несе рівно один колір — шлях', () => {
    /*
     * Раніше тут жили ще й три кольори рівнів. Вони переїхали в
     * `starPalette.ts` разом із появою родин: перелік відтінків повторюється в
     * `CHECK` бази, і тримати його поряд із відтінком, якого в базі немає
     * взагалі, означало б два різні життєві цикли в одному файлі.
     */
    expect(Object.keys(journeyPalette('couple-1'))).toEqual(['path']);
  });

  it('шлях бере неон пари, тож у двох пар він різний', () => {
    expect(journeyPalette('couple-1').path).not.toBe(journeyPalette('couple-2').path);
  });

  it('колір шляху — розбірний HSL у межах 0…1', () => {
    for (const channel of hslToRgb(journeyPalette('couple-42').path)) {
      expect(channel).toBeGreaterThanOrEqual(0);
      expect(channel).toBeLessThanOrEqual(1);
    }
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
