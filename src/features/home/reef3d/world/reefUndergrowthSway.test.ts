import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  REEF_SWAY_ATTRIBUTE,
  REEF_SWAY_ANGLE,
  REEF_SWAY_RATE,
  applyReefSwayPhases,
  createReefGrowthMaterial,
  createReefSwayUniforms,
  reefSwayAmplitude,
  setReefSwayFrame,
} from './reefUndergrowthSway';

const SWAY_AXIS = new THREE.Vector3(0, 0, 1);

/** Те, що робив процесор: докрутити нахил і зібрати матрицю заново. */
function cpuVertex(
  base: { position: THREE.Vector3; quaternion: THREE.Quaternion; size: number },
  local: THREE.Vector3,
  lean: number,
): THREE.Vector3 {
  const object = new THREE.Object3D();
  object.position.copy(base.position);
  object.quaternion.copy(base.quaternion);
  object.scale.setScalar(base.size);
  object.rotateOnAxis(SWAY_AXIS, lean);
  object.updateMatrix();
  return local.clone().applyMatrix4(object.matrix);
}

/** Те, що робить шейдер: обернути локальну вершину до матриці інстанса. */
function shaderVertex(
  base: { position: THREE.Vector3; quaternion: THREE.Quaternion; size: number },
  local: THREE.Vector3,
  lean: number,
): THREE.Vector3 {
  const instanceMatrix = new THREE.Matrix4().compose(
    base.position,
    base.quaternion,
    new THREE.Vector3(base.size, base.size, base.size),
  );
  const cos = Math.cos(lean);
  const sin = Math.sin(lean);
  const swayed = new THREE.Vector3(
    local.x * cos - local.y * sin,
    local.x * sin + local.y * cos,
    local.z,
  );
  return swayed.applyMatrix4(instanceMatrix);
}

describe('гойдання зелені рифа — перенесення на відеокарту', () => {
  it('puts the blade exactly where the CPU rotation used to put it', () => {
    /*
     * ГОЛОВНИЙ ТЕСТ ЦІЄЇ ЗМІНИ, і він про ту саму пару речей, що й у дерева:
     * навколо ЯКОЇ осі й у ЯКОМУ просторі.
     *
     * `Object3D.rotateOnAxis` домножує кватерніон СПРАВА, тобто крутить у
     * власному просторі тіла. Якщо обернути вершину після матриці інстанса,
     * поворот стане світовим — і вся зелень ляже в один бік сцени замість
     * того, щоб кожна хилилась у свій. На знімку це виглядало б як течія, і
     * помітити підміну оком неможливо.
     *
     * Тут же, на відміну від дерева, спряження масштабом НЕ потрібне: `place`
     * ставить `scale.setScalar`, тобто масштаб однорідний, а з ним обертання
     * переставляється вільно. Тест тримає й це: масштаби нижче різні.
     */
    let compared = 0;
    for (const size of [0.4, 1, 2.7]) {
      for (const spin of [0, 0.9, 2.4, 5.1]) {
        const base = {
          position: new THREE.Vector3(1.3, 0.7, -2.1),
          quaternion: new THREE.Quaternion().setFromEuler(
            new THREE.Euler(0.31, spin, -0.12, 'XYZ'),
          ),
          size,
        };
        for (const seconds of [0, 3.4, 61]) {
          const lean = Math.sin(seconds * REEF_SWAY_RATE + spin) * reefSwayAmplitude('weed');
          for (const local of [
            new THREE.Vector3(0.06, 0, 0),
            new THREE.Vector3(-0.04, 0.9, 0.02),
            new THREE.Vector3(0, 1.6, -0.05),
          ]) {
            const cpu = cpuVertex(base, local, lean);
            const shader = shaderVertex(base, local, lean);
            expect(shader.x).toBeCloseTo(cpu.x, 6);
            expect(shader.y).toBeCloseTo(cpu.y, 6);
            expect(shader.z).toBeCloseTo(cpu.z, 6);
            compared += 1;
          }
        }
      }
    }
    expect(compared).toBe(3 * 4 * 3 * 3);
  });

  it('keeps the current strength of the current', () => {
    // Перенесення, а не переробка вигляду: водорість гойдається на повний
    // розмах, стрічка — на 45% від нього, як і стояло на екрані.
    expect(reefSwayAmplitude('weed')).toBe(REEF_SWAY_ANGLE);
    expect(reefSwayAmplitude('blade')).toBeCloseTo(REEF_SWAY_ANGLE * 0.45, 9);
    expect(reefSwayAmplitude('tuft')).toBeCloseTo(REEF_SWAY_ANGLE * 0.45, 9);
  });

  it('stops the greenery dead when motion is reduced', () => {
    /*
     * ВАДА, ЯКУ ЦЕ ВИПРАВЛЯЄ, А НЕ ЛИШЕ ПЕРЕНОСИТЬ.
     *
     * `ReefUndergrowth` був ЄДИНИМ зі своїх сусідів, хто не діставав
     * `reduceMotion`: риби, порошинки й згасання орбіти його поважали, а
     * зелень гойдалась завжди. Тепер розмах при зменшеній анімації — нуль,
     * тобто зелень стоїть, а не гойдається повільніше.
     */
    const uniforms = createReefSwayUniforms(reefSwayAmplitude('weed'));

    setReefSwayFrame(uniforms, 'weed', 12.5, false);
    expect(uniforms.uReefSwayTime.value).toBe(12.5);
    expect(uniforms.uReefSwayAmplitude.value).toBe(REEF_SWAY_ANGLE);

    setReefSwayFrame(uniforms, 'weed', 12.5, true);
    expect(uniforms.uReefSwayAmplitude.value).toBe(0);

    // Від'ємний час не має означати гойдання назад.
    setReefSwayFrame(uniforms, 'weed', -4, false);
    expect(uniforms.uReefSwayTime.value).toBe(0);
  });

  it('gives every body its own phase, and the still kinds no shader at all', () => {
    // Фаза кожного тіла — його `spinRad`; помилка на одиницю тут дала б
    // зелень, що гойдається за сусіда, і побачити це неможливо.
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3),
    );
    const swaying = createReefGrowthMaterial('weed', true);
    const mesh = new THREE.InstancedMesh(geometry, swaying.material, 3);
    applyReefSwayPhases(mesh, [0.25, 1.75, 4.5]);

    const attribute = mesh.geometry.getAttribute(REEF_SWAY_ATTRIBUTE);
    expect(attribute.count).toBe(3);
    expect(attribute.getX(0)).toBeCloseTo(0.25, 6);
    expect(attribute.getX(1)).toBeCloseTo(1.75, 6);
    expect(attribute.getX(2)).toBeCloseTo(4.5, 6);
    expect(swaying.uniforms).not.toBeNull();

    // Камінь течія не гойдає — і шейдера він не дістає взагалі, тобто не
    // платить за нього ні компіляцією, ні гілкою у вершині.
    const still = createReefGrowthMaterial('pebble', false);
    expect(still.uniforms).toBeNull();
    expect(still.material.onBeforeCompile.length).toBe(0);

    geometry.dispose();
    swaying.material.dispose();
    still.material.dispose();
  });
});
