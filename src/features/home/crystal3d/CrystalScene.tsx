// ============================================================
// CrystalScene — 3D-рендер кристала (Three.js / React Three Fiber)
// ------------------------------------------------------------
// Основний рендер «Crystal Engine v1.0»; SVG Crystal.tsx лишається
// фолбеком (WebGL недоступний або ця сцена впала — див.
// CrystalErrorBoundary у HomePage.tsx). ДНК/пороги категорій ідентичні
// SVG-версії (crystalGeometry.ts) — лише геометрія іншого типу
// (деформований ікосаедр замість плоских полігонів).
// ============================================================
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sparkles } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import type * as THREE from 'three';
import { useCrystalDNA } from '../useCrystal';
import type { CrystalDNA } from '../useCrystal';
import { useCrystalSeen } from '../useCrystalSeen';
import { CATEGORY_DEFS } from '../crystalGeometry';
import { CrystalStats } from '../CrystalStats';
import { PlacesModal } from '../PlacesModal';
import { buildCrystalGeometry, crystalScale } from './crystalGeometry3d';

interface MeshProps {
  dna: CrystalDNA;
  reduceMotion: boolean;
  grew: boolean;
  onOpen: () => void;
}

function CrystalMesh({ dna, reduceMotion, grew, onOpen }: MeshProps) {
  const meshRef = useRef<THREE.Mesh | null>(null);
  const materialRef = useRef<THREE.MeshPhysicalMaterial | null>(null);
  const geometry = useMemo(() => buildCrystalGeometry(dna), [dna]);
  const scale = useMemo(() => crystalScale(dna), [dna]);
  const flashUntil = useRef(grew ? performance.now() + 1200 : 0);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useEffect(() => {
    if (reduceMotion) meshRef.current?.scale.setScalar(scale);
  }, [reduceMotion, scale]);

  useFrame((state, delta) => {
    const mesh = meshRef.current;
    if (mesh && !reduceMotion) {
      mesh.rotation.y += delta * 0.12;
      const breathe = 1 + Math.sin(state.clock.elapsedTime * 0.6) * 0.018;
      mesh.scale.setScalar(scale * breathe);
    }
    const mat = materialRef.current;
    if (mat && flashUntil.current) {
      const remain = flashUntil.current - performance.now();
      mat.emissiveIntensity = Math.max(0, (remain / 1200) * 0.8);
      if (remain <= 0) flashUntil.current = 0;
    }
  });

  return (
    <mesh ref={meshRef} geometry={geometry} scale={scale} onClick={onOpen}>
      <meshPhysicalMaterial
        ref={materialRef}
        vertexColors
        roughness={0.28}
        metalness={0.05}
        clearcoat={0.6}
        clearcoatRoughness={0.25}
        transmission={0.12}
        thickness={0.6}
        iridescence={0.3}
        iridescenceIOR={1.3}
        reflectivity={0.5}
        emissive="#fff0d6"
        emissiveIntensity={0}
      />
    </mesh>
  );
}

export default function CrystalScene() {
  const { dna, isPending } = useCrystalDNA();
  const { seenSnapshot, isFirstVisit } = useCrystalSeen(dna, isPending);
  const [open, setOpen] = useState(false);
  const [reduceMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  const grew =
    !isPending &&
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
        <Canvas dpr={[1, 2]} camera={{ position: [0, 0, 6.5], fov: 42 }}>
          <ambientLight intensity={0.5} />
          <directionalLight position={[3, 4, 2]} intensity={1.1} />
          <pointLight position={[-3, -2, -2]} intensity={0.4} color="#e6a0bd" />
          {!isPending && (
            <CrystalMesh dna={dna} reduceMotion={reduceMotion} grew={grew} onOpen={openModal} />
          )}
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
