import { useEffect } from 'react';
import { useAnimations, useGLTF } from '@react-three/drei';
import * as THREE from 'three';

const SCHOOL_OF_FISH_MODEL_URL = `${import.meta.env.BASE_URL}models/school_of_fish_reef.glb`;

/**
 * Native animated fish school sourced from the School Of Fish GLB.
 *
 * The model already contains the authored spatial trajectories for all nine
 * fish, so we deliberately do not layer the old procedural roaming/steering
 * system on top of it. Three.js only advances the original `swimming` clip.
 */
export function ReefFishSchool({ reducedMotion }: { reducedMotion: boolean }) {
  const { scene, animations } = useGLTF(SCHOOL_OF_FISH_MODEL_URL);
  const { actions } = useAnimations(animations, scene);

  useEffect(() => {
    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      // Skinned meshes can move beyond their bind-pose bounds during the long
      // authored school loop. Disabling per-mesh frustum culling prevents fish
      // from disappearing while crossing the edges of the camera frustum.
      object.frustumCulled = false;
      object.castShadow = false;
      object.receiveShadow = false;
    });
  }, [scene]);

  useEffect(() => {
    const swim = actions.swimming;
    if (!swim) return undefined;

    swim
      .reset()
      .setLoop(THREE.LoopRepeat, Infinity)
      .fadeIn(0.25)
      .play();

    return () => {
      swim.stop();
    };
  }, [actions]);

  useEffect(() => {
    const swim = actions.swimming;
    if (!swim) return;
    // Respect the existing portal-wide reduced-motion contract without
    // swapping models or resetting the animation when the preference changes.
    swim.timeScale = reducedMotion ? 0 : 1;
  }, [actions, reducedMotion]);

  return (
    <primitive
      object={scene}
      name="reef-native-school-of-fish"
      position={[-0.45, 0.55, 0.15]}
      scale={0.00058}
      dispose={null}
    />
  );
}

useGLTF.preload(SCHOOL_OF_FISH_MODEL_URL);
