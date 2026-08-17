import { useEffect, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import {
  BufferGeometry,
  Mesh,
  SRGBColorSpace,
  type Group,
  type Texture,
} from 'three';
import { JOURNEY_SUN_PATH, journeyAssetUrl } from '../journeyAssets';
import { createFocusStarMaterial } from './focusStarMaterial';

// ============================================================
// Розкрита подія — `sun.glb` у тій самій точці, де стояла зірка.
// ------------------------------------------------------------
// Асет вантажиться раз і живе в кеші `useGLTF`; сюди береться лише його
// геометрія й текстура. Матеріал будується наново на кожен показ — чому саме,
// написано в `focusStarMaterial.ts`.
//
// **Анімації в асеті немає** — це виміряно в контейнері, а не припущено. Тож
// повільний оберт додається кодом: нерухома куля читається як картинка, а не
// як тіло.
// ============================================================

const SUN_URL = journeyAssetUrl(JOURNEY_SUN_PATH);

/** Оберт за хвилину з чвертю — приблизно те саме, чим дихає кристал. */
const SPIN_RATE = (2 * Math.PI) / 75;

export interface FocusStarProps {
  /** Де стояла зірка події. Сонце виростає рівно там. */
  position: readonly [number, number, number];
  /** Колір події, три числа 0…1. */
  colour: readonly [number, number, number];
  /** Радіус сонця в одиницях сцени. */
  radius: number;
  /** Наскільки сонце вже проявилось, 0…1. Реф — щоб не перемальовувати дерево. */
  reveal: { current: number };
  reducedMotion: boolean;
}

function readSun(scene: { traverse: (visit: (node: unknown) => void) => void }): {
  geometry: BufferGeometry | null;
  texture: Texture | null;
} {
  let geometry: BufferGeometry | null = null;
  let texture: Texture | null = null;
  scene.traverse((node) => {
    if (geometry || !(node instanceof Mesh)) return;
    geometry = node.geometry;
    const material = Array.isArray(node.material) ? node.material[0] : node.material;
    texture = (material as { map?: Texture | null } | undefined)?.map ?? null;
  });
  return { geometry, texture };
}

export function FocusStar({ position, colour, radius, reveal, reducedMotion }: FocusStarProps) {
  const { scene } = useGLTF(SUN_URL);
  const { geometry, texture } = useMemo(() => readSun(scene), [scene]);
  const groupRef = useRef<Group>(null);

  // Ключ матеріалу — колір: нова подія дістає новий матеріал, і жодного стану
  // від попередньої в ньому немає.
  const material = useMemo(() => {
    if (texture) texture.colorSpace = SRGBColorSpace;
    return createFocusStarMaterial({ map: texture, colour, opacity: 0 });
  }, [texture, colour]);

  // Геометрію й текстуру звільнить кеш `useGLTF`; матеріал наш, і крім нас
  // його не звільнить ніхто.
  useEffect(() => () => material.dispose(), [material]);

  useFrame((_state, delta) => {
    const group = groupRef.current;
    if (!group) return;
    const shown = Math.max(0, Math.min(1, reveal.current));
    // Сонце РОСТЕ з нуля в тій самій світовій точці, де гасне зірка: перехід
    // читається як наближення, а не як «зникло і з'явилось».
    group.scale.setScalar(radius * shown);
    material.uniforms.uOpacity!.value = shown;
    if (!reducedMotion) group.rotation.y += SPIN_RATE * Math.min(delta, 0.05);
  });

  if (!geometry) return null;

  return (
    /*
     * `visible` НЕ вимикається у спокої, і це не недогляд.
     *
     * Матеріал зі своїм шейдером компілюється при першому малюванні. Якщо це
     * малювання припадає на дотик, пара дістає ривок рівно там, де мала
     * побачити рух. Нульовий масштаб лишає один виклик малювання, який не
     * зафарбовує жодного пікселя, — і шейдер уже прогрітий.
     */
    <group ref={groupRef} position={position as unknown as [number, number, number]} scale={0}>
      {/*
        Порядок нуль — раніше за промені й зірки. Глибина затуляє лише те, що
        намальоване ПІСЛЯ неї, тож сонце мусить лягти в буфер першим.
      */}
      <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={0} />
    </group>
  );
}

useGLTF.preload(SUN_URL);
