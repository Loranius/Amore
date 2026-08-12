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

const SCULPT_PASS_34 = 'reef-sculpt-pass-3-4';
const EMBEDDED_PATCH_COLOR = new THREE.Color('#6f7567');

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

function muteMassiveRange(batch: ReefRenderableBatch, runtime: ReefBatchRuntimeRange): void {
  for (
    let index = runtime.range.vertexStart;
    index < runtime.range.vertexStart + runtime.range.vertexCount;
    index += 1
  ) {
    const offset = index * 3;
    const sourceR = batch.baseColors[offset] ?? EMBEDDED_PATCH_COLOR.r;
    const sourceG = batch.baseColors[offset + 1] ?? EMBEDDED_PATCH_COLOR.g;
    const sourceB = batch.baseColors[offset + 2] ?? EMBEDDED_PATCH_COLOR.b;
    const blend = 0.82;
    batch.baseColors[offset] = sourceR + (EMBEDDED_PATCH_COLOR.r - sourceR) * blend;
    batch.baseColors[offset + 1] = sourceG + (EMBEDDED_PATCH_COLOR.g - sourceG) * blend;
    batch.baseColors[offset + 2] = sourceB + (EMBEDDED_PATCH_COLOR.b - sourceB) * blend;
  }
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

function shouldKeepRange(runtime: ReefBatchRuntimeRange, supportY: number): boolean {
  const { morphotype, sequence } = runtime.range;

  if (morphotype === 'plating' && supportY > 0.7) {
    return sequence % 3 !== 0;
  }

  // Stage 3: amber massive colonies become rare accents instead of a side wall.
  if (morphotype === 'massive') {
    return sequence % 2 === 0;
  }

  return true;
}

function sculptSupportedRange(
  batch: ReefRenderableBatch,
  runtime: ReefBatchRuntimeRange,
  supportY: number,
): void {
  if (runtime.range.morphotype === 'plating') {
    rescaleRange(
      batch,
      runtime,
      supportY > 0.7 ? [0.54, 0.62, 0.54] : [0.62, 0.7, 0.62],
    );
    return;
  }

  if (runtime.range.morphotype === 'massive') {
    // Stage 3: turn the remaining amber wedges into low, rock-hugging patches.
    rescaleRange(batch, runtime, [0.38, 0.18, 0.38]);
    muteMassiveRange(batch, runtime);
  }
}

function pullBranchingRangeInward(
  batch: ReefRenderableBatch,
  runtime: ReefBatchRuntimeRange,
  group: THREE.Group,
  supportMeshes: readonly THREE.Mesh[],
  pivotWorld: THREE.Vector3,
): void {
  const morphotype = runtime.range.morphotype;
  if (morphotype !== 'branching' && morphotype !== 'sea-fan') return;

  const radius = Math.hypot(pivotWorld.x, pivotWorld.z);
  if (radius < 0.68) return;
  if (runtime.range.sequence % 4 === 0) return;

  // Pull most outer fans/branches 26-34% toward the hero center. The new root
  // is accepted only if an actual upward-facing hero-support surface exists.
  const inward = morphotype === 'sea-fan' ? 0.74 : 0.66;
  const targetHit = raycastReefSupport(
    supportMeshes,
    pivotWorld.x * inward,
    pivotWorld.z * inward,
    0.3,
  );
  if (!targetHit) return;

  const targetWorld = targetHit.point.clone();
  targetWorld.y += 0.012;
  const targetLocal = group.worldToLocal(targetWorld);
  translateRange(batch, runtime, targetLocal);
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
   * Only production ranges that touch the visible artistic reef survive.
   * Stage 3 reduces massive colonies to embedded accents. Stage 4 relocates
   * most outer branching/sea-fan ranges onto real inner terrace support so the
   * center regains coral structure without reintroducing levitation.
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
      const sculptAlreadyApplied = batch.geometry.userData.reefSculptPass === SCULPT_PASS_34;

      for (const runtime of batch.runtimeRanges) {
        pivot.set(runtime.motion.pivot.x, runtime.motion.pivot.y, runtime.motion.pivot.z);
        group.localToWorld(pivot);

        const hit = raycastReefSupport(supportMeshes, pivot.x, pivot.z, 0.26);
        if (!hit) continue;

        const contactGap = Math.abs(pivot.y - hit.point.y);
        if (contactGap > 0.18) continue;
        if (!shouldKeepRange(runtime, hit.point.y)) continue;

        if (!sculptAlreadyApplied) {
          sculptSupportedRange(batch, runtime, hit.point.y);
          pullBranchingRangeInward(batch, runtime, group, supportMeshes, pivot);
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
        batch.geometry.userData.reefSculptPass = SCULPT_PASS_34;
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
      scale={[0.68, 1.05, 0.68]}
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
