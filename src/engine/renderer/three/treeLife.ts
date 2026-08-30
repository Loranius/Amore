import * as THREE from 'three';
import type { TreeLifeFrame, TreeLifeState } from '../../treeLife';
import {
  applyThreeTreeLeafSway,
  setThreeTreeLeafSwayFrame,
  type TreeLeafSwayUniforms,
} from './treeLeafSway';

export interface ThreeTreeLifeBinding {
  root: THREE.Object3D;
  leafMesh: THREE.InstancedMesh;
  /**
   * Однострої хитання листя, узяті з матеріалу крони.
   *
   * `null` означає, що матеріал не пройшов через `applyFoliageSurfaceShader`
   * — тоді листя просто стоїть, а не падає. Крона без вітру виглядає тихою;
   * крона, що кинула виняток, не виглядає ніяк.
   */
  swayUniforms: TreeLeafSwayUniforms | null;
}

function readSwayUniforms(mesh: THREE.InstancedMesh): TreeLeafSwayUniforms | null {
  const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  const uniforms = material?.userData?.['treeLeafSwayUniforms'] as
    TreeLeafSwayUniforms | undefined;
  return uniforms ?? null;
}

/**
 * Готує крону до хитання: профілі лягають в атрибут інстанса ОДИН раз.
 *
 * ЩО ТУТ БУЛО. Прив'язка знімала базові матриці всіх листків, щоб потім
 * щокадру їх розкладати, домножувати й збирати назад. Того більше немає:
 * незмінне (швидкість, фаза, амплітуди) поїхало в атрибут, змінне (час і
 * масштаб) стало двома одностроями, а матриці інстансів лишились статичними.
 */
export function createThreeTreeLifeBinding(
  root: THREE.Object3D,
  leafMesh: THREE.InstancedMesh,
  life: TreeLifeState,
): ThreeTreeLifeBinding {
  applyThreeTreeLeafSway(leafMesh, life);
  // Статичні: буфер матриць більше не переписується жодного кадру.
  leafMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);

  root.userData['treeLife'] = {
    leafInstances: leafMesh.count,
    additionalDrawCalls: 0,
    matrixUpdatesPerFrame: 0,
  };

  return { root, leafMesh, swayUniforms: readSwayUniforms(leafMesh) };
}

/**
 * Один кадр: поворот крони цілком і два числа для листя.
 *
 * Гілка лишається на процесорі навмисно — це ТРИ числа на все дерево, і
 * вершинний шейдер тут не заощадив би нічого, зате додав би другий шлях до
 * того самого повороту.
 *
 * ADR-0008 і далі чинний: дерево повертається й дихає, але не переїжджає.
 */
export function applyThreeTreeLifeFrame(
  binding: ThreeTreeLifeBinding,
  frame: TreeLifeFrame,
  life: TreeLifeState,
  reducedMotion?: boolean,
): void {
  binding.root.rotation.set(
    frame.branchRotationX,
    frame.branchRotationY,
    frame.branchRotationZ,
  );
  if (binding.swayUniforms) {
    setThreeTreeLeafSwayFrame(
      binding.swayUniforms,
      life,
      frame.elapsedSeconds,
      reducedMotion,
    );
  }
}
