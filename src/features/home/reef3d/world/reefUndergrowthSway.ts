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
    flatShading: true,
  });
  if (!sway) return { material, uniforms: null };

  const uniforms = createReefSwayUniforms(reefSwayAmplitude(kind));
  material.onBeforeCompile = (shader) => {
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
  material.customProgramCacheKey = () => `${REEF_SWAY_VERSION}|${kind}`;
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
