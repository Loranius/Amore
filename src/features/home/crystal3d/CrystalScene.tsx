// ============================================================
// CrystalScene — 3D-рендер артефакту (Three.js / React Three Fiber)
// ------------------------------------------------------------
// «Artifact Engine»: справжній мінеральний друз (crystalCluster.ts — рендер-
// адаптер, ../artifact/ — renderer-agnostic процедурний рушій), що
// ЛЕВІТУЄ без жодної видимої основи (жодного каменю/п'єдесталу — див.
// deriveClusterBranch/буld*Domain у artifact/artifactNodes.ts). SVG
// Crystal.tsx лишається фолбеком (WebGL недоступний або ця сцена впала —
// див. CrystalErrorBoundary у HomePage.tsx) і досі на старій v1-геометрії
// (crystalGeometry.ts) — 2D-контур не потребує переписаної процедурної
// анатомії.
// ============================================================
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sparkles, MeshTransmissionMaterial, Environment, Lightformer } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import type * as THREE from 'three';
import {
  useCrystalDNA,
  useMilestoneEvents,
  useCrystalPlaces,
  useCrystalWishes,
  useAchievedGoals,
  useAnniversaryEvents,
  useCreationSources,
} from '../useCrystal';
import { useCrystalSeed } from '../useHome';
import { useMemories } from '../useMemories';
import { useClusterGrowthFlash } from '../useCrystalSeen';
import { hashSeedString } from '../mulberry32';
import { CrystalStats } from '../CrystalStats';
import { MemoryModal } from '../MemoryModal';
import {
  generateArtifactDNA,
  computeEvolutionPressures,
  buildArtifactNodes,
  isArtifactEmpty,
  type ArtifactInput,
} from '../artifact';
import { deriveClusterBranch, deriveClusterMaterial, buildBranchGeometry, type ClusterBranch, type ClusterMaterial } from './crystalCluster';

/** Центр вертикального «дихання» левітації — немає більше каменя, що заякорює композицію низько. */
const BOB_CENTER_Y = 0;

interface BranchProps {
  branch: ClusterBranch;
  geometry: THREE.BufferGeometry;
  material: ClusterMaterial;
  reduceMotion: boolean;
  useTransmission: boolean;
  onOpen: () => void;
}

/**
 * Один вузол артефакту. Власний useFrame замість групового scale — кожен
 * вузол дихає своєю фазою/швидкістю (breathePhase/breatheSpeed), тож
 * колонія пульсує не в унісон, а органічною хвилею. Розтяг лише по Y
 * (геометрія має основу в y=0) — виглядає як «підростання», не роздування.
 * Milestone-вузли (emissive) — золоте світіння замість фото-полірування,
 * щоб читались як веха, а не черговий приріст. 'core'-вузли отримують
 * додатковий, слабший luminosity-підсвіт (§4 левітації — світіння ядра
 * замінює світіння вже видаленої кам'яної основи).
 *
 * `useTransmission`: справжнє заломлення світла (MeshTransmissionMaterial)
 * коштує окремого рендеру всієї сцени в текстуру НА КОЖЕН інстанс щокадру —
 * тому це лише для головного стовбура й milestone-вузлів (CrystalCluster
 * вирішує, кому саме), а не для всіх ~40-70 гілок кластера.
 */
function Branch({ branch, geometry, material, reduceMotion, useTransmission, onOpen }: BranchProps) {
  const meshRef = useRef<THREE.Mesh | null>(null);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh || reduceMotion) return;
    const t = state.clock.elapsedTime;
    const micro = 1 + Math.sin(t * branch.breatheSpeed + branch.breathePhase) * 0.018;
    mesh.scale.set(1, micro, 1);
  });

  const coreGlow = branch.kind === 'core' ? material.glow * 0.5 : 0;

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      position={[branch.posX, branch.posY, branch.posZ]}
      rotation={[branch.tiltX, branch.rotY, branch.tiltZ]}
      onClick={onOpen}
    >
      {useTransmission ? (
        // transmissionSampler=true делегує заломлення в рідний, ОДИН-НА-СЦЕНУ
        // механізм THREE.WebGLRenderer (той самий, що вже безпечно працює в
        // звичайному meshPhysicalMaterial нижче) — власний per-інстанс
        // FBO-рендер MeshTransmissionMaterial конфліктував з EffectComposer/
        // Bloom (спостережено як повністю чорний кадр на одному з ракурсів).
        <MeshTransmissionMaterial
          vertexColors
          flatShading
          envMapIntensity={1.4}
          transmissionSampler
          transmission={1}
          thickness={0.6}
          roughness={branch.emissive ? 0.08 : 0.02}
          ior={1.6}
          chromaticAberration={0.25}
          anisotropicBlur={0.4}
          distortion={0.4}
          distortionScale={0.4}
          temporalDistortion={0.15}
          clearcoat={branch.emissive ? 0.9 : material.clearcoat}
          clearcoatRoughness={0.06}
          emissive={branch.emissive ? '#e8b23d' : '#ff9d5c'}
          emissiveIntensity={branch.emissive ? 0.4 : coreGlow}
        />
      ) : (
        <meshPhysicalMaterial
          vertexColors
          flatShading
          envMapIntensity={1.4}
          roughness={branch.emissive ? 0.15 : material.roughness}
          metalness={branch.emissive ? 0.1 : 0}
          transmission={branch.emissive ? 0.15 : material.transmission}
          thickness={0.6}
          clearcoat={branch.emissive ? 0.9 : material.clearcoat}
          clearcoatRoughness={0.06}
          ior={1.6}
          reflectivity={branch.emissive ? 0.7 : 0.6}
          emissive={branch.emissive ? '#e8b23d' : '#ff9d5c'}
          emissiveIntensity={branch.emissive ? 0.4 : coreGlow}
        />
      )}
    </mesh>
  );
}

interface ClusterProps {
  material: ClusterMaterial;
  branches: ClusterBranch[];
  reduceMotion: boolean;
  grew: boolean;
  onOpen: () => void;
}

function CrystalCluster({ material, branches, reduceMotion, grew, onOpen }: ClusterProps) {
  const groupRef = useRef<THREE.Group | null>(null);
  const flashLightRef = useRef<THREE.PointLight | null>(null);
  const flashUntil = useRef(grew ? performance.now() + 1300 : 0);
  const flashDuration = useRef(1300);
  const flashPeak = useRef(2.2);
  // Спокійна «підлога» світіння від Luminosity Pressure — раніше спалах
  // стрибав з нуля, тепер додається поверх завжди трохи теплого ядра
  // (заміна світінню вже видаленої кам'яної основи).
  const baseIntensity = material.glow * 0.6;

  // Дотик/тап — короткий теплий спалах (реакція «артефакт відчув доторк»),
  // окремий від довшого/яскравішого спалаху на «виріс новий вузол».
  const onTouch = () => {
    flashUntil.current = performance.now() + 450;
    flashDuration.current = 450;
    flashPeak.current = 1.1;
  };

  const branchMeshes = useMemo(
    () => branches.map((branch) => ({ branch, geometry: buildBranchGeometry(branch, material) })),
    [branches, material],
  );

  // Найвищий 'core'-вузол читається як головний стовбур друзи — саме йому
  // (плюс усім milestone-вузлам) дістається дороге справжнє заломлення
  // світла (MeshTransmissionMaterial), решта ~40-70 гілок лишається на
  // дешевшому meshPhysicalMaterial.
  const heroCoreKey = useMemo(() => {
    let best: ClusterBranch | null = null;
    for (const b of branches) {
      if (b.kind === 'core' && (!best || b.height > best.height)) best = b;
    }
    return best?.key ?? null;
  }, [branches]);

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
      // Легкий колективний подих усієї колонії — поверх нього кожен вузол
      // додає власну мікро-фазу, тому рух не в унісон.
      const breathe = 1 + Math.sin(state.clock.elapsedTime * 0.35) * 0.008;
      group.scale.setScalar(breathe);
      // Левітація: артефакт повільно гойдається вгору-вниз, без жодної
      // видимої опори (§4 — «no visible foundation»).
      group.position.y = BOB_CENTER_Y + Math.sin(state.clock.elapsedTime * 0.18) * 0.12;
    }
    const light = flashLightRef.current;
    if (light) {
      const remain = flashUntil.current - performance.now();
      const flash = flashUntil.current && remain > 0 ? (remain / flashDuration.current) * flashPeak.current : 0;
      light.intensity = baseIntensity + flash;
      if (flashUntil.current && remain <= 0) flashUntil.current = 0;
    }
  });

  return (
    <group ref={groupRef} onPointerDown={onTouch}>
      <pointLight ref={flashLightRef} position={[0, 0.5, 0]} color="#fff2cf" intensity={baseIntensity} distance={4} />
      {branchMeshes.map(({ branch, geometry }) => (
        <Branch
          key={branch.key}
          branch={branch}
          geometry={geometry}
          material={material}
          reduceMotion={reduceMotion}
          useTransmission={branch.kind === 'milestone' || branch.key === heroCoreKey}
          onOpen={onOpen}
        />
      ))}
    </group>
  );
}

/**
 * Захист прозорості канвасу — на реальному пристрої користувача фон
 * .crystal-wrap іноді ставав суцільним білим прямокутником замість
 * прозорого рожевого фону сторінки, хоча .crystal-wrap явно
 * `background: transparent`, а @react-three/fiber створює WebGLRenderer з
 * `alpha: true` за замовчуванням. Підозра — одноразовий рендер кубічної
 * камери <Environment> (frames=1) міг лишити clearColor/clearAlpha
 * рендерера зміненими без відновлення. <EffectComposer> рендерить на
 * пріоритеті 1 (@react-three/postprocessing/EffectComposer.tsx), тож
 * useFrame за замовчуванням (пріоритет 0) тут гарантовано виконується
 * РАНІШЕ — щокадру примусово повертає прозорий clearColor перед фінальним
 * композитним рендером, незалежно від того, що саме й де його зіпсувало.
 */
function TransparencyGuard() {
  useFrame(({ gl }) => {
    gl.setClearColor(0x000000, 0);
  });
  return null;
}

/** Артефакт ще «не почав рости» — бліда жовта насінина, що чекає на перші дані. */
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
  const { achievedGoals, isPending: goalsPending } = useAchievedGoals();
  const { anniversaries, isPending: anniversariesPending } = useAnniversaryEvents();
  const { recipes, movies, books, isPending: creationPending } = useCreationSources();

  const isPending =
    dnaPending ||
    seedPending ||
    milestonesPending ||
    placesPending ||
    wishesPending ||
    memoriesPending ||
    goalsPending ||
    anniversariesPending ||
    creationPending;

  const seedNum = useMemo(() => hashSeedString(seed ?? ''), [seed]);
  const artifactDNA = useMemo(() => generateArtifactDNA(seed ?? ''), [seed]);
  const memoriesCount = memories?.length ?? 0;
  const memoryItems = useMemo(
    () => (memories ?? []).map((m) => ({ id: m.id, date: m.date })),
    [memories],
  );

  const input: ArtifactInput = useMemo(
    () => ({
      seedNum,
      dna: artifactDNA,
      usage: dna,
      countries,
      cities,
      milestones,
      wishes,
      achievedGoals,
      anniversaries,
      recipes,
      movies,
      books,
      memoriesCount,
      memories: memoryItems,
    }),
    [
      seedNum,
      artifactDNA,
      dna,
      countries,
      cities,
      milestones,
      wishes,
      achievedGoals,
      anniversaries,
      recipes,
      movies,
      books,
      memoriesCount,
      memoryItems,
    ],
  );

  const empty = !isPending && isArtifactEmpty(input);
  const pressures = useMemo(() => computeEvolutionPressures(input), [input]);
  const material = useMemo(() => deriveClusterMaterial(pressures), [pressures]);
  const branches = useMemo(
    () => (empty ? [] : buildArtifactNodes(input, pressures).map((node) => deriveClusterBranch(node, artifactDNA))),
    [empty, input, pressures, artifactDNA],
  );
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
          <TransparencyGuard />
          <ambientLight intensity={0.5} />
          <directionalLight position={[3, 4, 2]} intensity={1.1} />
          <pointLight position={[-3, -2, -2]} intensity={0.4} color="#e6a0bd" />
          {/* Заломлення (MeshTransmissionMaterial) гне те, що ПОЗАДУ об'єкта —
              без цього тут лише рівний рожевий фон, тож ефект технічно працює,
              але візуально непомітний («просто звичайна модель»). Ця
              процедурна (без зовнішніх HDRI-файлів) підсвітка лише годує
              заломлення/відбиття кольором — на видимий рожевий фон сторінки
              не впливає (background={false}). */}
          <Environment resolution={128} background={false}>
            <Lightformer form="ring" color="#ffd9a8" intensity={6} scale={5} position={[2.5, 1.2, -2]} />
            <Lightformer form="ring" color="#7fd8d1" intensity={5} scale={4} position={[-2.5, -1, -1.5]} />
            <Lightformer form="rect" color="#e8b23d" intensity={4} scale={[4, 1.5, 1]} position={[0, 3, -1]} />
            <Lightformer form="rect" color="#ffffff" intensity={3} scale={[2, 2, 1]} position={[0, 0.5, 3]} rotation={[0, Math.PI, 0]} />
          </Environment>
          {!isPending &&
            (empty ? (
              <CrystalSeed reduceMotion={reduceMotion} />
            ) : (
              <CrystalCluster
                material={material}
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
