import * as THREE from 'three';
import type { ReefPreviewBuild } from './buildReefPreview';
import {
  allocateReefSurfaceSlots,
  buildReefSurfaceSlotCandidates,
  REEF_SURFACE_SLOT_VERSION,
  type ReefSurfaceSlotDiagnostics,
  type ReefSurfaceSlotRequest,
} from './reefSurfaceSlots';
import {
  collectReefArchSupportMeshes,
  collectReefSupportSlotCandidates,
  collectReefTerrainSupportMeshes,
  raycastReefCoralTerrainSupport,
} from './reefSupportPlacement';
import type {
  ReefBatchRuntimeRange,
  ReefRenderableBatch,
  ReefThreeSceneState,
} from './reefThreeAdapter';

export const REEF_CORAL_SURFACE_PLACEMENT_PASS = 'reef-coral-surface-placement-v3';
const LIVING_CANOPY_SCULPT_PASS = 'reef-living-canopy-sculpt-v1';
const WORLD_UP = new THREE.Vector3(0, 1, 0);

interface RuntimePlacement {
  batch: ReefRenderableBatch;
  runtime: ReefBatchRuntimeRange;
  request: ReefSurfaceSlotRequest;
}

function surfacePointKey(x: number, z: number): string {
  return `${x.toFixed(5)}:${z.toFixed(5)}`;
}

function rescaleRange(
  batch: ReefRenderableBatch,
  runtime: ReefBatchRuntimeRange,
  scale: readonly [number, number, number],
): void {
  const [scaleX, scaleY, scaleZ] = scale;
  const pivot = runtime.motion.pivot;
  let maximumAxialDistance = 1e-6;

  for (
    let index = runtime.range.vertexStart;
    index < runtime.range.vertexStart + runtime.range.vertexCount;
    index += 1
  ) {
    const offset = index * 3;
    const relativeX = (batch.basePositions[offset] ?? pivot.x) - pivot.x;
    const relativeY = (batch.basePositions[offset + 1] ?? pivot.y) - pivot.y;
    const relativeZ = (batch.basePositions[offset + 2] ?? pivot.z) - pivot.z;

    const x = relativeX * scaleX;
    const y = relativeY * scaleY;
    const z = relativeZ * scaleZ;
    batch.basePositions[offset] = pivot.x + x;
    batch.basePositions[offset + 1] = pivot.y + y;
    batch.basePositions[offset + 2] = pivot.z + z;

    const normalX = (batch.baseNormals[offset] ?? 0) / scaleX;
    const normalY = (batch.baseNormals[offset + 1] ?? 1) / scaleY;
    const normalZ = (batch.baseNormals[offset + 2] ?? 0) / scaleZ;
    const normalLength = Math.max(1e-6, Math.hypot(normalX, normalY, normalZ));
    batch.baseNormals[offset] = normalX / normalLength;
    batch.baseNormals[offset + 1] = normalY / normalLength;
    batch.baseNormals[offset + 2] = normalZ / normalLength;

    const axialDistance = Math.max(
      0,
      x * runtime.motion.axis.x
        + y * runtime.motion.axis.y
        + z * runtime.motion.axis.z,
    );
    maximumAxialDistance = Math.max(maximumAxialDistance, axialDistance);
  }

  runtime.maximumAxialDistance = maximumAxialDistance;
}

function translateRange(
  batch: ReefRenderableBatch,
  runtime: ReefBatchRuntimeRange,
  targetPivot: THREE.Vector3,
): void {
  const sourcePivot = runtime.motion.pivot;
  const deltaX = targetPivot.x - sourcePivot.x;
  const deltaY = targetPivot.y - sourcePivot.y;
  const deltaZ = targetPivot.z - sourcePivot.z;

  for (
    let index = runtime.range.vertexStart;
    index < runtime.range.vertexStart + runtime.range.vertexCount;
    index += 1
  ) {
    const offset = index * 3;
    batch.basePositions[offset] = (batch.basePositions[offset] ?? sourcePivot.x) + deltaX;
    batch.basePositions[offset + 1] = (batch.basePositions[offset + 1] ?? sourcePivot.y) + deltaY;
    batch.basePositions[offset + 2] = (batch.basePositions[offset + 2] ?? sourcePivot.z) + deltaZ;
  }

  runtime.motion = {
    ...runtime.motion,
    pivot: {
      x: targetPivot.x,
      y: targetPivot.y,
      z: targetPivot.z,
    },
  };
}

/** Rotates one accepted coral range around its planted pivot onto the support normal. */
function alignRangeToNormal(
  batch: ReefRenderableBatch,
  runtime: ReefBatchRuntimeRange,
  targetNormal: THREE.Vector3,
): void {
  const sourceAxis = new THREE.Vector3(
    runtime.motion.axis.x,
    runtime.motion.axis.y,
    runtime.motion.axis.z,
  ).normalize();
  const targetAxis = targetNormal.clone().normalize();
  if (targetAxis.y < 0) targetAxis.negate();

  if (sourceAxis.distanceToSquared(targetAxis) < 1e-8) return;

  const rotation = new THREE.Quaternion().setFromUnitVectors(sourceAxis, targetAxis);
  const pivot = new THREE.Vector3(
    runtime.motion.pivot.x,
    runtime.motion.pivot.y,
    runtime.motion.pivot.z,
  );
  const position = new THREE.Vector3();
  const normal = new THREE.Vector3();

  for (
    let index = runtime.range.vertexStart;
    index < runtime.range.vertexStart + runtime.range.vertexCount;
    index += 1
  ) {
    const offset = index * 3;
    position.set(
      batch.basePositions[offset] ?? pivot.x,
      batch.basePositions[offset + 1] ?? pivot.y,
      batch.basePositions[offset + 2] ?? pivot.z,
    );
    position.sub(pivot).applyQuaternion(rotation).add(pivot);
    batch.basePositions[offset] = position.x;
    batch.basePositions[offset + 1] = position.y;
    batch.basePositions[offset + 2] = position.z;

    normal.set(
      batch.baseNormals[offset] ?? 0,
      batch.baseNormals[offset + 1] ?? 1,
      batch.baseNormals[offset + 2] ?? 0,
    ).applyQuaternion(rotation).normalize();
    batch.baseNormals[offset] = normal.x;
    batch.baseNormals[offset + 1] = normal.y;
    batch.baseNormals[offset + 2] = normal.z;
  }

  runtime.motion = {
    ...runtime.motion,
    axis: {
      x: targetAxis.x,
      y: targetAxis.y,
      z: targetAxis.z,
    },
  };
}

function sculptRange(
  batch: ReefRenderableBatch,
  runtime: ReefBatchRuntimeRange,
  supportY: number,
): void {
  const crownFactor = supportY > 0.78 ? 0.88 : 1;
  const scaleByMorphotype = {
    branching: [1 * crownFactor, 1.18, 1 * crownFactor],
    massive: [1 * crownFactor, 0.82, 1 * crownFactor],
    plating: [1 * crownFactor, 0.78, 1 * crownFactor],
    encrusting: [1 * crownFactor, 0.58, 1 * crownFactor],
    'soft-coral': [1 * crownFactor, 1.2, 1 * crownFactor],
    'sea-fan': [1 * crownFactor, 1.22, 1 * crownFactor],
  } as const;

  rescaleRange(batch, runtime, scaleByMorphotype[runtime.range.morphotype]);
}

function syncBatchAttributes(batch: ReefRenderableBatch): void {
  const positionAttribute = batch.geometry.getAttribute('position') as THREE.BufferAttribute;
  const normalAttribute = batch.geometry.getAttribute('normal') as THREE.BufferAttribute;
  const colorAttribute = batch.geometry.getAttribute('color') as THREE.BufferAttribute;

  (positionAttribute.array as Float32Array).set(batch.basePositions);
  (normalAttribute.array as Float32Array).set(batch.baseNormals);
  (colorAttribute.array as Float32Array).set(batch.baseColors);
  positionAttribute.needsUpdate = true;
  normalAttribute.needsUpdate = true;
  colorAttribute.needsUpdate = true;
}

function fallbackFootprint(runtime: ReefBatchRuntimeRange): number {
  const { minimum, maximum } = runtime.range.bounds;
  return Math.max(
    0.06,
    (maximum.x - minimum.x) * 0.5,
    (maximum.z - minimum.z) * 0.5,
  );
}

function storedDiagnostics(scene: ReefThreeSceneState): ReefSurfaceSlotDiagnostics | null {
  for (const batch of scene.batches) {
    const diagnostics = batch.geometry.userData.reefSurfaceSlotDiagnostics;
    if (diagnostics) return diagnostics as ReefSurfaceSlotDiagnostics;
  }
  return null;
}

/**
 * Projects all production colony ranges onto deterministic support slots. The
 * original batch indices and runtime ranges stay intact even if the support
 * registry cannot resolve an anchor, so missing support can never erase coral
 * geometry again. Terrain placements inherit the raycast surface normal so a
 * coral grows out of the limestone instead of remaining globally vertical.
 */
export function applyReefCoralSurfacePlacement({
  build,
  reefScene,
  group,
  supportMeshes,
}: {
  build: ReefPreviewBuild;
  reefScene: ReefThreeSceneState;
  group: THREE.Group;
  supportMeshes: readonly THREE.Mesh[];
}): ReefSurfaceSlotDiagnostics {
  const previousDiagnostics = storedDiagnostics(reefScene);
  const placementAlreadyApplied = reefScene.batches.length > 0
    && reefScene.batches.every((batch) => (
      batch.geometry.userData.reefCoralSurfacePlacementPass
        === REEF_CORAL_SURFACE_PLACEMENT_PASS
    ));
  if (placementAlreadyApplied && previousDiagnostics) return previousDiagnostics;

  group.updateMatrixWorld(true);
  const colonyById = new Map(
    build.layout.colonies.map((colony) => [colony.id, colony] as const),
  );
  const instructionById = new Map(
    build.species.growth.map((instruction) => [instruction.id, instruction] as const),
  );
  const runtimePlacements: RuntimePlacement[] = [];
  const pivotWorld = new THREE.Vector3();

  for (const batch of reefScene.batches) {
    for (const runtime of batch.runtimeRanges) {
      pivotWorld.set(runtime.motion.pivot.x, runtime.motion.pivot.y, runtime.motion.pivot.z);
      group.localToWorld(pivotWorld);
      const colony = colonyById.get(runtime.range.colonyId);
      const instruction = colony
        ? instructionById.get(colony.sourceInstructionId)
        : undefined;
      runtimePlacements.push({
        batch,
        runtime,
        request: {
          id: runtime.range.id,
          sequence: runtime.range.sequence,
          ...(instruction ? { epochIndex: instruction.epochIndex } : {}),
          preferred: {
            x: pivotWorld.x,
            y: pivotWorld.y,
            z: pivotWorld.z,
          },
          footprintRadius: Math.max(0.06, colony?.footprintRadius ?? fallbackFootprint(runtime)),
        },
      });
    }
  }

  const terrainSupportMeshes = collectReefTerrainSupportMeshes(supportMeshes);
  const archSupportMeshes = collectReefArchSupportMeshes(supportMeshes);
  const candidates = [
    ...buildReefSurfaceSlotCandidates({
      foundationRadius: build.structures.visibleFoundationRadius,
      seed: build.species.moduleEvolution.identitySeed,
    }),
    ...collectReefSupportSlotCandidates(supportMeshes),
  ];
  const supportNormalByPoint = new Map<string, THREE.Vector3>();
  const allocation = allocateReefSurfaceSlots({
    requests: runtimePlacements.map((placement) => placement.request),
    candidates,
    sample: (x, z) => {
      const hit = raycastReefCoralTerrainSupport(
        terrainSupportMeshes,
        archSupportMeshes,
        x,
        z,
      );
      if (!hit) return null;

      const worldNormal = hit.face
        ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize()
        : WORLD_UP.clone();
      if (worldNormal.y < 0) worldNormal.negate();
      supportNormalByPoint.set(surfacePointKey(hit.point.x, hit.point.z), worldNormal);
      return { x: hit.point.x, y: hit.point.y, z: hit.point.z };
    },
  });
  const slotByRangeId = new Map(
    allocation.slots.map((slot) => [slot.requestId, slot] as const),
  );
  const targetWorld = new THREE.Vector3();
  const worldNormalToLocal = new THREE.Matrix3().getNormalMatrix(group.matrixWorld).invert();

  for (const placement of runtimePlacements) {
    const slot = slotByRangeId.get(placement.request.id);
    if (slot) {
      targetWorld.set(
        slot.position.x,
        slot.position.y + (placement.runtime.range.morphotype === 'encrusting' ? 0.008 : 0.018),
        slot.position.z,
      );
      translateRange(
        placement.batch,
        placement.runtime,
        group.worldToLocal(targetWorld),
      );
      sculptRange(placement.batch, placement.runtime, slot.position.y);

      const worldNormal = supportNormalByPoint.get(
        surfacePointKey(slot.position.x, slot.position.z),
      ) ?? WORLD_UP;
      const localNormal = worldNormal.clone().applyMatrix3(worldNormalToLocal).normalize();
      alignRangeToNormal(placement.batch, placement.runtime, localNormal);
    } else {
      // Catastrophic support loss keeps the accepted range visible at its
      // engine anchor. Diagnostics expose it without deleting its indices.
      sculptRange(
        placement.batch,
        placement.runtime,
        placement.request.preferred.y,
      );
    }
  }

  for (const batch of reefScene.batches) {
    syncBatchAttributes(batch);
    batch.geometry.computeBoundingBox();
    batch.geometry.computeBoundingSphere();
    batch.geometry.userData.reefSurfaceSlotVersion = REEF_SURFACE_SLOT_VERSION;
    batch.geometry.userData.reefCoralSurfacePlacementPass = REEF_CORAL_SURFACE_PLACEMENT_PASS;
    batch.geometry.userData.reefSculptPass = LIVING_CANOPY_SCULPT_PASS;
    batch.geometry.userData.reefVisibleRangeCount = batch.runtimeRanges.length;
    batch.geometry.userData.reefSurfaceSlotDiagnostics = allocation.diagnostics;
  }

  return allocation.diagnostics;
}
