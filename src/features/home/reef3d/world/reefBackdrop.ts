// ============================================================
// Далекий силует: глибина кадру з асета, що лежав нечитаним.
// ------------------------------------------------------------
// `public/models/coral_reef_set_cc0.glb` (MiniPoly, CC0) має в репозиторії
// ДВІ роботи, і жодна не була зроблена. Першу — бути еталоном пропорції й
// палітри — закрив ADR-0182. Друга описана в
// `docs/evolution-engine/REEF_ENVIRONMENT_VISUAL_PASS.md` як чинна частина
// сцени: «At runtime the eight meshes are transformed into a shallow arc and
// merged into one geometry, one material and one draw call.»
//
// Жоден рядок коду цього не робив. Цей файл робить (ADR-0195, крок 8).
//
// ЩО ЦЕ ДАЄ. За рифом зараз порожня вода: нічого, що сказало б оку, як
// далеко видно. Далекий силует у тумані — єдине, що дає кадру глибину, і
// на всіх п'яти референсах власника він є.
//
// ЧОГО ЦЕ НЕ РОБИТЬ, І ЦЕ ЗАБОРОНА, А НЕ ЗАУВАЖЕННЯ. Шар **не дає
// колоній і не читає жодної події пари**. Колонія на рік — єдине, що на
// цьому рифі щось означає; стоковий меш, який почав би вдавати літопис,
// знищив би саму ідею об'єкта. Специфікація каже це прямо, і тест поруч
// стереже.
// ============================================================
import { BufferAttribute, BufferGeometry } from 'three';

/**
 * Скільки трикутників у всьому наборі.
 *
 * Вісім тіл по 760 — число з розбору GLB (`scripts/models/measure-reef.mjs`),
 * те саме, що лежить у `REEF_REFERENCE.bodyTriangles`. Стеля перевіряється
 * тестом: набір, що раптом поважчав, має про себе сказати.
 */
export const REEF_BACKDROP_TRIANGLES = 6080;

/** Одне тіло набору, вже у світових координатах свого вузла. */
export interface ReefBackdropPart {
  positions: readonly number[];
  indices: readonly number[];
  /** Власний колір тіла з набору, 0..1. */
  colour: readonly [number, number, number];
}

export interface ReefBackdropOptions {
  /** Радіус дуги, на якій стоять тіла. */
  distance: number;
  /** Скільки радіан займає дуга. */
  spread: number;
  /** У скільки разів збільшити кожне тіло. */
  scale: number;
  /** Насіння: розкладка стала для пари, але не однакова для всіх. */
  seed: number;
  /** На скільки втопити тіло в дно, у частках його висоти. */
  sink?: number;
}

/** Та сама детермінована дрібничка, що й скрізь у рифі. */
function unit(seed: number, salt: number): number {
  const mixed = Math.sin((seed + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return mixed - Math.floor(mixed);
}

/**
 * Вісім тіл → ОДНА геометрія.
 *
 * ЧОМУ ЗЛИТТЯ, А НЕ ВІСІМ ІНСТАНСІВ. Інстанси коштували б один виклик на
 * ФОРМУ, а форма тут одна на всі вісім (ADR-0182: набір продає палітру, а
 * не морфологію) — тобто інстанси дали б те саме. Але колір у набору
 * лежить у ВЕРШИНАХ, а не в матеріалі, тож інстансу довелось би нести ще
 * й колір окремим атрибутом. Злиття дає той самий один виклик і нічого не
 * потребує від матеріалу, крім `vertexColors`.
 *
 * Дуга ПОЛОГА: тіла стоять позаду рифа півколом, а не кільцем навколо
 * нього. Кільце читалось би огорожею, а треба — далекий берег.
 */
export function buildReefBackdropGeometry(
  parts: readonly ReefBackdropPart[],
  options: ReefBackdropOptions,
): BufferGeometry {
  const positions: number[] = [];
  const colours: number[] = [];
  const indices: number[] = [];

  parts.forEach((part, index) => {
    const share = parts.length === 1 ? 0.5 : index / (parts.length - 1);
    /*
     * Дуга починається за рифом і йде назад в обидва боки. Зсув на
     * півдуги ставить середину набору строго позаду — тобто там, де на
     * телефоні найбільше порожньої води.
     */
    const angle = Math.PI / 2 + (share - 0.5) * options.spread;
    /*
     * Відстань і розмір гуляють, бо рівний ряд однакових тіл на
     * однаковій відстані читається парканом. Обидва — з насіння пари:
     * далекий берег у неї свій, але той самий щоразу.
     */
    const away = options.distance * (0.82 + 0.36 * unit(options.seed, index));
    const size = options.scale * (0.7 + 0.6 * unit(options.seed, index + 64));
    const spin = unit(options.seed, index + 128) * Math.PI * 2;
    /*
     * ТІЛО СТАВИТЬСЯ НА ДНО, А НЕ В НУЛЬ СВОГО ВУЗЛА.
     *
     * Початок координат у набору — усередині тіла, тож без цього половина
     * кожного корала опинялась би під піском, а половина висіла б над ним.
     * Найнижча точка зводиться до нуля, а тоді тіло топиться на частку
     * власної висоти: корал, що стоїть рівно на площині, читається
     * наліпкою — те саме, за що заплачено в кроці 6.
     */
    let lowest = Number.POSITIVE_INFINITY;
    let highest = Number.NEGATIVE_INFINITY;
    for (let at = 1; at < part.positions.length; at += 3) {
      lowest = Math.min(lowest, part.positions[at]!);
      highest = Math.max(highest, part.positions[at]!);
    }
    const tall = Math.max(1e-6, highest - lowest);
    const base = positions.length / 3;
    const cos = Math.cos(spin);
    const sin = Math.sin(spin);
    const originX = Math.cos(angle) * away;
    const originZ = Math.sin(angle) * away;

    for (let at = 0; at < part.positions.length; at += 3) {
      const x = part.positions[at]! * size;
      const y = part.positions[at + 1]! * size;
      const z = part.positions[at + 2]! * size;
      positions.push(
        originX + x * cos - z * sin,
        y - (lowest + tall * (options.sink ?? 0.12)) * size,
        originZ + x * sin + z * cos,
      );
      colours.push(part.colour[0], part.colour[1], part.colour[2]);
    }
    for (const value of part.indices) indices.push(base + value);
  });

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(colours), 3));
  geometry.setIndex(new BufferAttribute(new Uint32Array(indices), 1));
  /*
   * Нормалей немає навмисно: шар малюється `MeshBasicMaterial` у тумані,
   * тобто світло на нього не падає взагалі. Нормалі були б третиною
   * буфера, яку ніхто не читає.
   */
  geometry.computeBoundingSphere();
  return geometry;
}
