import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  REEF_BACKDROP_TRIANGLES,
  buildReefBackdropGeometry,
  type ReefBackdropPart,
} from './reefBackdrop';

/*
 * ВИМОГА (`REEF_ENVIRONMENT_VISUAL_PASS.md`, ADR-0195 крок 8): вісім тіл
 * набору зводяться в ОДНУ геометрію, один матеріал і один виклик
 * малювання, стоять пологою дугою за рифом у тумані — і НЕ дають колоній
 * та не читають подій пари.
 */

/** Тіло-заглушка: один трикутник, щоб міряти саме злиття, а не набір. */
function part(colour: [number, number, number]): ReefBackdropPart {
  return { positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], indices: [0, 1, 2], colour };
}

const OPTIONS = { distance: 10, spread: Math.PI * 0.8, scale: 2, seed: 7 };

describe('далекий силует', () => {
  it('вісім тіл стають ОДНІЄЮ геометрією', () => {
    const parts = Array.from({ length: 8 }, (_v, at) => part([at / 8, 0.5, 1 - at / 8]));
    const geometry = buildReefBackdropGeometry(parts, OPTIONS);
    expect(geometry.getIndex()!.count / 3, 'трикутників').toBe(8);
    expect(geometry.getAttribute('position').count, 'вершин').toBe(24);
    expect(geometry.getAttribute('color'), 'колір із набору').toBeDefined();
  });

  it('кожне тіло несе СВІЙ колір, а не колір матеріалу', () => {
    /*
     * У набору колір лежить у вершинах, по одному унікальному значенню на
     * тіло (ADR-0182). Якби злиття його губило, вісім коралів стали б
     * одним сірим силуетом — і сенс набору («він продає палітру, а не
     * морфологію») зник би разом із ним.
     */
    const parts = [part([1, 0, 0]), part([0, 1, 0])];
    const colours = buildReefBackdropGeometry(parts, OPTIONS).getAttribute('color');
    expect([colours.getX(0), colours.getY(0), colours.getZ(0)]).toEqual([1, 0, 0]);
    expect([colours.getX(3), colours.getY(3), colours.getZ(3)]).toEqual([0, 1, 0]);
  });

  it('тіла стоять ПОЗАДУ рифа, а не навколо нього', () => {
    /*
     * Дуга полога: кільце навколо рифа читалось би огорожею, а треба
     * далекий берег. Середина набору — строго позаду, тобто там, де на
     * телефоні найбільше порожньої води.
     */
    const parts = Array.from({ length: 8 }, () => part([1, 1, 1]));
    const geometry = buildReefBackdropGeometry(parts, OPTIONS);
    const position = geometry.getAttribute('position');
    let behind = 0;
    for (let at = 0; at < position.count; at += 1) if (position.getZ(at) > 0) behind += 1;
    expect(behind / position.count, 'частка вершин позаду').toBeGreaterThan(0.75);
  });

  it('жодне тіло не стоїть там, де стоїть сам риф', () => {
    // Порожній центр — умова того, що це ТЛО, а не друга купка коралів.
    const parts = Array.from({ length: 8 }, () => part([1, 1, 1]));
    const position = buildReefBackdropGeometry(parts, OPTIONS).getAttribute('position');
    for (let at = 0; at < position.count; at += 1) {
      expect(Math.hypot(position.getX(at), position.getZ(at))).toBeGreaterThan(OPTIONS.distance * 0.5);
    }
  });

  it('та сама пара бачить той самий берег, інша — інший', () => {
    const parts = Array.from({ length: 8 }, () => part([1, 1, 1]));
    const first = buildReefBackdropGeometry(parts, OPTIONS).getAttribute('position').array;
    const same = buildReefBackdropGeometry(parts, OPTIONS).getAttribute('position').array;
    const other = buildReefBackdropGeometry(parts, { ...OPTIONS, seed: 99 })
      .getAttribute('position').array;
    expect(Array.from(same)).toEqual(Array.from(first));
    expect(Array.from(other)).not.toEqual(Array.from(first));
  });

  it('ШАР НЕ ЧИТАЄ ІСТОРІЇ ПАРИ — це заборона, а не зауваження', () => {
    /*
     * Колонія на рік — єдине, що на цьому рифі щось означає. Стоковий
     * меш, який почав би вдавати літопис, знищив би саму ідею об'єкта, і
     * специфікація забороняє це прямо: «It never contributes colonies or
     * receives portal-event bindings».
     *
     * Тест дивиться в ТЕКСТ, бо саме поява такого імпорту й була б вадою:
     * підключити сюди план рифа — це один рядок, і зробити його легше,
     * ніж помітити.
     */
    const source = readFileSync(new URL('./reefBackdrop.ts', import.meta.url), 'utf8');
    for (const forbidden of ['ReefPlan', 'reefAssembly', 'colon', 'event', 'Event']) {
      expect(source, `шар тла торкнувся «${forbidden}»`).not.toContain(forbidden);
    }
  });

  it('стеля набору названа числом', () => {
    // Вісім тіл по 760 — з розбору GLB. Набір, що раптом поважчав, має
    // про себе сказати, а не з'їсти бюджет сцени мовчки.
    expect(REEF_BACKDROP_TRIANGLES).toBe(8 * 760);
  });
});
