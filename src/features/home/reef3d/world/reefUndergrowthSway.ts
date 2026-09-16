// ============================================================
// Гойдання водоростей — на відеокарті, як і хитання листя.
// ------------------------------------------------------------
// ТА САМА ВАДА, ЩО В ДЕРЕВА, ЗНАЙДЕНА ТИМ САМИМ ВИМІРЮВАННЯМ. Рифова
// зелень перебудовувала матрицю КОЖНОГО тіла на кожному кадрі: поставити
// на місце (позиція, два кватерніони, масштаб, збірка матриці), докрутити
// нахил течії, зібрати матрицю вдруге, записати — і відправити весь буфер
// на відео.
//
// Виміряно живим розкладом сцени: гойдаються 59 стрічок і 18 водоростей,
// тобто 77 тіл за кадр. Це у вісім разів менше за 651 листок дерева, але
// це ОСТАННЯ покадрова робота процесора в порталі, і кожне тіло тут
// дорожче за листок: дві збірки матриці замість однієї.
//
// ЧОМУ ТУТ ПРОСТІШЕ, НІЖ У ДЕРЕВА. Листок має НЕОДНОРІДНИЙ масштаб
// (ширина, довжина, ширина), і обертання з ним не переставляється — там
// довелось спрягати, `S⁻¹ · Q · S`. Тут `place` ставить `scale.setScalar`,
// тобто масштаб однорідний, а з ним обертання переставляється вільно.
// Отже досить обернути локальну вершину — і це не спрощення на око, а
// наслідок того, що робить `place`.
// ============================================================
import * as THREE from 'three';
import {
  patchReefStoneShader,
  reefStoneCacheKey,
  reefStoneTextures,
  type ReefStoneOptions,
} from './reefStoneSurface';

/**
 * Зерно кожного роду дрібноти, або його відсутність.
 *
 * **Камінець і кулька** — тіла з поверхнею, і зерно робить із них камінь
 * та губку. **Стрічка й водорість** його НЕ беруть: у площини без товщини
 * немає поверхні, яку можна вкрити, а триплан на ній дав би зерно, що
 * повзе по стрічці при гойданні — рух, якого в рослини не буває.
 */
const REEF_GROWTH_GRAIN: Readonly<Record<string, ReefStoneOptions>> = {
  tuft: { scale: 34, strength: 0.6, roughness: 0.5 },
  pebble: { scale: 30, strength: 0.85, roughness: 0.8 },
};

export const REEF_SWAY_VERSION = 'reef-undergrowth-sway-v1';

/** Ім'я атрибута інстанса: фаза гойдання цього тіла. */
export const REEF_SWAY_ATTRIBUTE = 'aReefSway';

/**
 * Розмах і темп течії.
 *
 * Числа переїхали сюди з `ReefUndergrowth.tsx` без зміни: течія йде в один
 * бік, як і належить течії, і саме ці значення вже стоять на екрані.
 */
export const REEF_SWAY_ANGLE = 0.16;
export const REEF_SWAY_RATE = 0.55;

/** Стрічка гойдається слабше за водорість — так було й лишається. */
export function reefSwayAmplitude(kind: string): number {
  return REEF_SWAY_ANGLE * (kind === 'weed' ? 1 : 0.45);
}

export interface ReefSwayUniforms {
  uReefSwayTime: { value: number };
  uReefSwayAmplitude: { value: number };
}

/**
 * Обертання навколо локальної осі Z — рівно те, що робив
 * `Object3D.rotateOnAxis(new Vector3(0, 0, 1), lean)`.
 *
 * `rotateOnAxis` домножує кватерніон СПРАВА, тобто крутить у власному
 * просторі тіла. Тому й тут вершина обертається до матриці інстанса, а не
 * після неї: після неї це був би поворот у просторі сцени, і вся зелень
 * лягла б в один бік світу замість того, щоб кожна хилилась у свій.
 */
export const REEF_SWAY_VERTEX_PARS = /* glsl */ `
attribute float ${REEF_SWAY_ATTRIBUTE};
uniform float uReefSwayTime;
uniform float uReefSwayAmplitude;
`;

export const REEF_SWAY_VERTEX_BODY = /* glsl */ `
#ifdef USE_INSTANCING
  float reefLean = sin( uReefSwayTime * ${REEF_SWAY_RATE.toFixed(6)} + ${REEF_SWAY_ATTRIBUTE} )
    * uReefSwayAmplitude;
  float reefCos = cos( reefLean );
  float reefSin = sin( reefLean );
  transformed = vec3(
    transformed.x * reefCos - transformed.y * reefSin,
    transformed.x * reefSin + transformed.y * reefCos,
    transformed.z
  );
  objectNormal = vec3(
    objectNormal.x * reefCos - objectNormal.y * reefSin,
    objectNormal.x * reefSin + objectNormal.y * reefCos,
    objectNormal.z
  );
#endif
`;

export function createReefSwayUniforms(amplitude: number): ReefSwayUniforms {
  return {
    uReefSwayTime: { value: 0 },
    uReefSwayAmplitude: { value: amplitude },
  };
}

/**
 * Матеріал зелені з гойданням усередині.
 *
 * Окремого «течієвого» матеріалу не заводимо: він коштував би зайвий
 * draw call на кожен вид, а видів чотири. Гойдання додається в той самий
 * стандартний матеріал, яким зелень і малювалась.
 */
export function createReefGrowthMaterial(
  kind: string,
  sway: boolean,
): { material: THREE.MeshStandardMaterial; uniforms: ReefSwayUniforms | null } {
  const material = new THREE.MeshStandardMaterial({
    roughness: kind === 'pebble' ? 0.95 : 0.72,
    side: kind === 'weed' || kind === 'blade' ? THREE.DoubleSide : THREE.FrontSide,
    metalness: 0,
    /*
     * ТОН ГРАНІ (ADR-0191) і колір інстанса живуть разом, не замість.
     * Three множить їх в один `vColor`: відтінок приходить ззовні, на
     * інстанс, а тон — із самої геометрії. Без цього прапорця атрибут
     * кольору мовчки не потрапляє в шейдер, і дрібнота лишається
     * пласкою, хоч тон і порахований.
     */
    vertexColors: true,
  });
  /*
   * ЗЕРНО Й ДРІБНОТІ (ADR-0195 §7 закрито).
   *
   * ADR-0195 лишив це названою межею: «кулька й стрічка досі читаються
   * кольоровими фішками». На знімку під сімкратним збільшенням це видно
   * буквально — камінь поруч зернистий, а кулька гладка, як наліпка.
   *
   * Межа трималась на двох речах, і обидві тут зняті:
   *  - триплан рахував світову точку з `transformed`, тобто ДО матриці
   *    інстанса, і всі двісті одиниць брали зерно з тієї самої точки
   *    текстури (виправлено в `REEF_STONE_VERTEX_BODY`);
   *  - `onBeforeCompile` у матеріалу один, і друге присвоєння стерло б
   *    гойдання течії — тому патч тепер компонується, а не привласнює.
   *
   * Масштаб зерна СВІЙ у кожного роду, і це не смак: тіло кульки
   * завширшки 0.06 одиниці сцени проти 1.5 у купола, тож те саме число
   * дало б на ній одну пляму на все тіло.
   */
  const stone = reefStoneTextures();
  const grain = stone === null ? null : REEF_GROWTH_GRAIN[kind] ?? null;

  if (!sway && grain === null) return { material, uniforms: null };

  const uniforms = sway ? createReefSwayUniforms(reefSwayAmplitude(kind)) : null;
  material.onBeforeCompile = (shader) => {
    if (stone !== null && grain !== null) patchReefStoneShader(shader, stone, grain);
    if (uniforms === null) return;
    shader.uniforms['uReefSwayTime'] = uniforms.uReefSwayTime;
    shader.uniforms['uReefSwayAmplitude'] = uniforms.uReefSwayAmplitude;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${REEF_SWAY_VERTEX_PARS}`)
      /*
       * ПІСЛЯ `begin_vertex`, А НЕ `beginnormal_vertex`.
       *
       * У дерева ця вставка коштувала зниклої крони: `beginnormal_vertex`
       * оголошує `objectNormal`, а `transformed` з'являється аж у
       * `begin_vertex`, тобто НИЖЧЕ. Тут обидві потрібні разом, тож вставка
       * стоїть у нижчій з двох — там уже оголошені обидві.
       */
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>\n${REEF_SWAY_VERTEX_BODY}`,
      );
  };
  material.customProgramCacheKey = () => (
    `${REEF_SWAY_VERSION}|${kind}|${grain === null ? 'plain' : reefStoneCacheKey(grain)}`
  );
  return { material, uniforms };
}

/** Кладе фази в атрибут інстанса — один раз на побудову сітки. */
export function applyReefSwayPhases(
  mesh: THREE.InstancedMesh,
  phases: readonly number[],
): void {
  const values = new Float32Array(mesh.count);
  for (let index = 0; index < mesh.count; index += 1) {
    values[index] = phases[index] ?? 0;
  }
  mesh.geometry.setAttribute(
    REEF_SWAY_ATTRIBUTE,
    new THREE.InstancedBufferAttribute(values, 1),
  );
}

/**
 * Один кадр течії: одне число замість 77 матриць.
 *
 * При зменшеній анімації розмах — нуль, тобто зелень СТОЇТЬ.
 *
 * Доти вона гойдалась завжди: `ReefUndergrowth` єдиний зі своїх сусідів не
 * діставав `reduceMotion` — і риби, і порошинки, і згасання орбіти його
 * поважали, а зелень ні. Це не наслідок перенесення в шейдер, а вада, яку
 * воно виявило.
 */
export function setReefSwayFrame(
  uniforms: ReefSwayUniforms,
  kind: string,
  elapsedSeconds: number,
  reduceMotion: boolean,
): void {
  const elapsed = Number.isFinite(elapsedSeconds) ? Math.max(0, elapsedSeconds) : 0;
  uniforms.uReefSwayTime.value = elapsed;
  uniforms.uReefSwayAmplitude.value = reduceMotion ? 0 : reefSwayAmplitude(kind);
}
