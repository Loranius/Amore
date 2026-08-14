import { useFrame } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';

const WHALE_PART_BASE = `${import.meta.env.BASE_URL}models/glow_whale_native/`;
const WHALE_PART_COUNT = 15;
const WHALE_CLIP_NAME = 'move f';
const DRACO_DECODER_BASE = 'https://www.gstatic.com/draco/versioned/decoders/1.5.7/';
const WHALE_PLAYBACK_RATE = 0.72;
const REDUCED_WHALE_PLAYBACK_RATE = 0.24;
const WHALE_ROUTE_RATE = 0.012;
const REDUCED_WHALE_ROUTE_RATE = 0.004;

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
  const dracoLoader = new DRACOLoader();

  dracoLoader.setDecoderPath(DRACO_DECODER_BASE);
  loader.setDRACOLoader(dracoLoader);
  loader.setMeshoptDecoder(MeshoptDecoder);

  return new Promise((resolve, reject) => {
    loader.parse(
      buffer,
      WHALE_PART_BASE,
      (gltf) => {
        dracoLoader.dispose();
        resolve(gltf);
      },
      (error) => {
        dracoLoader.dispose();
        reject(error);
      },
    );
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
    object.frustumCulled = !(object instanceof THREE.SkinnedMesh);

    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];

    for (const material of materials) {
      if (!(material instanceof THREE.MeshStandardMaterial)) continue;

      material.metalness = 0;
      material.roughness = Math.max(0.72, material.roughness);
      if (material.emissiveMap) material.emissiveIntensity = 1.35;
      material.needsUpdate = true;
    }
  });

  return {
    scene,
    animations: gltf.animations,
  };
}

/**
 * Native animated Glow Whale used only as distant background life.
 * The source animation and textures stay intact; scene motion merely carries
 * the whole animal slowly behind the reef where fog can establish scale.
 */
export function BackgroundWhale({ reducedMotion }: { reducedMotion: boolean }) {
  const routeRef = useRef<THREE.Group>(null);
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

    mixer.timeScale = reducedMotion ? REDUCED_WHALE_PLAYBACK_RATE : WHALE_PLAYBACK_RATE;
    mixerRef.current = mixer;

    return () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(whale.scene);
      mixerRef.current = null;
    };
  }, [reducedMotion, whale]);

  useFrame(({ clock }, delta) => {
    const route = routeRef.current;
    if (!route) return;

    mixerRef.current?.update(delta);

    const t = clock.getElapsedTime();
    const routeRate = reducedMotion ? REDUCED_WHALE_ROUTE_RATE : WHALE_ROUTE_RATE;
    const progress = (0.36 + t * routeRate) % 1;
    const verticalAmplitude = reducedMotion ? 0.025 : 0.08;
    const depthAmplitude = reducedMotion ? 0.07 : 0.22;

    route.position.set(
      THREE.MathUtils.lerp(8.2, -8.2, progress),
      3.25 + Math.sin(t * 0.12) * verticalAmplitude,
      -11.4 + Math.sin(t * 0.08) * depthAmplitude,
    );
  });

  if (!whale) return null;

  return (
    <group ref={routeRef} name="reef-background-whale">
      <group
        name="reef-background-whale-native-model"
        rotation={[0, -Math.PI / 2, 0]}
        scale={4.6}
      >
        <primitive object={whale.scene} />
      </group>
    </group>
  );
}
