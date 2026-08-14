import { useEffect, useRef } from 'react';
import { useAnimations, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import {
  REEF_FISH_SCHOOL_POSITION,
  REEF_FISH_SCHOOL_SCALE,
} from './reefFishSchoolPresentation';

const SCHOOL_OF_FISH_MODEL_URL = `${import.meta.env.BASE_URL}models/school_of_fish_reef.glb`;

export interface ReefFishSchoolMetrics {
  depth: number;
  height: number;
  meshes: number;
  width: number;
}

interface ReefFishSchoolProps {
  onReady?: ((metrics: ReefFishSchoolMetrics) => void) | undefined;
  reducedMotion: boolean;
}

function roundMetric(value: number): number {
  return Number(value.toFixed(3));
}

/**
 * Native animated fish school sourced from the School Of Fish GLB.
 *
 * The model already contains the authored spatial trajectories for all nine
 * fish, so we deliberately do not layer the old procedural roaming/steering
 * system on top of it. Three.js only advances the original `swimming` clip.
 */
export function ReefFishSchool({ onReady, reducedMotion }: ReefFishSchoolProps) {
  const schoolRef = useRef<THREE.Group>(null);
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

  useEffect(() => {
    const school = schoolRef.current;
    if (!school || !onReady) return;

    school.updateWorldMatrix(true, true);
    const bounds = new THREE.Box3().setFromObject(school, true);
    if (bounds.isEmpty()) return;

    let meshes = 0;
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) meshes += 1;
    });

    const size = bounds.getSize(new THREE.Vector3());
    onReady({
      depth: roundMetric(size.z),
      height: roundMetric(size.y),
      meshes,
      width: roundMetric(size.x),
    });
  }, [onReady, scene]);

  return (
    <group
      ref={schoolRef}
      name="reef-native-school-of-fish"
      position={REEF_FISH_SCHOOL_POSITION}
      scale={REEF_FISH_SCHOOL_SCALE}
    >
      <primitive
        object={scene}
        position={[0, 0, 0]}
        rotation={[0, 0, 0]}
        scale={1}
        dispose={null}
      />
    </group>
  );
}

useGLTF.preload(SCHOOL_OF_FISH_MODEL_URL);
