import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useAnimations, useGLTF } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { ReefPreviewBuild } from './buildReefPreview';
import {
  createReefFishRouteClips,
  REEF_FISH_ROUTE_IDS,
  REEF_FISH_ROUTE_PLAYBACK_RATE,
} from './reefFishSchoolMotion';
import {
  buildReefFishTunnelPassages,
  collectReefFishObstacles,
  reefFishCollisionDelta,
  reefFishFoundationAvoidanceDelta,
  sampleReefFishTunnelPassage,
  type ReefFishObstacle,
  type ReefFishTunnelPassage,
} from './reefFishNavigation';
import {
  REEF_FISH_SCHOOL_POSITION,
  REEF_FISH_SCHOOL_SCALE,
} from './reefFishSchoolPresentation';

const SCHOOL_OF_FISH_MODEL_URL = `${import.meta.env.BASE_URL}models/school_of_fish_reef.glb`;
const REDUCED_MOTION_PLAYBACK_FACTOR = 0.32;
const NAVIGATION_RESPONSE = 10;
const COLLISION_RESPONSE = 18;
const EMERGENCY_COLLISION_MARGIN = 0.18;
type ReefFishRouteId = (typeof REEF_FISH_ROUTE_IDS)[number];

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
  build: ReefPreviewBuild;
  count?: number;
  identitySeed?: number;
  onReady?: ((metrics: ReefFishSchoolMetrics) => void) | undefined;
  reducedMotion: boolean;
}

function roundMetric(value: number): number {
  return Number(value.toFixed(3));
}

function routeIdForCarrier(object: THREE.Object3D): ReefFishRouteId | null {
  return REEF_FISH_ROUTE_IDS.find((routeId) => {
    if (!object.name.startsWith(routeId)) return false;
    const suffix = object.name.slice(routeId.length);
    return /^head(?:\d|$)/.test(suffix) || /^Spine_01(?:\d|$)/.test(suffix);
  }) ?? null;
}

function collectRouteCarriers(scene: THREE.Object3D): Map<ReefFishRouteId, THREE.Object3D[]> {
  const carriers = new Map<ReefFishRouteId, THREE.Object3D[]>(
    REEF_FISH_ROUTE_IDS.map((routeId) => [routeId, []]),
  );
  scene.traverse((object) => {
    const routeId = routeIdForCarrier(object);
    if (routeId) carriers.get(routeId)?.push(object);
  });
  return carriers;
}

function passageByRoute(
  passages: readonly ReefFishTunnelPassage[],
): Map<ReefFishRouteId, ReefFishTunnelPassage> {
  return new Map(passages.map((passage) => [passage.routeId, passage]));
}

function applyWorldDelta(objects: readonly THREE.Object3D[], delta: THREE.Vector3): void {
  if (delta.lengthSq() <= 1e-10) return;
  const world = new THREE.Vector3();
  for (const object of objects) {
    const parent = object.parent;
    if (!parent) continue;
    object.getWorldPosition(world);
    world.add(delta);
    parent.worldToLocal(world);
    object.position.copy(world);
    object.updateMatrixWorld(true);
  }
}

/**
 * Native animated fish school sourced from the authored School Of Fish GLB.
 *
 * Authored animation still supplies swimming/body motion, while navigation owns
 * only a smooth world-space offset. Fish bend around the central solid reef
 * before collision, three routes may temporarily cross only a real arch opening,
 * and Box3 correction is retained as a local emergency fallback for side rocks.
 */
export function ReefFishSchool({
  build,
  onReady,
  reducedMotion,
}: ReefFishSchoolProps) {
  const schoolRef = useRef<THREE.Group>(null);
  const obstaclesRef = useRef<ReefFishObstacle[]>([]);
  const navigationOffsetsRef = useRef(new Map<ReefFishRouteId, THREE.Vector3>());
  const threeScene = useThree((state) => state.scene);
  const { scene, animations } = useGLTF(SCHOOL_OF_FISH_MODEL_URL);
  const routes = useMemo(
    () => animations[0] ? createReefFishRouteClips(animations[0]) : [],
    [animations],
  );
  const routeClips = useMemo(() => routes.map(({ clip }) => clip), [routes]);
  const { actions } = useAnimations(routeClips, scene);
  const carriers = useMemo(() => collectRouteCarriers(scene), [scene]);
  const tunnelPassages = useMemo(() => buildReefFishTunnelPassages(build), [build]);
  const tunnels = useMemo(() => passageByRoute(tunnelPassages), [tunnelPassages]);

  useEffect(() => {
    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.frustumCulled = false;
      object.castShadow = false;
      object.receiveShadow = false;
    });
  }, [scene]);

  useLayoutEffect(() => {
    // ReefWorldComposition and natural arch matrices are mounted before the
    // school. Capture their final visible transforms, not their authored ones.
    obstaclesRef.current = collectReefFishObstacles(threeScene);
    navigationOffsetsRef.current.clear();
  }, [build, threeScene]);

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

  useFrame((_state, deltaSeconds) => {
    if (!schoolRef.current) return;

    // Drei's animation mixer updates before this hook in registration order.
    // Every frame begins from authored root motion, then receives one persistent,
    // damped navigation offset instead of a fresh hard collision snap.
    threeScene.updateMatrixWorld(true);
    const representativeWorld = new THREE.Vector3();
    const guidedWorld = new THREE.Vector3();

    for (const route of routes) {
      const routeCarriers = carriers.get(route.routeId) ?? [];
      const representative = routeCarriers[0];
      if (!representative) continue;

      representative.getWorldPosition(representativeWorld);
      guidedWorld.copy(representativeWorld);

      let tunnelWeight = 0;
      const passage = tunnels.get(route.routeId);
      const action = actions[route.clip.name];
      if (passage && action && route.clip.duration > 0) {
        const normalizedPhase = THREE.MathUtils.euclideanModulo(
          action.time / route.clip.duration,
          1,
        );
        const tunnelSample = sampleReefFishTunnelPassage(passage, normalizedPhase);
        if (tunnelSample) {
          tunnelWeight = tunnelSample.weight;
          guidedWorld.lerp(tunnelSample.target, tunnelWeight);
        }
      }

      // Outside a real tunnel opening the central reef is treated as a no-fly
      // volume. As tunnel weight rises the avoidance fades continuously, so the
      // fish can enter the opening without fighting two navigation systems.
      const foundationDelta = reefFishFoundationAvoidanceDelta(guidedWorld, build)
        .multiplyScalar(1 - tunnelWeight);
      guidedWorld.add(foundationDelta);

      const localCollisionDelta = reefFishCollisionDelta(
        guidedWorld,
        obstaclesRef.current,
        0.34,
      );
      guidedWorld.add(localCollisionDelta);

      const targetDelta = guidedWorld.clone().sub(representativeWorld);
      const currentDelta = navigationOffsetsRef.current.get(route.routeId)
        ?? new THREE.Vector3();
      const response = localCollisionDelta.lengthSq() > 1e-8
        ? COLLISION_RESPONSE
        : NAVIGATION_RESPONSE;
      const frame = Math.min(Math.max(deltaSeconds, 0), 0.05);
      const blend = 1 - Math.exp(-response * frame);
      currentDelta.lerp(targetDelta, blend);

      // If a fast authored keyframe still crosses a side structure between two
      // frames, resolve it once and keep that displacement in the persistent
      // offset. Unlike the old code it will not reset and re-snap next frame.
      const correctedWorld = representativeWorld.clone().add(currentDelta);
      const emergencyDelta = reefFishCollisionDelta(
        correctedWorld,
        obstaclesRef.current,
        EMERGENCY_COLLISION_MARGIN,
      );
      currentDelta.add(emergencyDelta);

      navigationOffsetsRef.current.set(route.routeId, currentDelta);
      applyWorldDelta(routeCarriers, currentDelta);
    }
  });

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
