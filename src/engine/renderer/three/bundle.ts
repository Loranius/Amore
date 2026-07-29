import * as THREE from 'three';
import type { CrystalGeometryState } from '../../geometry';
import type { CrystalLifeFrame } from '../../life';
import type { CrystalMaterialState } from '../../material';
import { createThreeCrystalGeometry } from './bufferGeometry';
import { createThreeCrystalMaterial } from './material';

export interface ThreeCrystalRenderBundle {
  group: THREE.Group;
  meshes: ReadonlyMap<string, THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>>;
  materials: ReadonlyMap<string, THREE.MeshPhysicalMaterial>;
  dispose: () => void;
}

export function createThreeCrystalRenderBundle(
  geometryState: CrystalGeometryState,
  materialState: CrystalMaterialState,
): ThreeCrystalRenderBundle {
  if (geometryState.artifactSeed !== materialState.artifactSeed) {
    throw new Error('Three crystal renderer received states from different artifacts.');
  }

  const materialByBodyId = new Map(materialState.bodies.map((body) => [body.bodyId, body] as const));
  const group = new THREE.Group();
  group.name = 'Amore Evolution Crystal';
  group.userData['evolutionArtifactSeed'] = geometryState.artifactSeed;
  const meshes = new Map<string, THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>>();
  const materials = new Map<string, THREE.MeshPhysicalMaterial>();

  for (const meshData of geometryState.meshes) {
    const materialStateForBody = materialByBodyId.get(meshData.bodyId);
    if (!materialStateForBody) continue;
    const geometry = createThreeCrystalGeometry(meshData);
    const material = createThreeCrystalMaterial(materialStateForBody);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `Evolution crystal ${meshData.bodyId}`;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.userData['evolutionBodyId'] = meshData.bodyId;
    group.add(mesh);
    meshes.set(meshData.bodyId, mesh);
    materials.set(meshData.bodyId, material);
  }

  return {
    group,
    meshes,
    materials,
    dispose: () => {
      for (const mesh of meshes.values()) mesh.geometry.dispose();
      for (const material of materials.values()) material.dispose();
      group.clear();
    },
  };
}

export function applyCrystalLifeFrame(
  bundle: ThreeCrystalRenderBundle,
  frame: CrystalLifeFrame,
): void {
  bundle.group.rotation.set(frame.tiltX, frame.rotationY, frame.tiltZ);
  bundle.group.position.y = frame.positionY;
  bundle.group.scale.setScalar(frame.groupScale);

  for (const [bodyId, material] of bundle.materials) {
    const base = Number(material.userData['evolutionBaseEmissiveIntensity'] ?? material.emissiveIntensity);
    const multiplier = frame.bodyGlowMultiplier[bodyId] ?? 1;
    material.emissiveIntensity = base * multiplier;
  }
}
