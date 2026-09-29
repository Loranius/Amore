import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import type * as THREE from 'three';
import { createIslandMaterial, createRayMaterial, meshGeometry } from '../../crystal3d/v2/CrystalIsland';
import { buildReefSurround } from '@/features/home/diorama/surround';
import { buildReefIsland } from './reefIsland';
import { EMPTY_MESH } from '../../crystal3d/v2/crystalIsland';

// ============================================================
// Острів рифу за референсом власника (ADR-0223): барвінкова скеля клином,
// арка, лагуна, водорості, дикі корали й зірки на схилах, уламки, далекі
// скелі-стовпи й промені з поверхні. Геометрія — `reefIsland.ts`; глибина
// навколо — `diorama/surround.ts` (ADR-0224).
// ============================================================

/**
 * Верхівка, скеля, валуни й арка, водорості, вода, помаранчевий і рожевий
 * корал, далечінь, пісок дна, бірюзові губки, жовті пластини. Гама —
 * референсу (ADR-0225): майже біле лілове плато, насичена фіолетова скеля,
 * чисті яскраві кольори живності.
 */
const REEF_ISLAND_PAINTS: Record<'light' | 'dark', readonly string[]> = {
  light: ['#e4def8', '#6a5cd0', '#7d6fe0', '#5fd35a', '#62dcef', '#ff7a36', '#ff5f9e', '#58a2cc', '#ecdcb0', '#3fcfe6', '#ffc629'],
  dark: ['#9d95d6', '#40358f', '#5a4cb8', '#48b84c', '#45cfe6', '#ff6f33', '#ff5596', '#123f78', '#5f6480', '#35bcd6', '#f5b820'],
};

const RAY: Record<'light' | 'dark', string> = { light: '#eafcff', dark: '#7fe8ff' };
/** Товща води: далекі скелі й водорості тонуть у ній. */
const WATER: Record<'light' | 'dark', string> = { light: '#4aa6cc', dark: '#0a2a5a' };

interface ReefIslandProps {
  seed: string;
  theme: 'light' | 'dark';
  radius: number;
  /** Радіус каменю рифу в сцені: за ним стоять лагуна й арка. */
  rock: number;
  groundY: number;
  reduceMotion: boolean;
  /** Лише острів, без глибини й променів — острівець на тлі входу (ADR-0228). */
  bare?: boolean;
  /** Арка позаду каменю (вулкан — без неї, ADR-0235). */
  arch?: boolean;
  /** Лагуна й стоячі камені по краю (вулкан — без них, ADR-0235). */
  lagoon?: boolean;
  stones?: boolean;
}

export function ReefIsland({ seed, theme, radius, rock, groundY, reduceMotion, bare = false, arch = true, lagoon = true, stones = true }: ReefIslandProps) {
  const built = useMemo(() => buildReefIsland(seed, radius, rock, { arch, lagoon, stones }), [seed, radius, rock, arch, lagoon, stones]);
  const island = useMemo(() => meshGeometry(built.island), [built]);
  const debris = useMemo(() => meshGeometry(built.debris), [built]);
  // Глибина навколо острова на всі 360° (ADR-0224): скелі з арками, ліс
  // водоростей, дно внизу.
  const far = useMemo(() => meshGeometry(bare ? EMPTY_MESH : buildReefSurround(seed)), [seed, bare]);
  const materials = useMemo(() => ({
    island: createIslandMaterial(REEF_ISLAND_PAINTS[theme]),
    ray: createRayMaterial(RAY[theme]),
    deep: createIslandMaterial(REEF_ISLAND_PAINTS[theme], { colour: WATER[theme], from: 12, to: 120, strength: 0.88, near: 30 }),
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
      {!bare && (
        <group position={[0, groundY, 0]}>
          <mesh geometry={far} material={materials.deep} frustumCulled={false} />
        </group>
      )}
      {/* Промені з поверхні: падають згори навскоси крізь товщу води. */}
      {!bare && [0, 1, 2, 3, 4].map((k) => (
        <Billboard
          key={k}
          lockX
          lockZ
          position={[Math.cos(k * 1.3 + 1.1) * radius * 2.2, groundY + radius * 4.4, Math.sin(k * 1.3 + 1.1) * radius * 2.2]}
        >
          <mesh material={materials.ray} rotation={[0, 0, 0.2 - k * 0.04]} renderOrder={-4}>
            <planeGeometry args={[radius * (0.4 + 0.15 * (k % 2)), radius * 5]} />
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

