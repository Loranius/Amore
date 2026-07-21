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
import { useCrystalDNA } from '../useCrystal';
import type { CrystalDNA } from '../useCrystal';
import { useCrystalSeen } from '../useCrystalSeen';
import { CATEGORY_DEFS, isDnaEmpty } from '../crystalGeometry';
import { CrystalStats } from '../CrystalStats';
import { PlacesModal } from '../PlacesModal';
import { buildSpikes, buildSpikeGeometry } from './crystalGeometry3d';

const BASE_Y = -1.3;

interface ClusterProps {
  dna: CrystalDNA;
  reduceMotion: boolean;
  grew: boolean;
  onOpen: () => void;
}

function CrystalCluster({ dna, reduceMotion, grew, onOpen }: ClusterProps) {
  const groupRef = useRef<THREE.Group | null>(null);
  const flashLightRef = useRef<THREE.PointLight | null>(null);
  const flashUntil = useRef(grew ? performance.now() + 1300 : 0);

  const spikeMeshes = useMemo(
    () => buildSpikes(dna).map((spec) => ({ spec, geometry: buildSpikeGeometry(spec) })),
    [dna],
  );

  useEffect(
    () => () => spikeMeshes.forEach(({ geometry }) => geometry.dispose()),
    [spikeMeshes],
  );

  useFrame((state, delta) => {
    const group = groupRef.current;
    if (group && !reduceMotion) {
      group.rotation.y += delta * 0.1;
      const breathe = 1 + Math.sin(state.clock.elapsedTime * 0.6) * 0.012;
      group.scale.setScalar(breathe);
    }
    const light = flashLightRef.current;
    if (light && flashUntil.current) {
      const remain = flashUntil.current - performance.now();
      light.intensity = Math.max(0, (remain / 1300) * 2.2);
      if (remain <= 0) flashUntil.current = 0;
    }
  });

  return (
    <group ref={groupRef}>
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
        <mesh
          key={spec.key}
          geometry={geometry}
          position={[spec.posX, BASE_Y, spec.posZ]}
          rotation={[spec.tiltX, spec.rotY, spec.tiltZ]}
          onClick={onOpen}
        >
          <meshPhysicalMaterial
            vertexColors
            roughness={0.12}
            metalness={0}
            transmission={0.4}
            thickness={0.7}
            clearcoat={0.85}
            clearcoatRoughness={0.08}
            ior={1.6}
            reflectivity={0.6}
          />
        </mesh>
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
  const { dna, isPending } = useCrystalDNA();
  const empty = !isPending && isDnaEmpty(dna);
  const { seenSnapshot, isFirstVisit } = useCrystalSeen(dna, isPending);
  const [open, setOpen] = useState(false);
  const [reduceMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  const grew =
    !isPending &&
    !empty &&
    (isFirstVisit ||
      CATEGORY_DEFS.some((cat) => cat.facetsFor(cat.metric(dna)) > (seenSnapshot?.[cat.key] ?? 0)));

  const sparkleCount = Math.min(60, 10 + Math.round(dna.photos / 2));

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
        aria-label="Кристал Amore — показати відвідані місця"
        onKeyDown={onKeyDownOpen}
      >
        <Canvas dpr={[1, 2]} camera={{ position: [0, 0.2, 6.5], fov: 42 }}>
          <ambientLight intensity={0.5} />
          <directionalLight position={[3, 4, 2]} intensity={1.1} />
          <pointLight position={[-3, -2, -2]} intensity={0.4} color="#e6a0bd" />
          {!isPending &&
            (empty ? (
              <CrystalSeed reduceMotion={reduceMotion} />
            ) : (
              <CrystalCluster dna={dna} reduceMotion={reduceMotion} grew={grew} onOpen={openModal} />
            ))}
          <Sparkles
            count={sparkleCount}
            scale={3.2}
            size={2}
            speed={reduceMotion ? 0 : 0.2}
            color="#ffe9f2"
          />
          <OrbitControls enablePan={false} enableZoom={false} />
          <EffectComposer>
            <Bloom intensity={0.6} luminanceThreshold={0.3} luminanceSmoothing={0.4} mipmapBlur />
          </EffectComposer>
        </Canvas>
      </div>

      <CrystalStats dna={dna} isPending={isPending} />

      {open && <PlacesModal onClose={() => setOpen(false)} />}
    </>
  );
}
