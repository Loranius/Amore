// ============================================================
// Піщане дно: дюни, брижі й колір, що йде за рельєфом.
// ------------------------------------------------------------
// Було коло з 48 сегментів — рівна тарілка, на якій лежить риф. На
// референсах власника дно ЖИВЕ: його переорано хвилями в дрібні брижі,
// а під ними лежать довгі пологі дюни. Саме вони й дають масштаб: без
// них не видно, велика перед тобою брила чи маленька.
//
// ТРИ РІШЕННЯ, ЯКІ ТУТ ВАРТО ЗНАТИ.
//
// 1. СІТКА ЗГУЩУЄТЬСЯ ДО ЦЕНТРУ. Дно тягнеться на тридцять радіусів
//    каменя, але роздивляються з нього перші два. Рівномірна сітка
//    витратила б на далеке вісімнадцять з двадцяти тисяч вершин —
//    туди, де все одно самий туман. Радіус іде степенем 2.2, тож
//    щільність біля рифа вища вдесятеро.
//
// 2. НОРМАЛЬ БЕРЕТЬСЯ З ПОХІДНОЇ, А НЕ З СУСІДНІХ ГРАНЕЙ. Висота
//    задана формулою, тож нахил можна порахувати точно замість
//    усереднювати трикутники. Дешевше й без швів на стику кілець.
//
// 3. КОЛІР ЖИВЕ У ВЕРШИНАХ. Гребінь брижі світліший за западину — це
//    те, що робить пісок піском, і воно не коштує ані текстури, ані
//    другого виклику малювання.
// ============================================================
import { BufferAttribute, BufferGeometry } from 'three';

/** Кільця й сегменти. Разом — близько 2.5 тисяч вершин на все дно. */
const RINGS = 46;
const SEGMENTS = 56;

/** Наскільки щільніша сітка біля рифа: радіус іде цим степенем. */
const RADIAL_BIAS = 2.2;

/** Довгі пологі дюни: висота в частках опорного розміру. */
const DUNE_HEIGHT = 0.085;

/**
 * Брижі: висота й крок.
 *
 * Перша редакція мала висоту 0.016 при кроці 5.5 — на знімку дно
 * вийшло рівним. Причина рахується: така хвиля дає нахил близько двох
 * градусів, а двома градусами світло не малює нічого. Брижі мусять
 * бути помітними геометрично, інакше їх немає взагалі.
 */
const RIPPLE_HEIGHT = 0.055;
const RIPPLE_PITCH = 3.2;

/** Де брижі згасають, у частках повного радіуса дна. */
const RIPPLE_FADE = 0.5;

/**
 * Де дно розчиняється у воді, у частках свого радіуса.
 *
 * Туман сам по собі цього не робить: каустика малюється ДОДАВАННЯМ, і
 * туман на ній не гасить, а навпаки — додає свій колір, тож удалині все
 * дно засвічувалось у суцільну білу стіну. Тому згасання пишеться у
 * вершини: далеке дно множиться на нуль і зникає разом із каустикою.
 */
const HAZE_FROM = 0.16;
const HAZE_TO = 0.55;

/**
 * Висота піску в точці.
 *
 * Дюни — дві синусоїди під різними кутами: одна дає напрям, друга
 * ламає його регулярність. Брижі — третя, дрібна й майже поперечна до
 * дюн, як воно й буває на справжньому дні.
 */
function sandHeight(x: number, z: number, scale: number, radius: number): number {
  const dune = Math.sin(x / (scale * 2.6) + 0.7) * Math.cos(z / (scale * 3.4) - 0.3)
    + 0.45 * Math.sin((x + z) / (scale * 1.7));
  const distance = Math.hypot(x, z) / radius;
  const fade = Math.max(0, 1 - distance / RIPPLE_FADE);
  const ripple = Math.sin((x * 0.82 + z * 0.57) / scale * RIPPLE_PITCH)
    * Math.sin((x * 0.3 - z * 0.95) / scale * RIPPLE_PITCH * 0.35);
  return scale * (DUNE_HEIGHT * dune * 0.55 + RIPPLE_HEIGHT * ripple * fade);
}

export interface ReefSeabed {
  geometry: BufferGeometry;
  /** Найнижча точка дна — камінь має сісти не вище за неї. */
  lowest: number;
}

/**
 * Дно як сітка з рельєфом і кольором у вершинах.
 *
 * @param scale опорний розмір сцени — рельєф міряється ним, а не числами зі стелі
 * @param radius як далеко тягнеться дно
 */
export function buildReefSeabed(scale: number, radius: number): ReefSeabed {
  const positions: number[] = [];
  const normals: number[] = [];
  const colours: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let lowest = 0;

  const step = scale * 0.02;
  for (let ring = 0; ring <= RINGS; ring += 1) {
    const distance = radius * (ring / RINGS) ** RADIAL_BIAS;
    for (let segment = 0; segment < SEGMENTS; segment += 1) {
      const angle = (segment / SEGMENTS) * Math.PI * 2;
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;
      const y = sandHeight(x, z, scale, radius);
      lowest = Math.min(lowest, y);
      positions.push(x, y, z);
      // Розгортка згори: каустика — це тінь від поверхні води, і лягати
      // вона мусить по горизонталі, а не по схилу.
      uvs.push(x / (radius * 2) + 0.5, z / (radius * 2) + 0.5);

      // Нахил із похідної: точний і без швів на стику кілець.
      const slopeX = (sandHeight(x + step, z, scale, radius) - y) / step;
      const slopeZ = (sandHeight(x, z + step, scale, radius) - y) / step;
      const length = Math.max(1e-9, Math.hypot(-slopeX, 1, -slopeZ));
      normals.push(-slopeX / length, 1 / length, -slopeZ / length);

      /*
       * Гребінь світліший за западину. Множник малий навмисно: пісок,
       * у якого смуги видно здалеку, читається килимом.
       */
      const lift = 0.5 + 0.5 * Math.max(-1, Math.min(1, y / (scale * RIPPLE_HEIGHT * 1.6)));
      const tone = 0.82 + 0.26 * lift;
      const away = Math.hypot(x, z) / radius;
      const haze = 1 - Math.max(0, Math.min(1, (away - HAZE_FROM) / (HAZE_TO - HAZE_FROM)));
      const value = tone * haze;
      colours.push(value, value, value);
    }
  }

  for (let ring = 0; ring < RINGS; ring += 1) {
    const low = ring * SEGMENTS;
    const high = low + SEGMENTS;
    for (let segment = 0; segment < SEGMENTS; segment += 1) {
      const next = (segment + 1) % SEGMENTS;
      /*
       * ОБХІД ПРОТИ ГОДИННИКОВОЇ, і це не смак.
       *
       * Перша редакція мала (low, high, low+next) — і дна не було видно
       * ЗОВСІМ. Вимірювання спершу показало, що сцена потемніла на 38%,
       * і два кроки бісекції дали однакове число з дном і без нього:
       * дно ніколи й не малювалось.
       *
       * Причина рахується, а не вгадується. Для A=(d₁cosθ, y, d₁sinθ),
       * B=(d₂cosθ, …), C=(d₁cosθ′, …) вертикальна складова AB×AC
       * дорівнює −(d₂−d₁)·d₁·sin(Δθ), тобто НЕГАТИВНА: нормаль грані
       * дивилась униз, і відсікання зворотних граней прибирало все дно.
       * Нормалі у вершинах при цьому дивились угору — саме тому
       * освітлення виглядало б правильним, якби грані взагалі малювались.
       */
      indices.push(low + segment, low + next, high + segment);
      indices.push(low + next, high + next, high + segment);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(colours), 3));
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
  geometry.setIndex(new BufferAttribute(new Uint32Array(indices), 1));
  geometry.computeBoundingSphere();
  return { geometry, lowest };
}
