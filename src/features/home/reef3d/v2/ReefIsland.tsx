import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import type * as THREE from 'three';
import { createIslandMaterial, createRayMaterial, meshGeometry } from '../../crystal3d/v2/CrystalIsland';
import { buildReefSurround } from '@/features/home/diorama/surround';
import { buildReefIsland } from './reefIsland';

// ============================================================
// Острів рифу за референсом власника (ADR-0223): барвінкова скеля клином,
// арка, лагуна, водорості, дикі корали й зірки на схилах, уламки, далекі
// скелі-стовпи й промені з поверхні. Геометрія — `reefIsland.ts`; глибина
// навколо — `diorama/surround.ts` (ADR-0224).
// ============================================================

/** Верхівка, скеля, валуни, водорості, лагуна, помаранчевий і рожевий корал, далечінь. */
const REEF_ISLAND_PAINTS: Record<'light' | 'dark', readonly string[]> = {
  light: ['#b3aae6', '#6e68c0', '#8f86da', '#5cbb4c', '#72f0e6', '#ff8a4c', '#ff6fae', '#58a2cc'],
  dark: ['#7c74c2', '#443e90', '#5d56aa', '#3f9c46', '#4adcea', '#ff7a44', '#ff5fa6', '#123f78'],
};

const RAY: Record<'light' | 'dark', string> = { light: '#eafcff', dark: '#7fe8ff' };
/** Товща води: далекі скелі й водорості тонуть у ній. */
const WATER: Record<'light' | 'dark', string> = { light: '#4aa6cc', dark: '#0a2a5a' };

interface ReefIslandProps {
  seed: string;
  theme: 'light' | 'dark';
  radius: number;
  groundY: number;
  reduceMotion: boolean;
}

export function ReefIsland({ seed, theme, radius, groundY, reduceMotion }: ReefIslandProps) {
  const built = useMemo(() => buildReefIsland(seed, radius), [seed, radius]);
  const island = useMemo(() => meshGeometry(built.island), [built]);
  const debris = useMemo(() => meshGeometry(built.debris), [built]);
  // Глибина навколо острова на всі 360° (ADR-0224): скелі з арками, ліс
  // водоростей, дно внизу.
  const far = useMemo(() => meshGeometry(buildReefSurround(seed)), [seed]);
  const materials = useMemo(() => ({
    island: createIslandMaterial(REEF_ISLAND_PAINTS[theme]),
    ray: createRayMaterial(RAY[theme]),
    deep: createIslandMaterial(REEF_ISLAND_PAINTS[theme], { colour: WATER[theme], from: 20, to: 150, strength: 0.82 }),
  }), [theme]);
  const debrisRef = useRef<THREE.Group>(null);

  useEffect(() => () => { island.dispose(); debris.dispose(); far.dispose(); }, [island, debris, far]);
  useEffect(() => () => { for (const m of Object.values(materials)) m.dispose(); }, [materials]);

  useFrame(({ clock }) => {
    const t = reduceMotion ? 0 : clock.getElapsedTime();
    materials.island.uniforms.uTime!.value = t;
    materials.ray.uniforms.uTime!.value = t;
    if (debrisRef.current) {
      debrisRef.current.rotation.y = t * 0.03;
      debrisRef.current.position.y = Math.sin(t * 0.5) * radius * 0.02;
    }
  });

  return (
    <>
      <group position={[0, groundY, 0]}>
        <mesh geometry={far} material={materials.deep} frustumCulled={false} />
      </group>
      {/* Промені з поверхні: падають згори навскоси крізь товщу води. */}
      {[0, 1, 2, 3, 4].map((k) => (
        <Billboard
          key={k}
          lockX
          lockZ
          position={[Math.cos(k * 1.3 + 1.1) * radius * 2.2, groundY + radius * 2.4, Math.sin(k * 1.3 + 1.1) * radius * 2.2]}
        >
          <mesh material={materials.ray} rotation={[0, 0, 0.3 - k * 0.05]} renderOrder={-4}>
            <planeGeometry args={[radius * (0.4 + 0.15 * (k % 2)), radius * 7]} />
          </mesh>
        </Billboard>
      ))}
      <group position={[0, groundY, 0]}>
        <mesh geometry={island} material={materials.island} />
        <group ref={debrisRef}>
          <mesh geometry={debris} material={materials.island} />
        </group>
      </group>
    </>
  );
}

