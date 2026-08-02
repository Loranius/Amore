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

export interface ThreeCrystalFit {
  sourceCenter: THREE.Vector3;
  sourceSize: THREE.Vector3;
  scale: number;
  targetHeight: number;
  targetWidth: number;
  /** Scale a fully grown crystal receives; smaller ones stay proportionally smaller. */
  referenceScale: number;
  /** True when the crystal was large enough to be clamped down to fit the frame. */
  clamped: boolean;
}

export interface ThreeCrystalRenderBundle {
  /** Life transforms are applied only to this root. */
  group: THREE.Group;
  /** Static renderer-only centering/fit transform. */
  content: THREE.Group;
  batches: readonly ThreeCrystalBatch[];
  /** Body lookup remains available for diagnostics and interaction tests. */
  meshes: ReadonlyMap<string, THREE.BatchedMesh>;
  materials: ReadonlyMap<string, THREE.MeshPhysicalMaterial>;
  drawCallCount: number;
  fit: ThreeCrystalFit;
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

/**
 * Engine-unit size of a fully grown crystal — the one that should just about
 * fill the frame. These are reference points for scaling, not limits: anything
 * larger is still clamped to fit.
 *
 * Re-anchored for ADR-0004 and again after the monarch curve was lowered.
 * Measured across ages, a three-and-a-half-year couple comes out about 1.1
 * wide and 1.0 tall, a ten-year one 1.9 by 1.4, and a twenty-year one 2.7 by
 * 1.6. The reference sits near a mature couple so a typical one fills the
 * frame well and an old one is bigger still.
 */
const REFERENCE_HEIGHT = 1.4;
const REFERENCE_WIDTH = 2;

const TARGET_HEIGHT = 3.25;
/**
 * Deliberately wider than the height target. The frame's real horizontal
 * limit is the camera, which backs off for a wide artifact; making this the
 * binding constraint too clamped a twenty-year druse so hard that it rendered
 * *shorter* than a ten-year one — growth running backwards.
 */
const TARGET_WIDTH = 5;

/**
 * Scene-space height of the plane the artifact stands on — engine y=0 after the
 * fit transform. Exported because the portal environment has to put its floor
 * on exactly this line: a platform even slightly off would either float above
 * the substrate or slice through it.
 */
export const CRYSTAL_GROUND_BASELINE = 0.06 - TARGET_HEIGHT * 0.5;

function fitCrystalContent(content: THREE.Group, batches: readonly ThreeCrystalBatch[]): ThreeCrystalFit {
  const bounds = new THREE.Box3();
  let hasBounds = false;
  for (const batch of batches) {
    const batchBounds = batch.mesh.boundingBox;
    if (batchBounds === null || batchBounds.isEmpty()) continue;
    bounds.union(batchBounds);
    hasBounds = true;
  }

  const sourceCenter = hasBounds ? bounds.getCenter(new THREE.Vector3()) : new THREE.Vector3();
  const sourceSize = hasBounds ? bounds.getSize(new THREE.Vector3()) : new THREE.Vector3(1, 1, 1);
  const targetHeight = TARGET_HEIGHT;
  const targetWidth = TARGET_WIDTH;
  const safeHeight = Math.max(0.001, sourceSize.y);
  const safeHorizontal = Math.max(0.001, sourceSize.x, sourceSize.z);

  // Scaling every crystal to fill the frame made all of them the same size on
  // screen, which silently cancelled the one thing the artifact is supposed to
  // communicate: how long the couple has been together. A young crystal is
  // genuinely smaller than an old one in engine units, so the fit uses a fixed
  // reference instead — a fully grown crystal fills the frame, everything
  // younger stays proportionally smaller.
  const referenceScale = Math.min(
    targetHeight / REFERENCE_HEIGHT,
    targetWidth / REFERENCE_WIDTH,
  );
  // The frame is still a hard limit: an unusually large crystal (a very long
  // relationship, or an unusually wide spread of companions) is clamped down
  // rather than allowed to overflow.
  const containScale = Math.min(targetHeight / safeHeight, targetWidth / safeHorizontal);
  const scale = Math.min(referenceScale, containScale);
  const clamped = containScale < referenceScale;

  // Anchor the substrate plane rather than the bounding box. Centring made a
  // small crystal float in the middle of the frame; standing every crystal on
  // the same ground line is what makes a short one read as "still growing"
  // instead of merely "far away".
  const groundBaseline = CRYSTAL_GROUND_BASELINE;

  content.scale.setScalar(scale);
  content.position.set(
    -sourceCenter.x * scale,
    groundBaseline,
    -sourceCenter.z * scale,
  );
  content.userData['evolutionFit'] = {
    sourceCenter: sourceCenter.toArray(),
    sourceSize: sourceSize.toArray(),
    scale,
    targetHeight,
    targetWidth,
    referenceScale,
    clamped,
  };

  return {
    sourceCenter,
    sourceSize,
    scale,
    targetHeight,
    targetWidth,
    referenceScale,
    clamped,
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
  const content = new THREE.Group();
  content.name = 'Amore Evolution Crystal fitted content';
  group.add(content);

  const batches = groupByMaterial(geometryState, materialState).map(buildBatch);
  const meshes = new Map<string, THREE.BatchedMesh>();
  const materials = new Map<string, THREE.MeshPhysicalMaterial>();

  for (const batch of batches) {
    content.add(batch.mesh);
    for (const bodyId of batch.bodyIds) {
      meshes.set(bodyId, batch.mesh);
      materials.set(bodyId, batch.material);
    }
  }
  const fit = fitCrystalContent(content, batches);
  group.userData['evolutionDrawCallCount'] = batches.length;

  return {
    group,
    content,
    batches,
    meshes,
    materials,
    drawCallCount: batches.length,
    fit,
    dispose: () => {
      for (const batch of batches) {
        batch.mesh.dispose();
        batch.material.dispose();
      }
      content.clear();
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
