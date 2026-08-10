import * as THREE from 'three';
import type { CrystalGeometryState } from '@/engine/geometry';
import type { CrystalMaterialState } from '@/engine/material';
import { createThreeCrystalGeometry, type ThreeCrystalRenderBundle } from '@/engine/renderer/three';
import {
  buildWishSatellites,
  pickWishDonor,
  wishSatelliteBounds,
  type WishSatelliteQuality,
} from './wishCrystals';

// ============================================================
// Хмара кристалів бажань — рендер того, що розставив `wishCrystals.ts`.
// ------------------------------------------------------------
// **Одна сітка на всіх.** InstancedMesh: дванадцять кристалів коштують один
// draw call, а не дванадцять. §43 називає постійну WebGL-пам'ять першим
// ризиком мобільного, і платити за бажання окремими сітками не варто.
//
// **Мінеральна сім'я — буквально.** §29 просить, щоб бажання належали тій
// самій сім'ї, що й монарх. Тому донор — справжня менша донька цієї пари, а
// не окремо вигадана форма: та сама огранка, ті самі атрибути фасетів, той
// самий матеріал. Нічого не «схоже» — воно те саме.
//
// **Батьківство.** Хмара кріпиться до `bundle.content`, як і внутрішні іскри
// (ADR-0019): саме там живе підгонка. Кріплення до `group` коштувало цьому
// проєкту іскор у небі, і повторювати це вручну щоразу немає потреби — тому
// батьком займається сама фабрика.
// ============================================================

export interface ThreeWishCrystalCloud {
  mesh: THREE.InstancedMesh;
  /** Скільки бажань стоїть за кожним кристалом — для підказок і §30. */
  represents: readonly number[];
  dispose: () => void;
}

export interface WishCrystalCloudInput {
  bundle: ThreeCrystalRenderBundle;
  geometry: CrystalGeometryState;
  material: CrystalMaterialState;
  activeWishes: number;
  quality: WishSatelliteQuality;
}

export function createThreeWishCrystalCloud(
  input: WishCrystalCloudInput,
): ThreeWishCrystalCloud | null {
  const bounds = wishSatelliteBounds(input.geometry);
  const satellites = buildWishSatellites({
    activeWishes: input.activeWishes,
    seed: input.geometry.artifactSeed,
    bounds,
    quality: input.quality,
  });
  if (satellites.length === 0) return null;

  const donor = pickWishDonor(input.geometry);
  if (donor === null) return null;
  const donorMaterial = input.material.bodies.find((body) => body.bodyId === donor.bodyId);
  // `bundle.materials` ключується bodyId — саме тим тілом, у якого ми взяли
  // форму, тож супутники дістають рівно матеріал своєї донорської доньки.
  const shellMaterial = input.bundle.materials.get(donor.bodyId);
  if (donorMaterial === undefined || shellMaterial === undefined) return null;

  const geometry = createThreeCrystalGeometry(donor, donorMaterial, input.geometry.artifactSeed);
  // Донор стоїть там, де росла донька. Для інстансування форму треба
  // повернути у власний початок координат — інакше кожен супутник поїхав би
  // на зміщення тієї доньки поверх свого.
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (box === null) {
    geometry.dispose();
    return null;
  }
  const donorHeight = Math.max(1e-6, box.max.y - box.min.y);
  geometry.translate(
    -(box.min.x + box.max.x) / 2,
    -(box.min.y + box.max.y) / 2,
    -(box.min.z + box.max.z) / 2,
  );

  const mesh = new THREE.InstancedMesh(geometry, shellMaterial, satellites.length);
  mesh.name = 'evolution-wish-crystals';
  // Матеріал спільний із монархом, тож геть його чіпати не можна — але тінь
  // і порядок малювання належать цій хмарі.
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;

  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const scale = new THREE.Vector3();
  const position = new THREE.Vector3();
  for (let index = 0; index < satellites.length; index += 1) {
    const satellite = satellites[index]!;
    position.set(satellite.position[0], satellite.position[1], satellite.position[2]);
    euler.set(satellite.tilt, satellite.rotationY, 0);
    quaternion.setFromEuler(euler);
    // `scale` пози — бажана висота кристала; донор має свою, тож переводимо.
    const factor = satellite.scale / donorHeight;
    scale.set(factor, factor, factor);
    mesh.setMatrixAt(index, matrix.compose(position, quaternion, scale));
  }
  mesh.instanceMatrix.needsUpdate = true;
  input.bundle.content.add(mesh);

  return {
    mesh,
    represents: satellites.map((satellite) => satellite.represents),
    dispose: () => {
      mesh.removeFromParent();
      geometry.dispose();
      // Матеріал спільний із артефактом — його звільняє bundle.dispose().
    },
  };
}
