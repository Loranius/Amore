// ============================================================
// CrystalScene — 3D-рендер кристала (Three.js / React Three Fiber)
// ------------------------------------------------------------
// «Crystal Engine v2.0»: справжній мінеральний друз (crystalCluster.ts),
// що виростає з потрісканої породи, а не набір категорійних шипів на
// сфері (v1). SVG Crystal.tsx лишається фолбеком (WebGL недоступний або
// ця сцена впала — див. CrystalErrorBoundary у HomePage.tsx) і досі на
// старій v1-геометрії (crystalGeometry.ts) — 2D-контур не потребує
// переписаної процедурної анатомії.
// ============================================================
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sparkles } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import type * as THREE from 'three';
import { useCrystalDNA, useMilestoneEvents, useCrystalPlaces, useCrystalWishes } from '../useCrystal';
import { useCrystalSeed } from '../useHome';
import { useMemories } from '../useMemories';
import { useClusterGrowthFlash } from '../useCrystalSeen';
import { hashSeedString } from '../mulberry32';
import { CrystalStats } from '../CrystalStats';
import { MemoryModal } from '../MemoryModal';
import {
  buildClusterBranches,
  buildBranchGeometry,
  buildFoundationGeometry,
  computeClusterMaterial,
  isClusterEmpty,
  type ClusterInput,
  type ClusterBranch,
  type ClusterMaterial,
} from './crystalCluster';

const BASE_Y = -1.3;

interface BranchProps {
  branch: ClusterBranch;
  geometry: THREE.BufferGeometry;
  material: ClusterMaterial;
  reduceMotion: boolean;
  onOpen: () => void;
}

/**
 * Одна гілка кристала. Власний useFrame замість групового scale — кожна
 * гілка дихає своєю фазою/швидкістю (breathePhase/breatheSpeed), тож
 * колонія пульсує не в унісон, а органічною хвилею. Розтяг лише по Y
 * (геометрія має основу в y=0) — виглядає як «підростання», не роздування.
 * Milestone-гілки (emissive) — золоте світіння замість фото-полірування,
 * щоб читались як веха, а не черговий приріст.
 */
function Branch({ branch, geometry, material, reduceMotion, onOpen }: BranchProps) {
  const meshRef = useRef<THREE.Mesh | null>(null);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh || reduceMotion) return;
    const t = state.clock.elapsedTime;
    const micro = 1 + Math.sin(t * branch.breatheSpeed + branch.breathePhase) * 0.018;
    mesh.scale.set(1, micro, 1);
  });

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      position={[branch.posX, BASE_Y, branch.posZ]}
      rotation={[branch.tiltX, branch.rotY, branch.tiltZ]}
      onClick={onOpen}
    >
      <meshPhysicalMaterial
        vertexColors
        roughness={branch.emissive ? 0.15 : material.roughness}
        metalness={branch.emissive ? 0.1 : 0}
        transmission={branch.emissive ? 0.15 : material.transmission}
        thickness={0.6}
        clearcoat={branch.emissive ? 0.9 : material.clearcoat}
        clearcoatRoughness={0.06}
        ior={1.6}
        reflectivity={branch.emissive ? 0.7 : 0.6}
        emissive={branch.emissive ? '#e8b23d' : '#000000'}
        emissiveIntensity={branch.emissive ? 0.4 : 0}
      />
    </mesh>
  );
}

/**
 * Потріскана мінеральна брила замість сфери — кристал росте З КАМЕНЮ,
 * не з ідеальної кулі. Спогади (memoryGlow) зігрівають її зсередини.
 */
function Foundation({
  seedNum,
  memoryGlow,
  reduceMotion,
}: {
  seedNum: number;
  memoryGlow: number;
  reduceMotion: boolean;
}) {
  const meshRef = useRef<THREE.Mesh | null>(null);
  const geometry = useMemo(() => buildFoundationGeometry(seedNum), [seedNum]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((state) => {
    if (!meshRef.current || reduceMotion) return;
    // Порода дихає ледь помітно — це камінь, не живий шип.
    const breathe = 1 + Math.sin(state.clock.elapsedTime * 0.3 + 2.1) * 0.006;
    meshRef.current.scale.setScalar(breathe);
  });

  return (
    <mesh ref={meshRef} geometry={geometry} position={[0, BASE_Y, 0]}>
      <meshPhysicalMaterial
        color="#463c4d"
        roughness={0.92}
        clearcoat={0.1}
        emissive="#ff9d5c"
        emissiveIntensity={memoryGlow}
      />
    </mesh>
  );
}

interface ClusterProps {
  input: ClusterInput;
  branches: ClusterBranch[];
  reduceMotion: boolean;
  grew: boolean;
  onOpen: () => void;
}

function CrystalCluster({ input, branches, reduceMotion, grew, onOpen }: ClusterProps) {
  const groupRef = useRef<THREE.Group | null>(null);
  const flashLightRef = useRef<THREE.PointLight | null>(null);
  const flashUntil = useRef(grew ? performance.now() + 1300 : 0);
  const flashDuration = useRef(1300);
  const flashPeak = useRef(2.2);

  // Дотик/тап — короткий теплий спалах (реакція «кристал відчув доторк»),
  // окремий від довшого/яскравішого спалаху на «виросла нова гілка».
  const onTouch = () => {
    flashUntil.current = performance.now() + 450;
    flashDuration.current = 450;
    flashPeak.current = 1.1;
  };

  const material = useMemo(() => computeClusterMaterial(input), [input]);
  const branchMeshes = useMemo(
    () => branches.map((branch) => ({ branch, geometry: buildBranchGeometry(branch, material) })),
    [branches, material],
  );

  useEffect(
    () => () => branchMeshes.forEach(({ geometry }) => geometry.dispose()),
    [branchMeshes],
  );

  useFrame((state, delta) => {
    const group = groupRef.current;
    if (group && !reduceMotion) {
      group.rotation.y += delta * 0.1;
      // Легке погойдування по X/Z (незалежні повільні хвилі) — «трохи
      // рухається» поверх постійного обертання навколо Y.
      group.rotation.x = Math.sin(state.clock.elapsedTime * 0.17) * 0.025;
      group.rotation.z = Math.sin(state.clock.elapsedTime * 0.13 + 1.7) * 0.018;
      // Легкий колективний подих усієї колонії — поверх нього кожна гілка
      // додає власну мікро-фазу, тому рух не в унісон.
      const breathe = 1 + Math.sin(state.clock.elapsedTime * 0.35) * 0.008;
      group.scale.setScalar(breathe);
    }
    const light = flashLightRef.current;
    if (light && flashUntil.current) {
      const remain = flashUntil.current - performance.now();
      light.intensity = Math.max(0, (remain / flashDuration.current) * flashPeak.current);
      if (remain <= 0) flashUntil.current = 0;
    }
  });

  return (
    <group ref={groupRef} onPointerDown={onTouch}>
      <pointLight
        ref={flashLightRef}
        position={[0, BASE_Y + 0.5, 0]}
        color="#fff2cf"
        intensity={0}
        distance={4}
      />
      <Foundation seedNum={input.seedNum} memoryGlow={material.glow} reduceMotion={reduceMotion} />
      {branchMeshes.map(({ branch, geometry }) => (
        <Branch
          key={branch.key}
          branch={branch}
          geometry={geometry}
          material={material}
          reduceMotion={reduceMotion}
          onOpen={onOpen}
        />
      ))}
    </group>
  );
}

/** Кристал ще «не почав рости» — бліда жовта насінина, що чекає на перші дані. */
function CrystalSeed({ reduceMotion }: { reduceMotion: boolean }) {
  const meshRef = useRef<THREE.Mesh | null>(null);

  useFrame((state) => {
    if (!meshRef.current || reduceMotion) return;
    meshRef.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 0.5) * 0.035);
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[0.55, 32, 24]} />
      <meshPhysicalMaterial
        color="#fdf0b8"
        emissive="#fdeaa0"
        emissiveIntensity={0.25}
        roughness={0.55}
        transmission={0.08}
        clearcoat={0.3}
      />
    </mesh>
  );
}

export default function CrystalScene() {
  const { dna, deltas, isPending: dnaPending } = useCrystalDNA();
  const { seed, isPending: seedPending } = useCrystalSeed();
  const { milestones, isPending: milestonesPending } = useMilestoneEvents();
  const { countries, cities, isPending: placesPending } = useCrystalPlaces();
  const { wishes, isPending: wishesPending } = useCrystalWishes();
  const { data: memories, isPending: memoriesPending } = useMemories();

  const isPending =
    dnaPending || seedPending || milestonesPending || placesPending || wishesPending || memoriesPending;
  const seedNum = useMemo(() => hashSeedString(seed ?? ''), [seed]);
  const memoriesCount = memories?.length ?? 0;

  const input: ClusterInput = useMemo(
    () => ({ seedNum, dna, countries, cities, milestones, wishes, memoriesCount }),
    [seedNum, dna, countries, cities, milestones, wishes, memoriesCount],
  );

  const empty = !isPending && isClusterEmpty(input);
  const branches = useMemo(() => (empty ? [] : buildClusterBranches(input)), [empty, input]);
  const branchKeys = useMemo(() => branches.map((b) => b.key), [branches]);
  const { grew } = useClusterGrowthFlash(branchKeys, isPending || empty);

  const [open, setOpen] = useState(false);
  const [reduceMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  const sparkleCount = Math.min(60, 14 + branches.length * 1.2);

  const openModal = () => setOpen(true);
  const onKeyDownOpen = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openModal();
    }
  };

  return (
    <>
      <div
        className="crystal-wrap"
        role="button"
        tabIndex={0}
        aria-label="Кристал Amore — показати випадковий спогад"
        onKeyDown={onKeyDownOpen}
      >
        <Canvas dpr={[1, 2]} camera={{ position: [0, 0.2, 5.4], fov: 42 }}>
          <ambientLight intensity={0.5} />
          <directionalLight position={[3, 4, 2]} intensity={1.1} />
          <pointLight position={[-3, -2, -2]} intensity={0.4} color="#e6a0bd" />
          {!isPending &&
            (empty ? (
              <CrystalSeed reduceMotion={reduceMotion} />
            ) : (
              <CrystalCluster
                input={input}
                branches={branches}
                reduceMotion={reduceMotion}
                grew={grew}
                onOpen={openModal}
              />
            ))}
          <Sparkles
            count={sparkleCount}
            scale={3.2}
            size={2}
            speed={reduceMotion ? 0 : 0.2}
            color="#ffe9f2"
            position={[0, 0.2, 0]}
          />
          <OrbitControls
            enablePan={false}
            enableZoom={false}
            enableDamping={!reduceMotion}
            dampingFactor={0.08}
            target={[0, 0.2, 0]}
          />
          <EffectComposer>
            <Bloom intensity={0.6} luminanceThreshold={0.3} luminanceSmoothing={0.4} mipmapBlur />
          </EffectComposer>
        </Canvas>
      </div>

      <CrystalStats dna={dna} deltas={deltas} isPending={isPending} />

      {open && <MemoryModal onClose={() => setOpen(false)} />}
    </>
  );
}
