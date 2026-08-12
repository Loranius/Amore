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
  type ReefThreeSceneState,
} from './reefThreeAdapter';

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
   * Production colonies were originally attached to the procedural foundation.
   * That foundation is intentionally hidden in the portal, so ranges whose base
   * no longer sits on the visible artistic rock must not remain visible in air.
   *
   * Each colony range owns a contiguous index slice. We keep only ranges whose
   * motion pivot is within a small contact tolerance of a real hero-support hit;
   * unsupported ranges disappear from the batch index buffer without changing
   * the generator contract or adding draw calls.
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

      for (const runtime of batch.runtimeRanges) {
        pivot.set(runtime.motion.pivot.x, runtime.motion.pivot.y, runtime.motion.pivot.z);
        group.localToWorld(pivot);

        const hit = raycastReefSupport(supportMeshes, pivot.x, pivot.z, 0.26);
        if (!hit) continue;

        const contactGap = Math.abs(pivot.y - hit.point.y);
        if (contactGap > 0.18) continue;

        supportedRanges.push(runtime);
        const end = runtime.range.indexStart + runtime.range.indexCount;
        for (let index = runtime.range.indexStart; index < end; index += 1) {
          const vertexIndex = batch.source.index[index];
          if (vertexIndex !== undefined) supportedIndices.push(vertexIndex);
        }
      }

      batch.runtimeRanges = supportedRanges;
      batch.geometry.setIndex(supportedIndices);
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

  // The generated foundation remains an internal generator/attachment contract,
  // but only production colony ranges that genuinely contact the visible hero
  // support are allowed through the presentation layer.
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
