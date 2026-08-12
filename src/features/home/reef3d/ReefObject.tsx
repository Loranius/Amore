import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import type { ReefPreviewBuild } from './buildReefPreview';
import { applyReefFoundationPresentation } from './reefFoundationPresentation';
import { applyReefMaterialColorSpace } from './reefMaterialColorSpace';
import { applyReefMaterialPresentation } from './reefMaterialPresentation';
import { applyReefPresentation } from './reefPresentation';
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
  const scene = useMemo(
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

  useEffect(() => {
    onSceneReady?.(scene);
    return () => disposeReefThreeScene(scene);
  }, [onSceneReady, scene]);

  useEffect(() => {
    if (!reducedMotion) return;
    for (const batch of scene.batches) {
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
    scene,
  ]);

  useFrame(({ clock }) => {
    if (reducedMotion) return;
    const elapsedSeconds = clock.getElapsedTime();
    for (const batch of scene.batches) {
      sampleReefBatchFrame(
        batch,
        elapsedSeconds,
        false,
        build.life.current.cycleSeconds,
        build.life.current.phaseRadians,
      );
    }
  });

  // The generated foundation is still built, sculpted and reported through the
  // accepted scene contract, but it is no longer a visible portal surface. It
  // remains an internal attachment substrate while the environment supplies the
  // artistic coral-rock base. Horizontal compression pulls the generated colonies
  // around that compact vertical core without changing their vertical growth.
  return (
    <group
      rotation={[-0.08, -0.18, 0]}
      position={[0, 0.02, 0]}
      scale={[0.68, 1.05, 0.68]}
    >
      <mesh
        visible={false}
        geometry={scene.foundation.geometry}
        material={scene.foundation.material}
        receiveShadow={false}
        castShadow={false}
      />
      {scene.batches.map((batch) => (
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
