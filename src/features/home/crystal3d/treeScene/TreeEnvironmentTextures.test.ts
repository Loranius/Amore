import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { writeSrgbPixel } from './TreeEnvironmentTextures';

describe('Текстури середовища дерева', () => {
  it('writes the colour the palette actually names', () => {
    /*
     * ВАДА, ЯКУ ЦЕЙ ТЕСТ ТРИМАЄ ЗАЧИНЕНОЮ, І ВОНА КОШТУВАЛА ЦІЛОЇ ГАЛЯВИНИ.
     *
     * `THREE.Color` за увімкненого `ColorManagement` тримає складові в
     * ЛІНІЙНОМУ просторі, а полотно — у sRGB. Запис `color.r * 255` без
     * зворотного перетворення робив землю вчетверо темнішою за палітру:
     * виміряно на живому екрані медіанну яскравість 27 там, де рівний
     * `#808080` дає 93-109.
     *
     * Тут перевіряється саме те, що ламалось: байт, записаний у полотно,
     * має збігатися з тим, що написано в палітрі.
     */
    const bytes = new Uint8ClampedArray(4);
    writeSrgbPixel(bytes, 0, new THREE.Color('#5f7c48'));

    expect([...bytes]).toEqual([0x5f, 0x7c, 0x48, 255]);
  });

  it('keeps the ends of the range honest', () => {
    // Чорне лишається чорним, біле — білим: перетворення не має зсувати межі.
    const bytes = new Uint8ClampedArray(8);
    writeSrgbPixel(bytes, 0, new THREE.Color('#000000'));
    writeSrgbPixel(bytes, 4, new THREE.Color('#ffffff'));
    expect([...bytes]).toEqual([0, 0, 0, 255, 255, 255, 255, 255]);
  });

  it('round-trips every colour the ground palette uses', () => {
    // Уся палітра ґрунту, а не один зразок: вада була однакова для кожного.
    for (const hex of [
      '#718d55', '#93aa6c', '#536d42', '#a39b72',
      '#7b6148', '#9b7b59', '#5b4938', '#aaa18f',
      '#5f7c48', '#7f9b5e', '#48623a', '#918a64',
      '#6d5743', '#8b7053', '#514236', '#948d80',
    ]) {
      const bytes = new Uint8ClampedArray(4);
      writeSrgbPixel(bytes, 0, new THREE.Color(hex));
      const written = `#${[...bytes].slice(0, 3)
        .map((value) => value.toString(16).padStart(2, '0')).join('')}`;
      expect({ hex, written }).toEqual({ hex, written: hex });
    }
  });
});
