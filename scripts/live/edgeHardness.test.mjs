import { describe, expect, it } from 'vitest';
import { TONE_MAPPING_NONE } from './luminance.mjs';
import { edgeHardness, rowEdges } from './edgeHardness.mjs';

/*
 * ЛІНІЙКА, ЯКУ САМУ НЕ ПЕРЕВІРИЛИ, — ЦЕ ДРУГА ДУМКА, А НЕ ВИМІР.
 *
 * Цей проєкт уже двічі платив за прилад, що ставив не те питання:
 * ADR-0174 (мірка міряла острів замість кристала) і ADR-0187 (насиченість
 * міряла дрібноту замість колоній). Обидва давали числа схожого порядку й
 * нічим не кричали.
 *
 * Тому прилад ганяється по кадрах, про які відповідь відома НАПЕРЕД:
 * рівний схил не має жодної сходинки, драбина має рівно стільки, скільки
 * в ній приступок, а яскравість кадру на число не впливає.
 */

/** Рядок-схил: яскравість росте рівномірно. Сходинок нуль. */
function ramp(length, from, to) {
  return Array.from({ length }, (_v, x) => from + ((to - from) * x) / (length - 1));
}

/** Рядок-драбина: `steps` рівних приступок. Сходинок `steps - 1`. */
function staircase(length, steps, from, to) {
  return Array.from({ length }, (_v, x) => {
    const step = Math.min(steps - 1, Math.floor((x / length) * steps));
    return from + ((to - from) * step) / (steps - 1);
  });
}

describe('лінійка твердості краю', () => {
  it('на рівному схилі не бачить ЖОДНОЇ сходинки', () => {
    // Схил усередині однієї площини дає однакові кроки підряд. Саме тому
    // ребром вважається локальний МАКСИМУМ кроку, а не будь-який крок над
    // порогом: інакше пологий бік купола рахувався б суцільним ребром.
    expect(rowEdges(ramp(200, 0.1, 0.9))).toHaveLength(0);
  });

  it('на драбині бачить рівно стільки сходинок, скільки в ній приступок', () => {
    for (const steps of [2, 3, 5, 8]) {
      expect(rowEdges(staircase(400, steps, 0.2, 0.8)), `${steps} приступок`)
        .toHaveLength(steps - 1);
    }
  });

  it('не рахує поодиноку іскру за ребро', () => {
    /*
     * Один-два яскравіші пікселі — це блік, а не злам поверхні. На
     * кристалі така іскра вже різала грань навпіл (`findFacets`), тож
     * медіана п'яти сусідів стоїть і тут.
     */
    const row = ramp(200, 0.4, 0.6);
    row[100] = 1.6;
    expect(rowEdges(row)).toHaveLength(0);
  });

  it('дає ОДНЕ число на світлій і темній темі', () => {
    /*
     * Крок міряється часткою від середнього двох сусідів, а не різницею
     * байтів. Без цього прилад казав би, що світлий риф твердіший за
     * темний, хоч форма в них та сама, — і кожне порівняння тем було б
     * порівнянням яскравості.
     */
    const dark = rowEdges(staircase(400, 5, 0.05, 0.2));
    const light = rowEdges(staircase(400, 5, 0.5, 2.0));
    expect(dark).toHaveLength(4);
    expect(light).toHaveLength(4);
    expect(dark[0].step).toBeCloseTo(light[0].step, 6);
  });

  it('рахує щільність на ТІЛІ, а не силует тіла з тлом', () => {
    /*
     * Найтвердіше ребро будь-якого кадру — це край самого тіла на тлі
     * води. Воно мусить бути твердим, питання не про нього. Маска
     * вирізає тло, і сходинка крізь діру не тягнеться.
     */
    const width = 60;
    const height = 40;
    const data = new Uint8Array(width * height * 3);
    const mask = new Uint8Array(width * height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const inside = x >= 20 && x < 50;
        mask[y * width + x] = inside ? 1 : 0;
        // Тіло — рівний схил; тло — чорне. Отже єдина сходинка в рядку
        // стоїть рівно на межі тіла з тлом.
        const value = inside ? Math.round(120 + (x - 20) * 2) : 0;
        const offset = (y * width + x) * 3;
        data[offset] = value; data[offset + 1] = value; data[offset + 2] = value;
      }
    }
    const image = { width, height, channels: 3, data };
    const band = { y0: 0, y1: height, x0: 0, x1: width };
    const tone = { toneMapping: TONE_MAPPING_NONE, exposure: 1 };
    expect(edgeHardness(image, band, tone, { mask }).per100).toBe(0);
    // Без маски той самий кадр дає сходинку — тобто маска справді працює,
    // а не просто обнуляє все підряд.
    expect(edgeHardness(image, band, tone, { mask: null }).per100).toBeGreaterThan(0);
  });
});
