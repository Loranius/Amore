import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { ReefPreviewBuild } from './buildReefPreview';
import { applyReefFoundationPresentation } from './reefFoundationPresentation';
import { applyReefMaterialColorSpace } from './reefMaterialColorSpace';
import { applyReefMaterialPresentation } from './reefMaterialPresentation';
import { applyReefPresentation } from './reefPresentation';
import { collectReefSupportMeshes, raycastReefSupport } from './reefSupportPlacement';
import {
  createReefThreeScene,
  disposeReefThreeScene,
  sampleReefBatchFrame,
  type ReefBatchRuntimeRange,
  type ReefRenderableBatch,
  type ReefThreeSceneState,
} from './reefThreeAdapter';

const LIVING_CANOPY_SCULPT_PASS = 'reef-living-canopy-sculpt-v1';

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

function sculptSupportedRange(
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

function groundRangeOnSupport(
  batch: ReefRenderableBatch,
  runtime: ReefBatchRuntimeRange,
  group: THREE.Group,
  supportMeshes: readonly THREE.Mesh[],
  pivotWorld: THREE.Vector3,
): number | null {
  // Never slide roots sideways after the collision-safe engine layout. A
  // colony either grows at its reserved X/Z footprint or remains hidden until
  // the chronological foundation reaches that place.
  const inwardSteps = [1];

  for (const inward of inwardSteps) {
    const hit = raycastReefSupport(
      supportMeshes,
      pivotWorld.x * inward,
      pivotWorld.z * inward,
      0.2,
    );
    if (!hit) continue;

    const targetWorld = hit.point.clone();
    targetWorld.y += runtime.range.morphotype === 'encrusting' ? 0.008 : 0.018;
    translateRange(batch, runtime, group.worldToLocal(targetWorld));
    return hit.point.y;
  }

  return null;
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

export function ReefObject({
  build,
  reducedMotion,
  onSceneReady,
}: {
  build: ReefPreviewBuild;
  reducedMotion: boolean;
  onSceneReady?: (scene: ReefThreeSceneState) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const threeScene = useThree((state) => state.scene);
  const reefScene = useMemo(
    () => applyReefMaterialColorSpace(
      applyReefMaterialPresentation(
        applyReefFoundationPresentation(
          applyReefPresentation(createReefThreeScene(build)),
          build,
        ),
      ),
    ),
    [build],
  );

  /**
   * Every portal-derived production range is given a chance to remain visible.
   * Roots are projected onto the nearest valid terrace, then the accepted
   * morphotype is enlarged into a readable colony without changing topology,
   * range identity, material identity or motion bindings.
   */
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    const supportMeshes = collectReefSupportMeshes(threeScene);
    if (supportMeshes.length === 0) return;

    group.updateMatrixWorld(true);
    const pivot = new THREE.Vector3();

    for (const batch of reefScene.batches) {
      const supportedRanges = [] as typeof batch.runtimeRanges;
      const supportedIndices: number[] = [];
      const sculptAlreadyApplied = batch.geometry.userData.reefSculptPass
        === LIVING_CANOPY_SCULPT_PASS;

      for (const runtime of batch.runtimeRanges) {
        if (!sculptAlreadyApplied) {
          pivot.set(runtime.motion.pivot.x, runtime.motion.pivot.y, runtime.motion.pivot.z);
          group.localToWorld(pivot);
          const supportY = groundRangeOnSupport(
            batch,
            runtime,
            group,
            supportMeshes,
            pivot,
          );
          if (supportY === null) continue;
          sculptSupportedRange(batch, runtime, supportY);
        }

        supportedRanges.push(runtime);
        const end = runtime.range.indexStart + runtime.range.indexCount;
        for (let index = runtime.range.indexStart; index < end; index += 1) {
          const vertexIndex = batch.source.index[index];
          if (vertexIndex !== undefined) supportedIndices.push(vertexIndex);
        }
      }

      batch.runtimeRanges = supportedRanges;
      batch.geometry.setIndex(supportedIndices);
      if (!sculptAlreadyApplied) {
        syncBatchAttributes(batch);
        batch.geometry.userData.reefSculptPass = LIVING_CANOPY_SCULPT_PASS;
      }
      batch.geometry.computeBoundingBox();
      batch.geometry.computeBoundingSphere();
      batch.geometry.userData.reefVisibleRangeCount = supportedRanges.length;
    }
  }, [reefScene, threeScene]);

  useEffect(() => {
    onSceneReady?.(reefScene);
    return () => disposeReefThreeScene(reefScene);
  }, [onSceneReady, reefScene]);

  useEffect(() => {
    if (!reducedMotion) return;
    for (const batch of reefScene.batches) {
      sampleReefBatchFrame(
        batch,
        0,
        true,
        build.life.current.cycleSeconds,
        build.life.current.phaseRadians,
      );
    }
  }, [
    build.life.current.cycleSeconds,
    build.life.current.phaseRadians,
    reducedMotion,
    reefScene,
  ]);

  useFrame(({ clock }) => {
    if (reducedMotion) return;
    const elapsedSeconds = clock.getElapsedTime();
    for (const batch of reefScene.batches) {
      sampleReefBatchFrame(
        batch,
        elapsedSeconds,
        false,
        build.life.current.cycleSeconds,
        build.life.current.phaseRadians,
      );
    }
  });

  return (
    <group
      ref={groupRef}
      rotation={[-0.08, -0.18, 0]}
      position={[0, 0.02, 0]}
      scale={[1, 1.04, 1]}
    >
      <mesh
        visible={false}
        geometry={reefScene.foundation.geometry}
        material={reefScene.foundation.material}
        receiveShadow={false}
        castShadow={false}
      />
      {reefScene.batches.map((batch) => (
        <mesh
          key={batch.id}
          geometry={batch.geometry}
          material={batch.material}
          receiveShadow={false}
          castShadow={false}
        />
      ))}
    </group>
  );
}
