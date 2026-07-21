// ============================================================
// CrystalScene — 3D-рендер кристала (Three.js / React Three Fiber)
// ------------------------------------------------------------
// Основний рендер «Crystal Engine v1.0»; SVG Crystal.tsx лишається
// фолбеком (WebGL недоступний або ця сцена впала — див.
// CrystalErrorBoundary у HomePage.tsx). ДНК/пороги категорій ідентичні
// SVG-версії (crystalGeometry.ts). Кристал — кластер гранованих шипів
// (buildSpikes), що ростуть із «підошви»; поки в парі взагалі немає
// даних — лише бліда жовта «насінина» (CrystalSeed), яка чекає на ріст.
// ============================================================
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sparkles } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import type * as THREE from 'three';
import { useCrystalDNA, useMilestoneEvents } from '../useCrystal';
import type { CrystalDNA } from '../useCrystal';
import { useCrystalSeen, MILESTONE_SEEN_KEY } from '../useCrystalSeen';
import { useCrystalSeed } from '../useHome';
import { hashSeedString } from '../mulberry32';
import { CATEGORY_DEFS, isDnaEmpty } from '../crystalGeometry';
import { CrystalStats } from '../CrystalStats';
import { MemoryModal } from '../MemoryModal';
import {
  buildSpikes,
  buildSpikeGeometry,
  buildMilestoneSpikes,
  totalRichness,
  stageForRichness,
  stageLabel,
  type SpikeSpec,
  type MilestoneSpike,
} from './crystalGeometry3d';

const BASE_Y = -1.3;

interface SpikeProps {
  spec: SpikeSpec;
  geometry: THREE.BufferGeometry;
  roughness: number;
  clearcoat: number;
  reduceMotion: boolean;
  onOpen: () => void;
}

/**
 * Один шип-грань. Власний useFrame замість групового scale — кожен шип
 * дихає своєю фазою/швидкістю (SpikeSpec.breathePhase/breatheSpeed), тож
 * колонія пульсує не в унісон, а органічною хвилею. Розтяг лише по Y
 * (геометрія має основу в y=0) — виглядає як «підростання», не роздування.
 */
function Spike({ spec, geometry, roughness, clearcoat, reduceMotion, onOpen }: SpikeProps) {
  const meshRef = useRef<THREE.Mesh | null>(null);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh || reduceMotion) return;
    const t = state.clock.elapsedTime;
    const micro = 1 + Math.sin(t * spec.breatheSpeed + spec.breathePhase) * 0.018;
    mesh.scale.set(1, micro, 1);
  });

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      position={[spec.posX, BASE_Y, spec.posZ]}
      rotation={[spec.tiltX, spec.rotY, spec.tiltZ]}
      onClick={onOpen}
    >
      <meshPhysicalMaterial
        vertexColors
        roughness={roughness}
        metalness={0}
        transmission={0.4}
        thickness={0.7}
        clearcoat={clearcoat}
        clearcoatRoughness={0.08}
        ior={1.6}
        reflectivity={0.6}
      />
    </mesh>
  );
}

/**
 * Шпиль великої життєвої події (заручини/весілля/переїзд тощо) — та сама
 * механіка дихання, що й Spike, але з теплим золотим світінням (emissive),
 * щоб він явно читався як «веха», а не черговий шип категорії.
 */
function MilestoneSpikeMesh({
  spec,
  geometry,
  reduceMotion,
  onOpen,
}: {
  spec: MilestoneSpike;
  geometry: THREE.BufferGeometry;
  reduceMotion: boolean;
  onOpen: () => void;
}) {
  const meshRef = useRef<THREE.Mesh | null>(null);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh || reduceMotion) return;
    const t = state.clock.elapsedTime;
    const micro = 1 + Math.sin(t * spec.breatheSpeed + spec.breathePhase) * 0.02;
    mesh.scale.set(1, micro, 1);
  });

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      position={[spec.posX, BASE_Y, spec.posZ]}
      rotation={[spec.tiltX, spec.rotY, spec.tiltZ]}
      onClick={onOpen}
    >
      <meshPhysicalMaterial
        vertexColors
        roughness={0.15}
        metalness={0.1}
        transmission={0.15}
        thickness={0.5}
        clearcoat={0.9}
        clearcoatRoughness={0.05}
        ior={1.6}
        reflectivity={0.7}
        emissive="#e8b23d"
        emissiveIntensity={0.4}
      />
    </mesh>
  );
}

interface ClusterProps {
  dna: CrystalDNA;
  seedNum: number;
  milestones: ReadonlyArray<{ id: number; title: string }>;
  reduceMotion: boolean;
  grew: boolean;
  onOpen: () => void;
}

function CrystalCluster({ dna, seedNum, milestones, reduceMotion, grew, onOpen }: ClusterProps) {
  const groupRef = useRef<THREE.Group | null>(null);
  const flashLightRef = useRef<THREE.PointLight | null>(null);
  const flashUntil = useRef(grew ? performance.now() + 1300 : 0);
  const flashDuration = useRef(1300);
  const flashPeak = useRef(2.2);

  // Дотик/тап — короткий теплий спалах (реакція «кристал відчув доторк»),
  // окремий від довшого/яскравішого спалаху на «виросла нова грань».
  const onTouch = () => {
    flashUntil.current = performance.now() + 450;
    flashDuration.current = 450;
    flashPeak.current = 1.1;
  };

  const spikeMeshes = useMemo(
    () => buildSpikes(dna, seedNum).map((spec) => ({ spec, geometry: buildSpikeGeometry(spec) })),
    [dna, seedNum],
  );
  const milestoneMeshes = useMemo(
    () => buildMilestoneSpikes(milestones, seedNum).map((spec) => ({ spec, geometry: buildSpikeGeometry(spec) })),
    [milestones, seedNum],
  );

  // Досягнуті цілі «полірують» кристал — нижчий roughness, вищий clearcoat.
  const roughness = Math.max(0.08, 0.24 - dna.goalsAchieved * 0.015);
  const clearcoat = Math.min(0.95, 0.7 + dna.goalsAchieved * 0.02);

  useEffect(
    () => () => spikeMeshes.forEach(({ geometry }) => geometry.dispose()),
    [spikeMeshes],
  );
  useEffect(
    () => () => milestoneMeshes.forEach(({ geometry }) => geometry.dispose()),
    [milestoneMeshes],
  );

  useFrame((state, delta) => {
    const group = groupRef.current;
    if (group && !reduceMotion) {
      group.rotation.y += delta * 0.1;
      // Легке погойдування по X/Z (незалежні повільні хвилі) — «трохи
      // рухається» поверх постійного обертання навколо Y.
      group.rotation.x = Math.sin(state.clock.elapsedTime * 0.17) * 0.025;
      group.rotation.z = Math.sin(state.clock.elapsedTime * 0.13 + 1.7) * 0.018;
      // Легкий колективний подих усієї колонії — поверх нього кожен Spike
      // додає власну мікро-фазу (SpikeSpec.breathePhase), тому рух не в унісон.
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
      <mesh position={[0, BASE_Y, 0]}>
        <sphereGeometry args={[0.34, 24, 16]} />
        <meshPhysicalMaterial color="#4a3f52" roughness={0.85} clearcoat={0.15} />
      </mesh>
      {spikeMeshes.map(({ spec, geometry }) => (
        <Spike
          key={spec.key}
          spec={spec}
          geometry={geometry}
          roughness={roughness}
          clearcoat={clearcoat}
          reduceMotion={reduceMotion}
          onOpen={onOpen}
        />
      ))}
      {milestoneMeshes.map(({ spec, geometry }) => (
        <MilestoneSpikeMesh
          key={spec.key}
          spec={spec}
          geometry={geometry}
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
  const isPending = dnaPending || seedPending || milestonesPending;
  const seedNum = useMemo(() => hashSeedString(seed ?? ''), [seed]);
  const empty = !isPending && isDnaEmpty(dna);
  const { seenSnapshot, isFirstVisit } = useCrystalSeen(dna, isPending, milestones.length);
  const [open, setOpen] = useState(false);
  const [reduceMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  const grew =
    !isPending &&
    !empty &&
    (isFirstVisit ||
      CATEGORY_DEFS.some((cat) => cat.facetsFor(cat.metric(dna)) > (seenSnapshot?.[cat.key] ?? 0)) ||
      milestones.length > (seenSnapshot?.[MILESTONE_SEEN_KEY] ?? 0));

  const sparkleCount = Math.min(60, 10 + Math.round(dna.photos / 2));
  const stage = !isPending && !empty ? stageForRichness(totalRichness(dna)) : null;

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
                dna={dna}
                seedNum={seedNum}
                milestones={milestones}
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

      {stage && <p className="crystal-stage-label">🔮 Стадія: {stageLabel(stage)}</p>}

      <CrystalStats dna={dna} deltas={deltas} isPending={isPending} />

      {open && <MemoryModal onClose={() => setOpen(false)} />}
    </>
  );
}
