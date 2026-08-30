import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildTreeLabPreview } from '@/features/home/crystal3d/treeLab/buildTreeLabPreview';
import { sampleTreeLifeFrame, treeLeafSwayAt } from '../../treeLife';
import { createThreeTreeLeafInstancedMesh } from './leafInstances';
import { createThreeTreeMaterialPair } from './treeMaterials';
import { TREE_LEAF_SWAY_ATTRIBUTE } from './treeLeafSway';
import {
  applyThreeTreeLifeFrame,
  createThreeTreeLifeBinding,
} from './treeLife';

/**
 * Те саме, що робить вершинний шейдер, переписане на TypeScript.
 *
 * Це НЕ третя реалізація закону: числа хитання беруться з `treeLeafSwayAt`,
 * спільної для процесора й GLSL. Тут відтворено лише те, чого функція не
 * знає — як цей нахил лягає на вершину: порядок обертання (Ейлер XYZ при
 * нульовому Y, тобто `Rx · Rz`) і спряження неоднорідним масштабом
 * (`S⁻¹ · Q · S`).
 *
 * Саме ці дві речі неможливо перевірити оком: помилка в порядку дає нахил,
 * менший за товщину листка, а забуте спряження — листок, що ледь стискається
 * під час хитання.
 */
function shaderVertex(
  instanceMatrix: THREE.Matrix4,
  local: THREE.Vector3,
  pitch: number,
  roll: number,
): THREE.Vector3 {
  const a = Math.cos(pitch);
  const b = Math.sin(pitch);
  const e = Math.cos(roll);
  const f = Math.sin(roll);
  // Стовпці, як у конструкторі mat3 у GLSL.
  const sway = new THREE.Matrix3().set(
    e, -f, 0,
    a * f, a * e, -b,
    b * f, b * e, a,
  );
  const scale = new THREE.Vector3(
    new THREE.Vector3().setFromMatrixColumn(instanceMatrix, 0).length(),
    new THREE.Vector3().setFromMatrixColumn(instanceMatrix, 1).length(),
    new THREE.Vector3().setFromMatrixColumn(instanceMatrix, 2).length(),
  );
  const adjusted = local.clone().multiply(scale).applyMatrix3(sway).divide(scale);
  return adjusted.applyMatrix4(instanceMatrix);
}

/** Те, що робив процесор до перенесення: матриця з домноженим кватерніоном. */
function cpuVertex(
  instanceMatrix: THREE.Matrix4,
  local: THREE.Vector3,
  pitch: number,
  roll: number,
): THREE.Vector3 {
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  instanceMatrix.decompose(position, quaternion, scale);
  const delta = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(pitch, 0, roll, 'XYZ'),
  );
  const composed = new THREE.Matrix4().compose(
    position,
    quaternion.clone().multiply(delta),
    scale,
  );
  return local.clone().applyMatrix4(composed);
}

describe('Three Tree Life adapter — хитання переїхало на відеокарту', () => {
  it('moves the leaf to exactly where the CPU matrix used to put it', () => {
    /*
     * ГОЛОВНИЙ ТЕСТ ЦІЄЇ ЗМІНИ.
     *
     * Перенесення закону з процесора в шейдер має рівно один спосіб піти не
     * так тихо: нова формула ставить листок ТРОХИ інакше. «Трохи» тут
     * означає частки міліметра сцени — на екрані не видно нічого, а крона
     * поволі перестає бути тією, яку затвердили.
     *
     * Тому перевірка не «листок рухається», а «листок опиняється РІВНО там,
     * де його ставила стара матриця» — на справжніх профілях, у кількох
     * митях часу, для трьох кутів картки.
     */
    const build = buildTreeLabPreview('medium');
    const materials = createThreeTreeMaterialPair(build.materials);
    const leaves = createThreeTreeLeafInstancedMesh(build.leaves, materials.foliage);
    const instanceMatrix = new THREE.Matrix4();
    const corners = [
      new THREE.Vector3(-0.5, 0, 0.02),
      new THREE.Vector3(0.5, 0.5, -0.03),
      new THREE.Vector3(0, 1, 0),
    ];

    let compared = 0;
    for (const seconds of [0, 0.4, 7.25, 63.5]) {
      for (const leaf of build.life.leaves.slice(0, 24)) {
        leaves.getMatrixAt(leaf.sequence, instanceMatrix);
        const sway = treeLeafSwayAt(leaf, seconds, build.life.motionScale);
        for (const corner of corners) {
          const shader = shaderVertex(instanceMatrix, corner, sway.pitchRad, sway.rollRad);
          const cpu = cpuVertex(instanceMatrix, corner, sway.pitchRad, sway.rollRad);
          expect(shader.x).toBeCloseTo(cpu.x, 6);
          expect(shader.y).toBeCloseTo(cpu.y, 6);
          expect(shader.z).toBeCloseTo(cpu.z, 6);
          compared += 1;
        }
      }
    }
    expect(compared).toBe(4 * 24 * 3);

    leaves.geometry.dispose();
    materials.bark.dispose();
    materials.foliage.dispose();
  });

  it('leaves the instance matrices alone and drives two uniforms instead', () => {
    /*
     * Тут стояло `expect(moved.elements).not.toEqual(base.elements)` — тобто
     * тест ВИМАГАВ, щоб матриці листя мінялись щокадру. Це була правда про
     * стару реалізацію й ціна, яку вона брала: 651 матриця за кадр плюс
     * відправка всього буфера на відео.
     *
     * Тепер правда протилежна, і перевіряється саме вона: буфер матриць
     * незмінний, а кадр несуть два однострої.
     */
    const build = buildTreeLabPreview('medium');
    const materials = createThreeTreeMaterialPair(build.materials);
    const leaves = createThreeTreeLeafInstancedMesh(build.leaves, materials.foliage);
    const root = new THREE.Group();
    root.add(leaves);
    const binding = createThreeTreeLifeBinding(root, leaves, build.life);

    const base = new THREE.Matrix4();
    const after = new THREE.Matrix4();
    leaves.getMatrixAt(0, base);

    applyThreeTreeLifeFrame(
      binding,
      sampleTreeLifeFrame({ life: build.life, elapsedSeconds: 7.25 }),
      build.life,
    );
    leaves.getMatrixAt(0, after);

    expect(after.elements).toEqual(base.elements);
    expect(binding.swayUniforms?.uLeafSwayTime.value).toBe(7.25);
    expect(binding.swayUniforms?.uLeafSwayScale.value).toBe(build.life.motionScale);
    expect(binding.root.userData['treeLife']).toMatchObject({
      leafInstances: build.leaves.instances.length,
      additionalDrawCalls: 0,
      matrixUpdatesPerFrame: 0,
    });
    // Крона таки хитається — інакше «матриці не мінялись» було б правдою і
    // для дерева, яке просто стоїть.
    expect(
      Math.abs(root.rotation.x) + Math.abs(root.rotation.y) + Math.abs(root.rotation.z),
    ).toBeGreaterThan(0);

    leaves.geometry.dispose();
    materials.bark.dispose();
    materials.foliage.dispose();
  });

  it('stops the canopy dead when motion is reduced', () => {
    // Доступність: `uLeafSwayScale` нуль означає, що шейдер множить обидві
    // амплітуди на нуль — тобто листок стоїть, а не хитається повільніше.
    const build = buildTreeLabPreview('medium');
    const materials = createThreeTreeMaterialPair(build.materials);
    const leaves = createThreeTreeLeafInstancedMesh(build.leaves, materials.foliage);
    const root = new THREE.Group();
    root.add(leaves);
    const binding = createThreeTreeLifeBinding(root, leaves, build.life);

    applyThreeTreeLifeFrame(
      binding,
      sampleTreeLifeFrame({
        life: build.life,
        elapsedSeconds: 7.25,
        reducedMotion: true,
      }),
      build.life,
      true,
    );

    expect(binding.swayUniforms?.uLeafSwayScale.value).toBe(0);
    expect(root.rotation.x).toBe(0);
    expect(root.rotation.y).toBe(0);
    expect(root.rotation.z).toBe(0);

    leaves.geometry.dispose();
    materials.bark.dispose();
    materials.foliage.dispose();
  });

  it('gives every leaf its own profile, and the unprofiled ones stillness', () => {
    /*
     * Атрибут будується за `sequence`, а профілів менше, ніж листків
     * (`maxLeafProfiles`). Листок без профілю мусить лишитись НЕРУХОМИМ —
     * нулі в амплітудах, — а не дістати чужі числа через зсув індексу.
     * Помилка на одиницю тут дала б крону, де кожен листок хитається за
     * сусіда, і побачити це неможливо.
     */
    const build = buildTreeLabPreview('medium');
    const materials = createThreeTreeMaterialPair(build.materials);
    const leaves = createThreeTreeLeafInstancedMesh(build.leaves, materials.foliage);
    const root = new THREE.Group();
    root.add(leaves);
    createThreeTreeLifeBinding(root, leaves, build.life);

    const attribute = leaves.geometry.getAttribute(TREE_LEAF_SWAY_ATTRIBUTE);
    expect(attribute).toBeDefined();
    expect(attribute.count).toBe(leaves.count);

    for (const leaf of build.life.leaves) {
      expect(attribute.getX(leaf.sequence)).toBeCloseTo(leaf.speed, 6);
      expect(attribute.getY(leaf.sequence)).toBeCloseTo(leaf.phaseRad, 6);
      expect(attribute.getZ(leaf.sequence)).toBeCloseTo(leaf.pitchAmplitudeRad, 6);
      expect(attribute.getW(leaf.sequence)).toBeCloseTo(leaf.rollAmplitudeRad, 6);
    }

    const profiled = new Set(build.life.leaves.map((leaf) => leaf.sequence));
    for (let index = 0; index < leaves.count; index += 1) {
      if (profiled.has(index)) continue;
      expect(attribute.getZ(index)).toBe(0);
      expect(attribute.getW(index)).toBe(0);
    }

    leaves.geometry.dispose();
    materials.bark.dispose();
    materials.foliage.dispose();
  });
});
