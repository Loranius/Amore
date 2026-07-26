// ============================================================
// CrystalScene — 3D-рендер артефакту (Three.js / React Three Fiber)
// ------------------------------------------------------------
// «Artifact Engine»: справжній мінеральний друз (crystalCluster.ts — рендер-
// адаптер, ../artifact/ — renderer-agnostic геологічний симулятор
// mineralDeposition.ts), що ЛЕВІТУЄ без жодної видимої основи (жодного
// каменю/п'єдесталу — див. deriveClusterBranch). SVG
// Crystal.tsx лишається фолбеком (WebGL недоступний або ця сцена впала —
// див. CrystalErrorBoundary у HomePage.tsx) і досі на старій v1-геометрії
// (crystalGeometry.ts) — 2D-контур не потребує переписаної процедурної
// анатомії.
// ------------------------------------------------------------
// Навмисно БЕЗ <Environment>/<Lightformer> (drei) і БЕЗ <EffectComposer>/
// <Bloom> (@react-three/postprocessing): на реальному пристрої користувача
// фон .crystal-wrap ставав суцільним білим прямокутником залежно від кута
// камери (зникав лише коли дивитись знизу, де в кадрі взагалі нема
// геометрії) — виміряно напряму по пікселях у надісланих скріншотах
// (справжній колір сторінки ~rgb(255,244,247), «баг» — точний rgb(255,255,255)).
// Не відтворюється в headless Chromium цієї сесії (ні npm run dev, ні
// продакшн-білд через vite preview), тож це, найімовірніше, специфічна для
// мобільного GPU/драйвера поведінка навколо HalfFloat-рендер-таргетів, які
// використовують і Environment (кубічна карта), і EffectComposer (внутрішні
// таргети) — обидва одразу прибрані як найбільш підозрілі, оскільки два
// попередні точкові фікси (скидання clearColor щокадру; повне прибирання
// material.transmission) НЕ допомогли. «Скляний» вигляд лишається на самих
// PBR-параметрах (clearcoat/roughness/ior) без глобальної підсвітки ззовні.
// ============================================================
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sparkles } from '@react-three/drei';
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
import { BREATHE_AMPLITUDE, deriveClusterBranch, deriveClusterMaterial, type ClusterBranch, type ClusterMaterial } from './crystalCluster';
import { breatheBatch, buildBodyBatches, disposeBatches } from './render/batchedBodies';
import { formatPublicationReport, publishCrystal } from './crystalPublication';
import { RENDERED_LOD } from './geometry/lod';

/** Центр вертикального «дихання» левітації — немає більше каменя, що заякорює композицію низько. */
const BOB_CENTER_Y = 0;

// Тіло більше не має власного React-компонента й власного матеріалу: усі
// тіла зведені в кілька BatchedMesh за матеріалом (render/batchedBodies.ts),
// а самі PBR-параметри переїхали в material/bodyMaterial.ts (Volume VI —
// це матеріальні властивості, а не деталь рендер-компонента). Подих кожного
// тіла лишився власним: його несе матриця екземпляра.

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
  // Спогади задають, ЧИ світиться ядро; спільно переглянуті фільми — НАСКІЛЬКИ
  // яскраво (той самий множник, що в bodyMaterial.ts::coreGlow, щоб внутрішнє
  // світло й емісія тіла не розходились).
  const baseIntensity = material.glow * 0.6 * (1 + material.brilliance * 0.8);

  // Дотик/тап — короткий теплий спалах (реакція «артефакт відчув доторк»),
  // окремий від довшого/яскравішого спалаху на «виріс новий вузол».
  const onTouch = () => {
    flashUntil.current = performance.now() + 450;
    flashDuration.current = 450;
    flashPeak.current = 1.1;
  };

  // Volume V — зовнішня оболонка (`CAI-REQ-005..008`). Мешi будуються, а
  // потім кожен віддає обробці стику ті грані, що сидять усередині сусідів:
  // заглиблена кришка основи й приховані грані зникають, і маса читається
  // як ОДНЕ зрощене тіло, а не стос окремих замкнених кристалів. Зріз
  // робиться один раз тут, а не щокадру — це чиста функція від геометрії.
  // Порядок «форма → зріз стику → матеріал → валідація» живе в
  // publishCrystal — одне місце на сцену, тести й dev-харнес.
  // Про вибір рівня деталізації див. RENDERED_LOD: автозниження якості
  // виміряно шкідливе (воно збільшує draw calls).
  const published = useMemo(
    () => publishCrystal(branches, material, { lod: RENDERED_LOD }),
    [branches, material],
  );
  // Малюємо лише те, що має що малювати: тіла, повністю поховані в сусідах,
  // після зрізу порожні, а порожній меш усе одно коштує draw call.
  //
  // Далі тіла зводяться в батчі за матеріалом (render/batchedBodies.ts):
  // різних наборів PBR-параметрів усього 6-7, тож 27-42 окремі мешi
  // стають 6-7 draw calls. Подих кожного тіла лишається власним — його
  // несе матриця екземпляра, а не спільний трансформ.
  const batches = useMemo(
    () => buildBodyBatches(published.renderable, material),
    [published, material],
  );

  // Гейт публікації (`CAI-REQ-012`). У проді не блокує рендер — порожній
  // екран замість кристала гірший за перетин, — але в dev кричить.
  // Справжній гейт стоїть у тестах і `npm run build`.
  useEffect(() => {
    if (!import.meta.env.DEV || published.ok) return;
    console.error(`[crystal publication]\n${formatPublicationReport(published)}`);
  }, [published]);

  // Батчі копіюють геометрію у власні буфери, тож звільняти треба і їх, і
  // вихідні геометрії публікації.
  useEffect(() => {
    const bodies = published.bodies;
    return () => {
      disposeBatches(batches);
      bodies.forEach(({ geometry }) => geometry.dispose());
    };
  }, [batches, published]);

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
      // Мікро-дихання кожного тіла (власна фаза/швидкість). Тепер це
      // матриця екземпляра в батчі, а не scale окремого меша — рух той
      // самий, викликів рендера менше.
      const t = state.clock.elapsedTime;
      for (const batch of batches) breatheBatch(batch, t, BREATHE_AMPLITUDE);
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
      {batches.map((batch) => (
        <primitive key={batch.signature} object={batch.mesh} onClick={onOpen} />
      ))}
    </group>
  );
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
        transmission={0}
        clearcoat={0.3}
      />
    </mesh>
  );
}

export default function CrystalScene() {
  const { dna, photos, deltas, isPending: dnaPending } = useCrystalDNA();
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

  // Регенерація: кнопка перекочує лише «генетику» (seed) — та сама історія
  // пари (дні/місця/спогади) проявляється в новій композиції друзи, як того
  // хоче рушій. Ефемерно (не чіпає збережений couple-seed): reload повертає
  // справжній кристал.
  const [seedOverride, setSeedOverride] = useState<string | null>(null);
  const effectiveSeed = seedOverride ?? seed ?? '';
  const regenerate = () => {
    const chunk = () => Math.floor(Math.random() * 0x10000).toString(16).toUpperCase().padStart(4, '0');
    setSeedOverride(`${chunk()}-${chunk()}-${chunk()}`);
  };

  const seedNum = useMemo(() => hashSeedString(effectiveSeed), [effectiveSeed]);
  const artifactDNA = useMemo(() => generateArtifactDNA(effectiveSeed), [effectiveSeed]);
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
      photos,
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
      photos,
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
          <ambientLight intensity={0.5} />
          <directionalLight position={[3, 4, 2]} intensity={1.1} />
          <pointLight position={[-3, -2, -2]} intensity={0.4} color="#e6a0bd" />
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
        </Canvas>
        <button
          type="button"
          className="crystal-regen"
          aria-label="Перегенерувати кристал"
          title="Перегенерувати кристал"
          onClick={(e) => {
            e.stopPropagation();
            regenerate();
          }}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M20 11a8 8 0 1 0-.9 4.5M20 4v5h-5"
            />
          </svg>
        </button>
        {seedOverride !== null && (
          <button
            type="button"
            className="crystal-regen crystal-regen--reset"
            aria-label="Повернути справжній кристал"
            title="Повернути справжній кристал"
            onClick={(e) => {
              e.stopPropagation();
              setSeedOverride(null);
            }}
          >
            ↩
          </button>
        )}
      </div>

      <CrystalStats dna={dna} deltas={deltas} isPending={isPending} />

      {open && <MemoryModal onClose={() => setOpen(false)} />}
    </>
  );
}
