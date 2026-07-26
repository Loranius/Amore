// ============================================================
// batchedBodies — зведення тіл у батчі за матеріалом (draw calls).
// ------------------------------------------------------------
// Вимірювання Phase 5 показало, що вузьке місце кристала на мобільному GPU
// — не трикутники (їх лишається ~1800 після зрізу), а **draw calls**: до
// зміни кожне тіло було окремим мешем із власним матеріалом, тобто 27-42
// виклики на кадр. Заміри розподілу матеріалів: різних наборів параметрів
// усього 6-7, решта тіл їх повторює.
//
// `THREE.BatchedMesh` — саме той інструмент: він тримає РІЗНІ геометрії в
// одному буфері й малює їх одним викликом, зберігаючи власну матрицю для
// кожного екземпляра. Це критично: тіла мають різну кількість граней
// (зріз стику ще й видаляє в кожного своє), тож інстансинг тут не годиться
// — він вимагає однакової геометрії.
//
// Чому не «злити все в один меш». Тому що кожне тіло дихає власною фазою
// (CrystalScene::useFrame). У злитому меші вершини мають один спільний
// трансформ, і подих довелось би переносити у вершинний шейдер. BatchedMesh
// лишає подих там, де він був, — звичайним `setMatrixAt` на екземпляр.
// ============================================================
import * as THREE from 'three';
import type { PublishedBody } from '../crystalPublication';
import { BREATHE_AMPLITUDE, type ClusterMaterial } from '../crystalCluster';
import { bodyMaterialProps, materialSignature } from '../material/bodyMaterial';

export interface BodyBatch {
  /** Ключ матеріалу — стабільний, придатний як React-key. */
  signature: string;
  mesh: THREE.BatchedMesh;
  /** Тіла батча в порядку їхніх instanceId (id === індекс у масиві). */
  bodies: PublishedBody[];
  /** instanceId кожного тіла за ключем — для оновлення матриць. */
  instanceOf: Map<string, number>;
}

const _matrix = new THREE.Matrix4();
const _position = new THREE.Vector3();
const _quaternion = new THREE.Quaternion();
const _scale = new THREE.Vector3(1, 1, 1);

/**
 * Групує опубліковані тіла за матеріалом і будує по одному BatchedMesh на
 * групу. Порядок груп детермінований (за ключем матеріалу), порядок тіл
 * усередині групи — як у публікації, тож між рендерами нічого не «стрибає».
 *
 * Викликач відповідає за `dispose()` — див. `disposeBatches`.
 */
export function buildBodyBatches(
  bodies: readonly PublishedBody[],
  material: ClusterMaterial,
): BodyBatch[] {
  const groups = new Map<string, PublishedBody[]>();
  for (const body of bodies) {
    const signature = materialSignature(bodyMaterialProps(body.branch, material));
    const group = groups.get(signature);
    if (group === undefined) groups.set(signature, [body]);
    else group.push(body);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([signature, group]) => {
      // BatchedMesh вимагає стелі буферів наперед — рахуємо точно, бо весь
      // набір геометрій уже відомий (нічого не додається в рантаймі).
      const vertexCount = group.reduce((s, b) => s + b.geometry.getAttribute('position').count, 0);
      const indexCount = group.reduce((s, b) => s + (b.geometry.getIndex()?.count ?? 0), 0);

      const props = bodyMaterialProps(group[0]!.branch, material);
      const batchMaterial = new THREE.MeshPhysicalMaterial({
        vertexColors: true,
        flatShading: true,
        transmission: 0,
        roughness: props.roughness,
        metalness: props.metalness,
        clearcoat: props.clearcoat,
        clearcoatRoughness: props.clearcoatRoughness,
        ior: props.ior,
        reflectivity: props.reflectivity,
        emissive: new THREE.Color(props.emissive),
        emissiveIntensity: props.emissiveIntensity,
      });

      const mesh = new THREE.BatchedMesh(group.length, vertexCount, indexCount, batchMaterial);
      // Кристал — один невеликий об'єкт у центрі кадру; поекземплярне
      // відсіювання й сортування коштували б більше, ніж дали б.
      mesh.perObjectFrustumCulled = false;
      mesh.sortObjects = false;

      const instanceOf = new Map<string, number>();
      group.forEach((body, i) => {
        const geometryId = mesh.addGeometry(body.geometry);
        const instanceId = mesh.addInstance(geometryId);
        instanceOf.set(body.branch.key, instanceId);
        mesh.setMatrixAt(instanceId, bodyMatrix(body, 1));
        // Порядок id гарантуємо явно: далі код спирається на те, що
        // instanceId дорівнює індексу тіла в групі.
        if (instanceId !== i) throw new Error(`BatchedMesh: несподіваний instanceId ${instanceId} ≠ ${i}`);
      });

      // Межі рахуємо явно. Строго кажучи, three обчислив би їх ліниво при
      // першій перевірці фрустума (перевірено — рейкаст і відсів працюють
      // і без цього виклику), але тоді вони зафіксувалися б на випадковій
      // фазі подиху першого кадру. Тут вони детерміновані, і до радіуса
      // одразу додається запас на подих, який роздуває тіла вже ПІСЛЯ
      // цього обчислення.
      mesh.computeBoundingBox();
      mesh.computeBoundingSphere();
      if (mesh.boundingSphere !== null) mesh.boundingSphere.radius *= 1 + BREATHE_AMPLITUDE;

      return { signature, mesh, bodies: group, instanceOf };
    });
}

/** Світова матриця тіла з поточним подихом (масштаб по власній осі). */
export function bodyMatrix(body: PublishedBody, breatheScale: number): THREE.Matrix4 {
  const b = body.branch;
  _position.set(b.posX, b.posY, b.posZ);
  _quaternion.set(b.quatX, b.quatY, b.quatZ, b.quatW);
  _scale.set(1, breatheScale, 1);
  return _matrix.compose(_position, _quaternion, _scale);
}

/**
 * Мікро-подих кожного тіла власною фазою — те саме, що робив
 * `mesh.scale.set(1, …, 1)` на окремих мешах, лише через матриці
 * екземплярів. Викликається раз на кадр на батч.
 */
export function breatheBatch(batch: BodyBatch, elapsed: number, amplitude: number): void {
  for (let i = 0; i < batch.bodies.length; i++) {
    const body = batch.bodies[i]!;
    const s = 1 + Math.sin(elapsed * body.branch.breatheSpeed + body.branch.breathePhase) * amplitude;
    batch.mesh.setMatrixAt(i, bodyMatrix(body, s));
  }
}

export function disposeBatches(batches: readonly BodyBatch[]): void {
  for (const batch of batches) {
    batch.mesh.dispose();
    (batch.mesh.material as THREE.Material).dispose();
  }
}
