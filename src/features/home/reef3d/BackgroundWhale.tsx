import { useFrame } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';

const WHALE_PART_BASE = `${import.meta.env.BASE_URL}models/glow_whale_native/`;
const WHALE_PART_COUNT = 15;
const WHALE_CLIP_NAME = 'move f';

type LoadedWhale = {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
};

type DecompressionStreamConstructor = new (
  format: 'gzip',
) => TransformStream<Uint8Array, Uint8Array>;

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value.replace(/\s/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function inflateWhaleAsset(compressed: Uint8Array): Promise<ArrayBuffer> {
  const DecompressionStreamApi = (
    globalThis as typeof globalThis & {
      DecompressionStream?: DecompressionStreamConstructor;
    }
  ).DecompressionStream;

  if (!DecompressionStreamApi) {
    throw new Error('This browser does not support gzip DecompressionStream.');
  }

  const source = compressed.buffer.slice(
    compressed.byteOffset,
    compressed.byteOffset + compressed.byteLength,
  ) as ArrayBuffer;
  const stream = new Blob([source])
    .stream()
    .pipeThrough(new DecompressionStreamApi('gzip'));

  return new Response(stream).arrayBuffer();
}

function parseWhaleGltf(buffer: ArrayBuffer): Promise<GLTF> {
  const loader = new GLTFLoader();
  return new Promise((resolve, reject) => {
    loader.parse(buffer, WHALE_PART_BASE, resolve, reject);
  });
}

async function loadNativeWhale(): Promise<LoadedWhale> {
  const parts = await Promise.all(
    Array.from({ length: WHALE_PART_COUNT }, async (_, index) => {
      const name = `part-${String(index).padStart(2, '0')}.txt`;
      const response = await fetch(`${WHALE_PART_BASE}${name}`);
      if (!response.ok) {
        throw new Error(`Unable to load whale asset part ${name}: ${response.status}`);
      }
      return response.text();
    }),
  );

  const compressed = decodeBase64(parts.join(''));
  const buffer = await inflateWhaleAsset(compressed);
  const gltf = await parseWhaleGltf(buffer);
  const scene = cloneSkeleton(gltf.scene) as THREE.Group;

  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;

    object.castShadow = false;
    object.receiveShadow = false;

    // Animated skinned bounds from the source asset are not guaranteed to stay
    // representative after skeleton cloning. Keep the native whale renderable
    // throughout the swim route instead of letting stale bounds cull it.
    object.frustumCulled = !(object instanceof THREE.SkinnedMesh);

    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];

    for (const material of materials) {
      if (!(material instanceof THREE.MeshStandardMaterial)) continue;

      // Keep the model-authored texture stack. Only tune the physically based
      // response for the dark underwater scene; maps themselves are untouched.
      material.metalness = 0;
      material.roughness = Math.max(0.68, material.roughness);
      if (material.emissiveMap) material.emissiveIntensity = 1.55;
      material.needsUpdate = true;
    }
  });

  return {
    scene,
    animations: gltf.animations,
  };
}

/**
 * Native animated Glow Whale used as distant reef life.
 *
 * The runtime GLB keeps the source skeleton, the native forward-swim clip and
 * the embedded diffuse/emissive/normal texture stack. Only the outer route moves
 * the whole animal through the background; body/tail motion comes from the GLB.
 */
export function BackgroundWhale({ reducedMotion }: { reducedMotion: boolean }) {
  const routeRef = useRef<THREE.Group>(null);
  const indicatorRef = useRef<THREE.Mesh>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const [whale, setWhale] = useState<LoadedWhale | null>(null);

  useEffect(() => {
    let cancelled = false;

    loadNativeWhale()
      .then((loaded) => {
        if (cancelled) return;
        setWhale(loaded);
      })
      .catch((error: unknown) => {
        if (import.meta.env.DEV) {
          console.warn('[reef] Native whale asset failed to load.', error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!whale) return;

    const mixer = new THREE.AnimationMixer(whale.scene);
    const clip =
      THREE.AnimationClip.findByName(whale.animations, WHALE_CLIP_NAME)
      ?? whale.animations[0];

    if (clip) {
      const action = mixer.clipAction(clip);
      action.reset();
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.clampWhenFinished = false;
      action.play();
    }

    mixer.timeScale = reducedMotion ? 0 : 0.9;
    mixerRef.current = mixer;

    return () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(whale.scene);
      mixerRef.current = null;
    };
  }, [reducedMotion, whale]);

  useFrame(({ clock, camera }, delta) => {
    const route = routeRef.current;
    const indicator = indicatorRef.current;
    if (!route || !indicator) return;

    if (reducedMotion) {
      route.position.set(2.8, 2.5, -7.4);
      indicator.scale.setScalar(1);
      indicator.quaternion.copy(camera.quaternion);
      return;
    }

    mixerRef.current?.update(delta);

    const t = clock.getElapsedTime();
    // Start near the centre instead of making a fresh page wait through an
    // off-screen approach. The full route still exits naturally at both sides.
    const progress = (0.5 + t * 0.022) % 1;

    route.position.set(
      THREE.MathUtils.lerp(7.4, -7.4, progress),
      2.52 + Math.sin(t * 0.16) * 0.1,
      -7.45 + Math.sin(t * 0.11) * 0.2,
    );

    const pulse = 0.92 + Math.sin(t * 1.9) * 0.12;
    indicator.scale.setScalar(pulse);
    indicator.quaternion.copy(camera.quaternion);
  });

  if (!whale) return null;

  return (
    <group ref={routeRef} name="reef-background-whale">
      <group
        name="reef-background-whale-native-model"
        rotation={[0, -Math.PI / 2, 0]}
        scale={10.5}
      >
        <primitive object={whale.scene} />
      </group>

      <mesh ref={indicatorRef} position={[0, 0.72, 0]} renderOrder={3}>
        <ringGeometry args={[0.075, 0.12, 24]} />
        <meshBasicMaterial
          color="#8df3ff"
          transparent
          opacity={0.52}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
