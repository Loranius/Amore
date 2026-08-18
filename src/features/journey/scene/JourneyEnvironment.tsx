import { useEffect, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import {
  BackSide,
  BufferGeometry,
  Mesh,
  MeshBasicMaterial,
  SRGBColorSpace,
  type Mesh as MeshType,
  type Texture,
} from 'three';
import { JOURNEY_SKYBOX_PATH, journeyAssetUrl } from '../journeyAssets';

// ============================================================
// Космос навколо пари.
// ------------------------------------------------------------
// Сфера радіуса 1 з асета, роздута навколо камери. Це не тло й не картинка:
// камера всередині, тож поворот на 360° показує далі те саме небо, а не край
// зображення.
//
// Два рішення, які варто пояснити, бо обидва виглядають як зайва обережність:
//
//  1. **Сітка береться з асета, а не будується своєю `sphereGeometry`.**
//     Розгортка панорами прив'язана до конкретних UV; своя сфера мала б власну
//     угоду про те, де шов і де полюс, і небо поїхало б відносно текстури.
//  2. **Матеріал будується свій, а не береться з асета.** У ньому
//     `MeshStandardMaterial` із `emissive [1,1,1]`, тобто повний прохід PBR
//     заради результату, який тут завжди дорівнює текстурі.
// ============================================================

const SKYBOX_URL = journeyAssetUrl(JOURNEY_SKYBOX_PATH);

/**
 * Радіус неба.
 *
 * Мусить бути помітно більшим за найдальшу зірку сузір'я і меншим за `far`
 * камери, інакше небо обріжеться площиною відсікання.
 */
export const JOURNEY_SKY_RADIUS = 600;

/**
 * Скільки секунд бере повний оберт неба.
 *
 * Двадцять хвилин — це майже нуль на око й помітно на відчуття: пара, яка
 * дивиться на сузір'я хвилину, бачить, що космос навколо не намальований, а
 * живий. Швидше — і небо починає крутитись, тобто перетягує увагу на себе;
 * повільніше — і різниці з нерухомою картинкою немає взагалі.
 */
const SKY_TURN_SECONDS = 1200;

interface SkyboxSource {
  geometry: BufferGeometry | null;
  texture: Texture | null;
}

function readSkybox(scene: { traverse: (visit: (node: unknown) => void) => void }): SkyboxSource {
  let geometry: BufferGeometry | null = null;
  let texture: Texture | null = null;
  scene.traverse((node) => {
    if (geometry || !(node instanceof Mesh)) return;
    geometry = node.geometry;
    const material = Array.isArray(node.material) ? node.material[0] : node.material;
    const maps = material as { emissiveMap?: Texture | null; map?: Texture | null } | undefined;
    texture = maps?.emissiveMap ?? maps?.map ?? null;
  });
  return { geometry, texture };
}

export interface JourneyEnvironmentProps {
  /** Пара просила спокою: небо стоїть. */
  reducedMotion?: boolean;
}

export function JourneyEnvironment({ reducedMotion = false }: JourneyEnvironmentProps) {
  const { scene } = useGLTF(SKYBOX_URL);
  const skyRef = useRef<MeshType>(null);
  const { geometry, texture } = useMemo(() => readSkybox(scene), [scene]);

  const material = useMemo(() => {
    if (!texture) return null;
    // Панорама запечена в sRGB. Без цього небо виходить вигорілим, і побачити
    // це можна лише на живому екрані.
    texture.colorSpace = SRGBColorSpace;
    return new MeshBasicMaterial({
      map: texture,
      // Дивимось зсередини. Асет двосторонній, але малювати обидва боки сфери
      // на 600 одиниць — подвійна робота задарма.
      side: BackSide,
      toneMapped: false,
      depthWrite: false,
      fog: false,
    });
  }, [texture]);

  // Геометрію й текстуру звільняє `useGLTF` разом із кешем; наш власний
  // матеріал не звільнить ніхто, крім нас.
  useEffect(() => () => material?.dispose(), [material]);

  useFrame((_state, delta) => {
    const sky = skyRef.current;
    if (!sky || reducedMotion) return;
    // Крок обрізається зверху з тієї ж причини, що й усюди в цій сцені: під
    // програмним рендерером кадр триває третину секунди.
    sky.rotation.y += ((2 * Math.PI) / SKY_TURN_SECONDS) * Math.min(delta, 0.05);
  });

  if (!geometry || !material) return null;

  return (
    <mesh
      ref={skyRef}
      geometry={geometry}
      material={material}
      scale={JOURNEY_SKY_RADIUS}
      // Небо малюється першим і не пише глибину: інакше зірки на десятках
      // одиниць і сфера на шестистах сперечались би за ті самі біти.
      renderOrder={-1}
      frustumCulled={false}
    />
  );
}

useGLTF.preload(SKYBOX_URL);
