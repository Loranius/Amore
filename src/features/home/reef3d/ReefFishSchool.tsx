import { useEffect, useMemo, useRef } from 'react';
import { useAnimations, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import {
  createReefFishRouteClips,
  REEF_FISH_ROUTE_PLAYBACK_RATE,
} from './reefFishSchoolMotion';
import {
  REEF_FISH_SCHOOL_POSITION,
  REEF_FISH_SCHOOL_SCALE,
} from './reefFishSchoolPresentation';

const SCHOOL_OF_FISH_MODEL_URL = `${import.meta.env.BASE_URL}models/school_of_fish_reef.glb`;
const REDUCED_MOTION_PLAYBACK_FACTOR = 0.32;

export interface ReefFishSchoolMetrics {
  animatedRoutes: number;
  depth: number;
  height: number;
  meshes: number;
  routes: number;
  scale: number;
  tracks: number;
  width: number;
}

interface ReefFishSchoolProps {
  count?: number;
  identitySeed?: number;
  onReady?: ((metrics: ReefFishSchoolMetrics) => void) | undefined;
  reducedMotion: boolean;
}

function roundMetric(value: number): number {
  return Number(value.toFixed(3));
}

/**
 * Native animated fish school sourced from the authored School Of Fish GLB.
 *
 * The source clip contains nine rigged fish. We split it into independently
 * phased open-water route clips so the school crosses broad lanes around the
 * reef instead of clustering directly in front of the camera. The legacy
 * count/identity props remain optional only to keep ReefStage source-compatible
 * while the procedural Kenney renderer is removed.
 */
export function ReefFishSchool({ onReady, reducedMotion }: ReefFishSchoolProps) {
  const schoolRef = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(SCHOOL_OF_FISH_MODEL_URL);
  const routes = useMemo(
    () => animations[0] ? createReefFishRouteClips(animations[0]) : [],
    [animations],
  );
  const routeClips = useMemo(() => routes.map(({ clip }) => clip), [routes]);
  const { actions } = useAnimations(routeClips, scene);

  useEffect(() => {
    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.frustumCulled = false;
      object.castShadow = false;
      object.receiveShadow = false;
    });
  }, [scene]);

  useEffect(() => {
    const activeActions = routes.flatMap(({ clip, phase }) => {
      const action = actions[clip.name];
      if (!action) return [];

      action.reset();
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.time = clip.duration * phase;
      action.fadeIn(0.25).play();
      return [action];
    });

    return () => {
      activeActions.forEach((action) => action.stop());
    };
  }, [actions, routes]);

  useEffect(() => {
    const playbackRate = reducedMotion
      ? REEF_FISH_ROUTE_PLAYBACK_RATE * REDUCED_MOTION_PLAYBACK_FACTOR
      : REEF_FISH_ROUTE_PLAYBACK_RATE;

    routes.forEach(({ clip }) => {
      const action = actions[clip.name];
      if (action) action.timeScale = playbackRate;
    });
  }, [actions, reducedMotion, routes]);

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
      animatedRoutes: routes.length,
      depth: roundMetric(size.z),
      height: roundMetric(size.y),
      meshes,
      routes: routes.length,
      scale: REEF_FISH_SCHOOL_SCALE,
      tracks: routeClips.reduce((total, clip) => total + clip.tracks.length, 0),
      width: roundMetric(size.x),
    });
  }, [onReady, routeClips, routes.length, scene]);

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
