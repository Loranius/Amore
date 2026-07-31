import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import type { ReefPreviewBuild } from './buildReefPreview';
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
  const scene = useMemo(() => createReefThreeScene(build), [build]);

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

  return (
    <group rotation={[-0.08, -0.16, 0]} position={[0, -0.55, 0]}>
      <mesh
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
