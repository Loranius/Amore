import { useEffect, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { BufferGeometry, Mesh, type Group } from 'three';
import { JOURNEY_SUN_PATH, journeyAssetUrl } from '../journeyAssets';
import { createFocusStarMaterial } from './focusStarMaterial';
import type { StellarDetail } from './stellarSurface';

// ============================================================
// Розкрита подія — куля `sun.glb` у тій самій точці, де стояла зірка.
// ------------------------------------------------------------
// З асета береться ЛИШЕ геометрія: поверхня рахується шейдером
// (`stellarSurface.ts`), і запечена текстура для неї не потрібна. Матеріал
// будується наново на кожен показ — чому саме, написано в `focusStarMaterial`.
//
// **Анімації в асеті немає** — це виміряно в контейнері, а не припущено. Тож
// повільний оберт додається кодом: нерухома куля читається як картинка, а не
// як тіло. Візерунок поверхні живе в об'єктному просторі, тож обертається
// разом із нею, а власна течія шуму йде поверх — тіло крутиться І кипить.
// ============================================================

const SUN_URL = journeyAssetUrl(JOURNEY_SUN_PATH);

/** Оберт за хвилину з чвертю — приблизно те саме, чим дихає кристал. */
const SPIN_RATE = (2 * Math.PI) / 75;

export interface FocusStarProps {
  /** Де стояла зірка події. Сонце виростає рівно там. */
  position: readonly [number, number, number];
  /** Колір події, три числа 0…1. */
  colour: readonly [number, number, number];
  /** Насіння події, 0…1. Керує візерунком поверхні. */
  seed: number;
  /** Радіус сонця в одиницях сцени. */
  radius: number;
  /** Наскільки сонце вже проявилось, 0…1. Реф — щоб не перемальовувати дерево. */
  reveal: { current: number };
  /** Профіль пристрою. Слабкий рахує поверхню вчетверо дешевше. */
  detail: StellarDetail;
  reducedMotion: boolean;
}

function readSunGeometry(
  scene: { traverse: (visit: (node: unknown) => void) => void },
): BufferGeometry | null {
  let geometry: BufferGeometry | null = null;
  scene.traverse((node) => {
    if (geometry || !(node instanceof Mesh)) return;
    geometry = node.geometry;
  });
  return geometry;
}

export function FocusStar({
  position,
  colour,
  seed,
  radius,
  reveal,
  detail,
  reducedMotion,
}: FocusStarProps) {
  const { scene } = useGLTF(SUN_URL);
  const geometry = useMemo(() => readSunGeometry(scene), [scene]);
  const groupRef = useRef<Group>(null);

  // Ключ матеріалу — колір і насіння: нова подія дістає новий матеріал, і
  // жодного стану від попередньої в ньому немає.
  const material = useMemo(
    () => createFocusStarMaterial({ colour, seed, detail, opacity: 0 }),
    [colour, seed, detail],
  );

  // Геометрію звільнить кеш `useGLTF`; матеріал наш, і крім нас його не
  // звільнить ніхто.
  useEffect(() => () => material.dispose(), [material]);

  useFrame((_state, delta) => {
    const group = groupRef.current;
    if (!group) return;
    const shown = Math.max(0, Math.min(1, reveal.current));
    // Сонце РОСТЕ з нуля в тій самій світовій точці, де гасне зірка: перехід
    // читається як наближення, а не як «зникло і з'явилось».
    group.scale.setScalar(radius * shown);
    material.uniforms.uOpacity!.value = shown;
    if (reducedMotion) return;
    // Крок обрізається зверху: під програмним рендерером кадр триває третину
    // секунди, і необрізаний крок смикав би поверхню ривками.
    const step = Math.min(delta, 0.05);
    group.rotation.y += SPIN_RATE * step;
    material.uniforms.uTime!.value += step;
  });

  if (!geometry) return null;

  return (
    /*
     * `visible` НЕ вимикається у спокої, і це не недогляд.
     *
     * Матеріал зі своїм шейдером компілюється при першому малюванні. Якщо це
     * малювання припадає на дотик, пара дістає ривок рівно там, де мала
     * побачити рух. Нульовий масштаб лишає один виклик малювання, який не
     * зафарбовує жодного пікселя, — і шейдер уже прогрітий. Для процедурної
     * поверхні це важить більше, ніж важило для запеченої: у ній чотири
     * октави шуму, і компілюється вона довше.
     */
    <group ref={groupRef} position={position as unknown as [number, number, number]} scale={0}>
      {/*
        Порядок нуль — раніше за шлях і зірки. Глибина затуляє лише те, що
        намальоване ПІСЛЯ неї, тож сонце мусить лягти в буфер першим.
      */}
      <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={0} />
    </group>
  );
}

useGLTF.preload(SUN_URL);
