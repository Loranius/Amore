import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import { createIslandMaterial, meshGeometry } from '../v2/CrystalIsland';
import { buildTreeIsland } from './treeIsland';

// ============================================================
// Острів дерева за референсом власника (ADR-0222): трава куполом, лілові
// валуни, рожеві квіти, тепла скеля з плющем, уламки, хмари й далекі
// острівці. Геометрія — `treeIsland.ts`; тут лише фарби й рух.
// ============================================================

/**
 * Трава, скеля, валуни, плющ, квіти, ґрунт, хмари, далекі острівці.
 * Небо дерева денне в обох темах (чорнило шапки темне), тож темна тема —
 * вечірнє світло того ж дня, а не ніч.
 */
const TREE_ISLAND_PAINTS: Record<'light' | 'dark', readonly string[]> = {
  light: ['#8fd14f', '#a8827a', '#b7a4b4', '#4f9e36', '#ff9ad2', '#6b5048', '#ffffff', '#c9b3bf'],
  dark: ['#80c24a', '#9a7370', '#a592a8', '#468f33', '#ff8cc8', '#5a423e', '#fff1e6', '#b8a2b2'],
};

interface TreeIslandProps {
  seed: string;
  theme: 'light' | 'dark';
  /** Радіус верхівки острова в одиницях сцени. */
  radius: number;
  groundY: number;
  reduceMotion: boolean;
}

export function TreeIsland({ seed, theme, radius, groundY, reduceMotion }: TreeIslandProps) {
  const built = useMemo(() => buildTreeIsland(seed, radius), [seed, radius]);
  const island = useMemo(() => meshGeometry(built.island), [built]);
  const debris = useMemo(() => meshGeometry(built.debris), [built]);
  const sky = useMemo(() => meshGeometry(built.sky), [built]);
  const material = useMemo(() => createIslandMaterial(TREE_ISLAND_PAINTS[theme]), [theme]);
  const debrisRef = useRef<THREE.Group>(null);
  const skyRef = useRef<THREE.Group>(null);

  useEffect(() => () => { island.dispose(); debris.dispose(); sky.dispose(); }, [island, debris, sky]);
  useEffect(() => () => material.dispose(), [material]);

  useFrame(({ clock }) => {
    const t = reduceMotion ? 0 : clock.getElapsedTime();
    material.uniforms.uTime!.value = t;
    if (debrisRef.current) {
      debrisRef.current.rotation.y = t * 0.03;
      debrisRef.current.position.y = Math.sin(t * 0.5) * radius * 0.02;
    }
    // Хмари й далекі острівці ледь дрейфують: небо живе, але не відволікає.
    if (skyRef.current) skyRef.current.position.x = Math.sin(t * 0.02) * 0.6;
  });

  return (
    <>
      <group ref={skyRef} position={[0, groundY, 0]}>
        <mesh geometry={sky} material={material} renderOrder={-4} frustumCulled={false} />
      </group>
      <group position={[0, groundY, 0]}>
        <mesh geometry={island} material={material} />
        <group ref={debrisRef}>
          <mesh geometry={debris} material={material} />
        </group>
      </group>
    </>
  );
}
