import * as THREE from 'three';
import type { CrystalGeometryState, CrystalMeshData } from '../../geometry';
import type { CrystalLifeFrame } from '../../life';
import type { CrystalBodyMaterial, CrystalMaterialState } from '../../material';
import { createThreeCrystalGeometry } from './bufferGeometry';
import { createThreeCrystalMaterial } from './material';

export interface ThreeCrystalBatch {
  signature: string;
  mesh: THREE.BatchedMesh;
  material: THREE.MeshPhysicalMaterial;
  bodyIds: readonly string[];
  baseEmissiveIntensity: number;
}

export interface ThreeCrystalRenderBundle {
  group: THREE.Group;
  batches: readonly ThreeCrystalBatch[];
  /** Body lookup remains available for diagnostics and interaction tests. */
  meshes: ReadonlyMap<string, THREE.BatchedMesh>;
  materials: ReadonlyMap<string, THREE.MeshPhysicalMaterial>;
  drawCallCount: number;
  dispose: () => void;
}

interface BatchSource {
  material: CrystalBodyMaterial;
  meshes: CrystalMeshData[];
}

function groupByMaterial(
  geometryState: CrystalGeometryState,
  materialState: CrystalMaterialState,
): BatchSource[] {
  const materialByBodyId = new Map(materialState.bodies.map((body) => [body.bodyId, body] as const));
  const groups = new Map<string, BatchSource>();

  for (const mesh of geometryState.meshes) {
    const material = materialByBodyId.get(mesh.bodyId);
    if (!material) continue;
    const existing = groups.get(material.signature);
    if (existing) existing.meshes.push(mesh);
    else groups.set(material.signature, { material, meshes: [mesh] });
  }

  return [...groups.values()].sort((left, right) =>
    left.material.signature.localeCompare(right.material.signature),
  );
}

function buildBatch(source: BatchSource): ThreeCrystalBatch {
  const maxVertices = source.meshes.reduce((sum, mesh) => sum + mesh.positions.length / 3, 0);
  const maxIndices = source.meshes.reduce((sum, mesh) => sum + mesh.indices.length, 0);
  const material = createThreeCrystalMaterial(source.material);
  const mesh = new THREE.BatchedMesh(source.meshes.length, maxVertices, maxIndices, material);
  mesh.name = `Evolution crystal batch ${source.material.signature.slice(0, 24)}`;
  mesh.perObjectFrustumCulled = false;
  mesh.sortObjects = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;

  const identity = new THREE.Matrix4();
  const bodyIds: string[] = [];
  const copiedGeometries: THREE.BufferGeometry[] = [];

  source.meshes.forEach((meshData, expectedInstanceId) => {
    const geometry = createThreeCrystalGeometry(meshData);
    copiedGeometries.push(geometry);
    const geometryId = mesh.addGeometry(geometry);
    const instanceId = mesh.addInstance(geometryId);
    if (instanceId !== expectedInstanceId) {
      throw new Error(`Evolution BatchedMesh instance order mismatch: ${instanceId} !== ${expectedInstanceId}`);
    }
    mesh.setMatrixAt(instanceId, identity);
    bodyIds.push(meshData.bodyId);
  });

  // BatchedMesh copied the attributes into its own buffers.
  for (const geometry of copiedGeometries) geometry.dispose();
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  mesh.userData['evolutionBodyIds'] = [...bodyIds];
  mesh.userData['evolutionMaterialSignature'] = source.material.signature;

  return {
    signature: source.material.signature,
    mesh,
    material,
    bodyIds,
    baseEmissiveIntensity: source.material.emissiveIntensity,
  };
}

export function createThreeCrystalRenderBundle(
  geometryState: CrystalGeometryState,
  materialState: CrystalMaterialState,
): ThreeCrystalRenderBundle {
  if (geometryState.artifactSeed !== materialState.artifactSeed) {
    throw new Error('Three crystal renderer received states from different artifacts.');
  }

  const group = new THREE.Group();
  group.name = 'Amore Evolution Crystal';
  group.userData['evolutionArtifactSeed'] = geometryState.artifactSeed;
  const batches = groupByMaterial(geometryState, materialState).map(buildBatch);
  const meshes = new Map<string, THREE.BatchedMesh>();
  const materials = new Map<string, THREE.MeshPhysicalMaterial>();

  for (const batch of batches) {
    group.add(batch.mesh);
    for (const bodyId of batch.bodyIds) {
      meshes.set(bodyId, batch.mesh);
      materials.set(bodyId, batch.material);
    }
  }
  group.userData['evolutionDrawCallCount'] = batches.length;

  return {
    group,
    batches,
    meshes,
    materials,
    drawCallCount: batches.length,
    dispose: () => {
      for (const batch of batches) {
        batch.mesh.dispose();
        batch.material.dispose();
      }
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

  // Batched bodies share one material. Preserve deterministic per-body phases
  // by applying their mean glow to the shared optical batch.
  for (const batch of bundle.batches) {
    const multiplier = batch.bodyIds.length === 0
      ? 1
      : batch.bodyIds.reduce(
          (sum, bodyId) => sum + (frame.bodyGlowMultiplier[bodyId] ?? 1),
          0,
        ) / batch.bodyIds.length;
    batch.material.emissiveIntensity = batch.baseEmissiveIntensity * multiplier;
  }
}
