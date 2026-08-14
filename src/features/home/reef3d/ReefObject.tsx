import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { ReefPreviewBuild } from './buildReefPreview';
import { applyReefFoundationPresentation } from './reefFoundationPresentation';
import { applyReefMaterialColorSpace } from './reefMaterialColorSpace';
import { applyReefMaterialPresentation } from './reefMaterialPresentation';
import { applyReefPresentation } from './reefPresentation';
import { applyReefCoralSurfacePlacement } from './reefCoralSurfacePlacement';
import { collectReefSupportMeshes } from './reefSupportPlacement';
import {
  REEF_OBJECT_POSITION,
  REEF_OBJECT_ROTATION,
  REEF_OBJECT_SCALE,
} from './reefObjectTransform';
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
   * Every portal-derived production range receives a deterministic surface
   * slot. Unsupported preferred anchors move to the nearest valid slot instead
   * of disappearing from the batch index.
   */
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    const supportMeshes = collectReefSupportMeshes(threeScene);
    if (supportMeshes.length === 0) return;

    applyReefCoralSurfacePlacement({
      build,
      reefScene,
      group,
      supportMeshes,
    });
  }, [build, reefScene, threeScene]);

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
      rotation={REEF_OBJECT_ROTATION}
      position={REEF_OBJECT_POSITION}
      scale={REEF_OBJECT_SCALE}
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
