// ============================================================
// Хитання листя — на відеокарті, а не на процесорі.
// ------------------------------------------------------------
// ЩО ТУТ БУЛО ДО ЦЬОГО. `applyThreeTreeLifeFrame` щокадру проходив усі
// листки, розкладав кватерніон кожного, домножував на дельту, збирав
// матрицю назад і піднімав `instanceMatrix.needsUpdate`. На живих даних
// це 651 листок за кадр плюс відправка всього буфера матриць на відео —
// єдина покадрова витрата всієї сцени дерева.
//
// ЩО ЗМІНИЛОСЬ. Профіль хитання листка незмінний: швидкість, фаза й дві
// амплітуди. Незмінне можна покласти в атрибут інстанса ОДИН раз, а за
// кадр міняти рівно два однострої — час і масштаб. Решту рахує вершинний
// шейдер, для якого це кілька синусів на вершину.
//
// ЗАКОН ПРИ ЦЬОМУ НЕ ЗМІНИВСЯ. Формулу дає `treeLeafSwayAt` у томі життя,
// а GLSL нижче збирається з ТИХ САМИХ констант. Одне джерело, дві мови;
// `treeLife.test.ts` поруч тримає їх разом числом, а не обіцянкою: 288
// звірок нової формули зі старою матричною, збіг до шостого знака.
// ============================================================
import * as THREE from 'three';
import {
  TREE_LEAF_PITCH_PHASE_OFFSET,
  TREE_LEAF_PITCH_PHASE_RATIO,
  type TreeLifeState,
} from '../../treeLife';

export const TREE_LEAF_SWAY_VERSION = 'tree-leaf-sway-v1';

/** Ім'я атрибута інстанса: (швидкість, фаза, амплітуда тангажу, амплітуда крену). */
export const TREE_LEAF_SWAY_ATTRIBUTE = 'aLeafSway';

export interface TreeLeafSwayUniforms {
  uLeafSwayTime: { value: number };
  uLeafSwayScale: { value: number };
}

/**
 * Оголошення для вершинного шейдера листя.
 *
 * `swayMatrix` — це матриця обертання three.js для Ейлера XYZ із нульовим Y,
 * тобто рівно `Rx · Rz`, у тому самому порядку, у якому її будував процесор
 * (`Quaternion.setFromEuler(new Euler(pitch, 0, roll, 'XYZ'))`). Порядок тут
 * не косметика: при ненульових обох кутах `Rz · Rx` дає інший нахил, і
 * помітити це на око неможливо.
 */
export const TREE_LEAF_SWAY_VERTEX_PARS = /* glsl */ `
attribute vec4 ${TREE_LEAF_SWAY_ATTRIBUTE};
uniform float uLeafSwayTime;
uniform float uLeafSwayScale;

mat3 treeLeafSwayMatrix( float pitch, float roll ) {
  float a = cos( pitch );
  float b = sin( pitch );
  float e = cos( roll );
  float f = sin( roll );
  return mat3(
    vec3( e, a * f, b * f ),
    vec3( -f, a * e, b * e ),
    vec3( 0.0, -b, a )
  );
}
`;

/*
 * ДВА ВСТАВЛЕННЯ, А НЕ ОДНЕ — І ЦЕ НЕ СТИЛЬ, А ПОРЯДОК ШЕЙДЕРА.
 *
 * Перша редакція вставляла все одним шматком після `beginnormal_vertex` і
 * зверталась там до `transformed`. Шейдер не зібрався, і портал показав
 * дерево БЕЗ ЖОДНОГО ЛИСТКА — крона просто зникла. Жоден тест на TypeScript
 * цього не бачив і не міг: математику вони перевіряють, GLSL компілює лише
 * відеокарта.
 *
 * Причина в порядку шматків `meshphysical`: `beginnormal_vertex` (рядок 33)
 * оголошує `objectNormal`, а `begin_vertex` (рядок 40) — `transformed`.
 * Отже нахил рахується там, де з'являється нормаль, і застосовується до
 * вершини там, де з'являється вона. Змінні оголошені БЕЗ фігурних дужок
 * навмисно: обидва шматки вбудовуються в одне тіло функції, тож блок
 * сховав би їх від другої вставки.
 */

/** Частина перша: рахує нахил і повертає нормаль. Іде після `beginnormal_vertex`. */
export const TREE_LEAF_SWAY_NORMAL_BODY = /* glsl */ `
#ifdef USE_INSTANCING
  float leafPhase = uLeafSwayTime * ${TREE_LEAF_SWAY_ATTRIBUTE}.x + ${TREE_LEAF_SWAY_ATTRIBUTE}.y;
  float leafPitch = sin( leafPhase * ${TREE_LEAF_PITCH_PHASE_RATIO.toFixed(6)} + ${TREE_LEAF_PITCH_PHASE_OFFSET.toFixed(6)} )
    * ${TREE_LEAF_SWAY_ATTRIBUTE}.z * uLeafSwayScale;
  float leafRoll = sin( leafPhase ) * ${TREE_LEAF_SWAY_ATTRIBUTE}.w * uLeafSwayScale;
  vec3 leafSafeScale = max(
    vec3(
      length( instanceMatrix[ 0 ].xyz ),
      length( instanceMatrix[ 1 ].xyz ),
      length( instanceMatrix[ 2 ].xyz )
    ),
    vec3( 1e-6 )
  );
  mat3 leafSway = treeLeafSwayMatrix( leafPitch, leafRoll );
  objectNormal = normalize( leafSafeScale * ( leafSway * ( objectNormal / leafSafeScale ) ) );
#endif
`;

/**
 * Частина друга: рухає вершину. Іде після `begin_vertex`.
 *
 * ЧОМУ ТУТ ДІЛЕННЯ НА МАСШТАБ, А НЕ ПРОСТО ОБЕРТАННЯ.
 *
 * Процесор рахував так: матриця листка = T · R · Q · S, де S — НЕОДНОРІДНИЙ
 * масштаб картки (ширина, довжина, ширина). Статична матриця інстанса, яка
 * вже лежить у буфері, — це T · R · S. Отже, щоб отримати ту саму точку, до
 * локальної вершини треба застосувати S⁻¹ · Q · S, а не саме Q: обертання й
 * неоднорідний масштаб не переставляються, і «просто обернути position» дало
 * б листок, який під час хитання ще й стискається.
 *
 * Масштаб береться з довжин стовпців матриці інстанса — вона ортогональна з
 * точністю до масштабу, тож зайвого атрибута не треба.
 */
export const TREE_LEAF_SWAY_POSITION_BODY = /* glsl */ `
#ifdef USE_INSTANCING
  transformed = ( leafSway * ( transformed * leafSafeScale ) ) / leafSafeScale;
#endif
`;

/**
 * Однострої, які портал міняє за кадр. Живуть на матеріалі, щоб
 * `onBeforeCompile` міг віддати шейдеру ті самі об'єкти, а не копії.
 */
export function createTreeLeafSwayUniforms(): TreeLeafSwayUniforms {
  return {
    uLeafSwayTime: { value: 0 },
    uLeafSwayScale: { value: 0 },
  };
}

/**
 * Один кадр хитання: два числа замість 651 матриці.
 *
 * `elapsedSeconds` обрізається знизу нулем так само, як у
 * `sampleTreeLifeFrame` — від'ємний час не має означати хитання назад.
 */
export function setThreeTreeLeafSwayFrame(
  uniforms: TreeLeafSwayUniforms,
  life: TreeLifeState,
  elapsedSeconds: number,
  reducedMotion?: boolean,
): void {
  const elapsed = Number.isFinite(elapsedSeconds) ? Math.max(0, elapsedSeconds) : 0;
  const disabled = life.reducedMotion || reducedMotion === true;
  uniforms.uLeafSwayTime.value = elapsed;
  uniforms.uLeafSwayScale.value = disabled ? 0 : life.motionScale;
}

/**
 * Кладе профілі хитання в атрибут інстанса — один раз на побудову сітки.
 *
 * Листки понад `maxLeafProfiles` профілю не мають, і їхні чотири числа
 * лишаються нулями: нульові амплітуди означають нерухомий листок, а не
 * листок із чужим хитанням. Доти вони так само стояли нерухомо, бо кадр
 * просто не містив для них запису — поведінка збережена навмисно.
 */
export function applyThreeTreeLeafSway(
  mesh: THREE.InstancedMesh,
  life: TreeLifeState,
): void {
  const values = new Float32Array(mesh.count * 4);
  for (const leaf of life.leaves) {
    if (leaf.sequence < 0 || leaf.sequence >= mesh.count) continue;
    const offset = leaf.sequence * 4;
    values[offset] = leaf.speed;
    values[offset + 1] = leaf.phaseRad;
    values[offset + 2] = leaf.pitchAmplitudeRad;
    values[offset + 3] = leaf.rollAmplitudeRad;
  }
  mesh.geometry.setAttribute(
    TREE_LEAF_SWAY_ATTRIBUTE,
    new THREE.InstancedBufferAttribute(values, 4),
  );
  mesh.userData['treeLeafSway'] = {
    version: TREE_LEAF_SWAY_VERSION,
    profiles: life.leaves.length,
    instances: mesh.count,
    matrixUpdatesPerFrame: 0,
  };
}
