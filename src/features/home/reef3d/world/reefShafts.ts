// ============================================================
// Сонячні промені крізь товщу води.
// ------------------------------------------------------------
// На всіх п'яти референсах власника перше, що робить кадр підводним, —
// не корал і не риба, а СВІТЛО: похилі стовпи, що падають від поверхні
// й тануть, не діставши дна. Без них вода читається кольоровим тлом, а
// не товщею, крізь яку дивишся.
//
// ЯК ЦЕ ЗРОБЛЕНО ДЕШЕВО. Промінь — конус без денця з альфою у
// ВЕРШИНАХ: угорі майже непрозорий, унизу — нуль. Ніякої текстури,
// ніякого шейдера, жодного зайвого проходу; вісім променів коштують
// один виклик малювання, бо всі лежать в одній геометрії.
//
// Альфа в кольорі вершини — саме тому колірний атрибут має ЧОТИРИ
// складові, а не три. Три давали б рівний стовп із різким краєм, і це
// читалось би конусом, а не світлом.
// ============================================================
import { BufferAttribute, BufferGeometry } from 'three';

/** Скільки променів. */
const SHAFT_COUNT = 9;

/** Наскільки промінь розширюється донизу. */
const BOTTOM_WIDEN = 2.1;

/** Найбільша прозорість у центрі верху. */
const CORE_ALPHA = 0.3;

/** Детермінований дріб від пари цілих — той самий промінь щоразу. */
function unit(seed: number, salt: number): number {
  let value = Math.imul(seed ^ (salt * 0x9e3779b9), 0x85ebca6b) >>> 0;
  value ^= value >>> 13;
  value = Math.imul(value, 0xc2b2ae35) >>> 0;
  return ((value ^ (value >>> 16)) >>> 0) / 4_294_967_296;
}

/**
 * Геометрія всіх променів однією сіткою.
 *
 * ЧОМУ НЕ КОНУС. Перша редакція будувала промінь конусом, і на знімку
 * вийшли скляні панелі: у конуса є силует, а у світла його немає. Різкий
 * край видавав геометрію в кожному кадрі.
 *
 * Тут промінь — ДВІ схрещені площини по три стовпці: скраю альфа нуль,
 * посередині максимум, унизу нуль скрізь. М'який край з будь-якого боку
 * й жодної текстури. Схрещені — щоб промінь не зникав, коли камера
 * обходить риф збоку.
 *
 * @param reach найбільший радіус сцени — промені стоять навколо рифа
 * @param top   висота, з якої падає світло
 */
export function buildReefShaftGeometry(reach: number, top: number, seed: number): BufferGeometry {
  const positions: number[] = [];
  const colours: number[] = [];
  const indices: number[] = [];

  for (let shaft = 0; shaft < SHAFT_COUNT; shaft += 1) {
    // Нерівний крок по колу: рівний читається огорожею, а не світлом.
    const azimuth = (shaft / SHAFT_COUNT) * Math.PI * 2
      + (unit(seed, shaft * 7 + 1) - 0.5) * 0.8;
    const distance = reach * (0.3 + 1.4 * unit(seed, shaft * 7 + 2));
    const halfWidth = reach * (0.09 + 0.13 * unit(seed, shaft * 7 + 3));
    const alpha = CORE_ALPHA * (0.4 + 0.6 * unit(seed, shaft * 7 + 4));
    // Усі промені паралельні: це одне сонце, а не дев'ять ліхтарів.
    const lean = reach * 0.5;

    const centreX = Math.cos(azimuth) * distance;
    const centreZ = Math.sin(azimuth) * distance;

    for (const plane of [0, 1]) {
      const along = plane === 0
        ? { x: 1, z: 0 }
        : { x: 0, z: 1 };
      const base = positions.length / 3;

      for (let row = 0; row < 2; row += 1) {
        const height = row === 0 ? top : -top * 0.2;
        const widen = row === 0 ? 1 : BOTTOM_WIDEN;
        const drift = row === 0 ? 0 : lean;
        for (let column = -1; column <= 1; column += 1) {
          positions.push(
            centreX + along.x * column * halfWidth * widen + drift,
            height,
            centreZ + along.z * column * halfWidth * widen + drift * 0.4,
          );
          // Альфа гасне і до країв, і донизу: у світла немає ані краю,
          // ані дна.
          colours.push(1, 1, 1, row === 0 && column === 0 ? alpha : 0);
        }
      }

      for (let column = 0; column < 2; column += 1) {
        indices.push(base + column, base + 3 + column, base + column + 1);
        indices.push(base + column + 1, base + 3 + column, base + 4 + column);
      }
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(colours), 4));
  geometry.setIndex(new BufferAttribute(new Uint16Array(indices), 1));
  geometry.computeBoundingSphere();
  return geometry;
}
