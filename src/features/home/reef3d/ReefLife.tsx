import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

type Vec3 = readonly [number, number, number];

type LifeInstance = {
  position: Vec3;
  rotation: number;
  scale: number;
  phase: number;
  tone: number;
};

type FishInstance = {
  center: Vec3;
  radiusX: number;
  radiusZ: number;
  speed: number;
  phase: number;
  scale: number;
  heightDrift: number;
};

const SEA_GRASS_COUNT = 52;
const FISH_COUNT = 7;

// Kenney Survival Kit fish (Creative Commons CC0).
// A commit-pinned source keeps the lightweight model stable while the app loads it.
const KENNEY_FISH_MODEL_URL =
  'https://raw.githubusercontent.com/Pallarran/Myfirstgame/a31814aedeb635fef4d9594180df6d1b6bb51d6d/project/assets/models/kenney_survival-kit/Models/OBJ%20format/fish.obj';

const FISH_TINTS = ['#83b5aa', '#759caf', '#a79b72', '#788b9f'] as const;

let kenneyFishPromise: Promise<THREE.Group> | null = null;

function seededUnit(index: number, salt: number): number {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function buildSeaGrass(): LifeInstance[] {
  const clusters = [
    { center: [-4.35, -0.18, 1.65] as Vec3, radius: 1.45 },
    { center: [4.15, -0.2, 1.1] as Vec3, radius: 1.35 },
    { center: [-4.5, -0.22, -2.65] as Vec3, radius: 1.55 },
    { center: [4.75, -0.24, -2.35] as Vec3, radius: 1.5 },
  ] as const;

  return Array.from({ length: SEA_GRASS_COUNT }, (_, index) => {
    const cluster = clusters[index % clusters.length]!;
    const angle = seededUnit(index, 1) * Math.PI * 2;
    const radius = Math.sqrt(seededUnit(index, 2)) * cluster.radius;
    const x = cluster.center[0] + Math.cos(angle) * radius;
    const z = cluster.center[2] + Math.sin(angle) * radius;
    return {
      position: [x, cluster.center[1], z],
      rotation: seededUnit(index, 3) * Math.PI * 2,
      scale: THREE.MathUtils.lerp(0.72, 1.35, seededUnit(index, 4)),
      phase: seededUnit(index, 5) * Math.PI * 2,
      tone: seededUnit(index, 6),
    };
  });
}

function SeaGrass({ reducedMotion }: { reducedMotion: boolean }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const grass = useMemo(buildSeaGrass, []);
  const tickRef = useRef(0);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const dark = new THREE.Color('#315f50');
    const light = new THREE.Color('#5e8f67');
    const color = new THREE.Color();

    grass.forEach((blade, index) => {
      dummy.position.set(blade.position[0], blade.position[1] + 0.22 * blade.scale, blade.position[2]);
      dummy.rotation.set(0, blade.rotation, 0);
      dummy.scale.set(0.85 * blade.scale, blade.scale, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      color.copy(dark).lerp(light, blade.tone);
      mesh.setColorAt(index, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [dummy, grass]);

  useFrame((state, delta) => {
    if (reducedMotion) return;
    tickRef.current += delta;
    if (tickRef.current < 0.055) return;
    tickRef.current = 0;

    const mesh = meshRef.current;
    if (!mesh) return;
    const time = state.clock.elapsedTime;
    grass.forEach((blade, index) => {
      const sway = Math.sin(time * 0.72 + blade.phase + blade.position[0] * 0.17) * 0.095;
      dummy.position.set(blade.position[0], blade.position[1] + 0.22 * blade.scale, blade.position[2]);
      dummy.rotation.set(sway * 0.22, blade.rotation, sway);
      dummy.scale.set(0.85 * blade.scale, blade.scale, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, grass.length]} frustumCulled={false}>
      <planeGeometry args={[0.1, 0.44, 1, 3]} />
      <meshStandardMaterial
        color="#ffffff"
        roughness={0.92}
        metalness={0}
        side={THREE.DoubleSide}
      />
    </instancedMesh>
  );
}

const SPONGES = [
  { position: [-5.05, 0.18, 2.05] as Vec3, scale: [0.24, 0.42, 0.24] as Vec3, color: '#bd7652' },
  { position: [-4.55, 0.1, -0.45] as Vec3, scale: [0.18, 0.34, 0.18] as Vec3, color: '#d39a64' },
  { position: [4.75, 0.16, 1.9] as Vec3, scale: [0.22, 0.38, 0.22] as Vec3, color: '#c57b5e' },
  { position: [5.25, 0.08, -2.1] as Vec3, scale: [0.2, 0.31, 0.2] as Vec3, color: '#d0a05f' },
  { position: [-3.45, -0.02, -4.0] as Vec3, scale: [0.17, 0.27, 0.17] as Vec3, color: '#b86d62' },
  { position: [3.55, -0.02, -4.1] as Vec3, scale: [0.18, 0.3, 0.18] as Vec3, color: '#cc8f68' },
] as const;

const SOFT_CORALS = [
  { position: [-4.1, 0.02, 2.75] as Vec3, rotation: -0.35, scale: 0.74, color: '#987aa6' },
  { position: [4.2, 0.0, 2.7] as Vec3, rotation: 0.28, scale: 0.68, color: '#b5798e' },
  { position: [-4.85, -0.04, -3.0] as Vec3, rotation: 0.15, scale: 0.62, color: '#8f789e' },
  { position: [4.85, -0.05, -3.05] as Vec3, rotation: -0.2, scale: 0.66, color: '#ad7e96' },
] as const;

function Sponge({ position, scale, color }: { position: Vec3; scale: Vec3; color: string }) {
  return (
    <mesh position={[position[0], position[1], position[2]]} scale={[scale[0], scale[1], scale[2]]}>
      <cylinderGeometry args={[0.52, 0.72, 1, 8, 1, true]} />
      <meshStandardMaterial color={color} roughness={0.96} metalness={0} side={THREE.DoubleSide} />
    </mesh>
  );
}

function SoftCoral({
  position,
  rotation,
  scale,
  color,
  reducedMotion,
}: {
  position: Vec3;
  rotation: number;
  scale: number;
  color: string;
  reducedMotion: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const phase = useMemo(() => position[0] * 0.71 + position[2] * 0.39, [position]);

  useFrame((state) => {
    if (reducedMotion || !groupRef.current) return;
    groupRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.48 + phase) * 0.045;
  });

  return (
    <group
      ref={groupRef}
      position={[position[0], position[1], position[2]]}
      rotation={[0, rotation, 0]}
      scale={scale}
    >
      {[-0.18, 0, 0.19].map((offset, index) => (
        <mesh
          key={`soft-coral-arm-${index}`}
          position={[offset, 0.18 + index * 0.05, 0]}
          rotation={[0, 0, offset * 0.65]}
        >
          <cylinderGeometry args={[0.035, 0.07, 0.48 + index * 0.08, 6]} />
          <meshStandardMaterial color={color} roughness={0.94} metalness={0} />
        </mesh>
      ))}
    </group>
  );
}

function StaticReefLife({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <>
      {SPONGES.map((sponge, index) => (
        <Sponge key={`reef-sponge-${index}`} {...sponge} />
      ))}
      {SOFT_CORALS.map((coral, index) => (
        <SoftCoral key={`reef-soft-coral-${index}`} {...coral} reducedMotion={reducedMotion} />
      ))}
    </>
  );
}

function buildFish(): FishInstance[] {
  return Array.from({ length: FISH_COUNT }, (_, index) => ({
    center: [
      THREE.MathUtils.lerp(-1.75, 2.05, seededUnit(index, 21)),
      THREE.MathUtils.lerp(2.45, 3.75, seededUnit(index, 22)),
      THREE.MathUtils.lerp(-8.2, -6.05, seededUnit(index, 23)),
    ],
    radiusX: THREE.MathUtils.lerp(0.9, 1.75, seededUnit(index, 24)),
    radiusZ: THREE.MathUtils.lerp(0.36, 0.78, seededUnit(index, 25)),
    speed: THREE.MathUtils.lerp(0.105, 0.175, seededUnit(index, 26)),
    phase: seededUnit(index, 27) * Math.PI * 2,
    scale: THREE.MathUtils.lerp(0.42, 0.62, seededUnit(index, 28)),
    heightDrift: THREE.MathUtils.lerp(0.07, 0.17, seededUnit(index, 29)),
  }));
}

function prepareFishPrototype(source: THREE.Group): THREE.Group {
  const prototype = source.clone(true);
  const bounds = new THREE.Box3().setFromObject(prototype);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const longestSide = Math.max(size.x, size.y, size.z, 0.0001);

  // Kenney's fish is authored lengthwise on X. Center and normalize it once,
  // then rotate +X into local +Z so the orbit heading can steer naturally.
  prototype.position.set(-center.x, -center.y, -center.z);
  prototype.rotation.y = -Math.PI / 2;
  prototype.scale.setScalar(1 / longestSide);

  prototype.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.castShadow = false;
    object.receiveShadow = false;
    object.frustumCulled = false;
  });

  return prototype;
}

function loadKenneyFish(): Promise<THREE.Group> {
  if (!kenneyFishPromise) {
    kenneyFishPromise = new Promise((resolve, reject) => {
      const loader = new OBJLoader();
      loader.load(
        KENNEY_FISH_MODEL_URL,
        (object) => resolve(prepareFishPrototype(object)),
        undefined,
        reject,
      );
    });
  }

  return kenneyFishPromise;
}

function createFishVariant(prototype: THREE.Group, index: number): THREE.Group {
  const clone = prototype.clone(true);
  const tint = FISH_TINTS[index % FISH_TINTS.length]!;

  clone.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.material = new THREE.MeshStandardMaterial({
      color: tint,
      roughness: 0.86,
      metalness: 0,
      flatShading: true,
    });
  });

  return clone;
}

function DistantFish({ reducedMotion }: { reducedMotion: boolean }) {
  const groupsRef = useRef<Array<THREE.Group | null>>([]);
  const fish = useMemo(buildFish, []);
  const [prototype, setPrototype] = useState<THREE.Group | null>(null);

  useEffect(() => {
    let cancelled = false;

    loadKenneyFish()
      .then((model) => {
        if (!cancelled) setPrototype(model);
      })
      .catch((error: unknown) => {
        if (import.meta.env.DEV) {
          console.warn('[reef] Kenney fish model failed to load.', error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const models = useMemo(
    () => (prototype ? fish.map((_, index) => createFishVariant(prototype, index)) : []),
    [fish, prototype],
  );

  const updateFish = (time: number) => {
    fish.forEach((item, index) => {
      const group = groupsRef.current[index];
      if (!group) return;

      const angle = time * item.speed + item.phase;
      const x = item.center[0] + Math.cos(angle) * item.radiusX;
      const z = item.center[2] + Math.sin(angle) * item.radiusZ;
      const wave = angle * 1.7 + item.phase;
      const y = item.center[1] + Math.sin(wave) * item.heightDrift;
      const dx = -Math.sin(angle) * item.radiusX;
      const dz = Math.cos(angle) * item.radiusZ;
      const dy = Math.cos(wave) * item.heightDrift * 1.7;
      const heading = Math.atan2(dx, dz);
      const pitch = Math.atan2(dy, Math.max(0.001, Math.hypot(dx, dz))) * 0.55;
      const swimWiggle = Math.sin(time * 2.45 + item.phase) * 0.045;
      const bank = THREE.MathUtils.clamp(-dx * 0.025, -0.08, 0.08);

      group.position.set(x, y, z);
      group.rotation.set(-pitch, heading + swimWiggle, bank);
      group.scale.setScalar(item.scale);
    });
  };

  useEffect(() => {
    if (models.length === 0) return;
    updateFish(0);
    // updateFish depends only on the stable memoized fish list and live refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [models]);

  useFrame((state) => {
    if (reducedMotion) return;
    updateFish(state.clock.elapsedTime);
  });

  if (models.length === 0) return null;

  return (
    <group name="reef-kenney-fish-school">
      {models.map((model, index) => (
        <group
          key={`reef-kenney-fish-${index}`}
          ref={(group) => {
            groupsRef.current[index] = group;
          }}
        >
          <primitive object={model} />
        </group>
      ))}
    </group>
  );
}

/**
 * Restrained life around the accepted reef object.
 *
 * The center stays intentionally clear. Vegetation and sessile life live on the
 * terrain margins while a small school of real low-poly fish adds depth without
 * competing with the hero colony.
 */
export function ReefLife({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <group name="reef-life-stage-3">
      <SeaGrass reducedMotion={reducedMotion} />
      <StaticReefLife reducedMotion={reducedMotion} />
      <DistantFish reducedMotion={reducedMotion} />
    </group>
  );
}
