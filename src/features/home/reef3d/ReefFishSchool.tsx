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
const TUNNEL_COLLISION_RELEASE_WEIGHT = 0.025;
const NAVIGATION_UPDATE_INTERVAL = 1 / 30;
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

function applyWorldDelta(
  objects: readonly THREE.Object3D[],
  delta: THREE.Vector3,
  world: THREE.Vector3,
): void {
  if (delta.lengthSq() <= 1e-10) return;
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

export function ReefFishSchool({
  build,
  onReady,
  reducedMotion,
}: ReefFishSchoolProps) {
  const schoolRef = useRef<THREE.Group>(null);
  const obstaclesRef = useRef<ReefFishObstacle[]>([]);
  const navigationOffsetsRef = useRef(new Map<ReefFishRouteId, THREE.Vector3>());
  const navigationAccumulatorRef = useRef(0);
  const motionScratch = useRef({
    representative: new THREE.Vector3(),
    guided: new THREE.Vector3(),
    targetDelta: new THREE.Vector3(),
    corrected: new THREE.Vector3(),
    carrierWorld: new THREE.Vector3(),
  });
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
    navigationAccumulatorRef.current += Math.min(Math.max(deltaSeconds, 0), 0.05);
    if (navigationAccumulatorRef.current < NAVIGATION_UPDATE_INTERVAL) return;
    const navigationDeltaSeconds = navigationAccumulatorRef.current;
    navigationAccumulatorRef.current %= NAVIGATION_UPDATE_INTERVAL;
    const scratch = motionScratch.current;

    for (const route of routes) {
      const routeCarriers = carriers.get(route.routeId) ?? [];
      const representative = routeCarriers[0];
      if (!representative) continue;

      representative.getWorldPosition(scratch.representative);
      scratch.guided.copy(scratch.representative);

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
          scratch.guided.lerp(tunnelSample.target, tunnelWeight);
        }
      }

      const tunnelOwnsArchCrossing = tunnelWeight > TUNNEL_COLLISION_RELEASE_WEIGHT;
      const foundationDelta = reefFishFoundationAvoidanceDelta(scratch.guided, build)
        .multiplyScalar(1 - tunnelWeight);
      scratch.guided.add(foundationDelta);

      const localCollisionDelta = reefFishCollisionDelta(
        scratch.guided,
        obstaclesRef.current,
        0.34,
        { ignoreArchRocks: tunnelOwnsArchCrossing },
      );
      scratch.guided.add(localCollisionDelta);
      scratch.targetDelta.copy(scratch.guided).sub(scratch.representative);

      let currentDelta = navigationOffsetsRef.current.get(route.routeId);
      if (!currentDelta) {
        currentDelta = new THREE.Vector3();
        navigationOffsetsRef.current.set(route.routeId, currentDelta);
      }

      const response = localCollisionDelta.lengthSq() > 1e-8
        ? COLLISION_RESPONSE
        : NAVIGATION_RESPONSE;
      const frame = Math.min(navigationDeltaSeconds, 0.05);
      currentDelta.lerp(scratch.targetDelta, 1 - Math.exp(-response * frame));

      scratch.corrected.copy(scratch.representative).add(currentDelta);
      currentDelta.add(reefFishCollisionDelta(
        scratch.corrected,
        obstaclesRef.current,
        EMERGENCY_COLLISION_MARGIN,
        { ignoreArchRocks: tunnelOwnsArchCrossing },
      ));

      applyWorldDelta(routeCarriers, currentDelta, scratch.carrierWorld);
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
      <primitive object={scene} dispose={null} />
    </group>
  );
}
