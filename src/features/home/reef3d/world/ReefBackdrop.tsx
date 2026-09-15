// ============================================================
// Далекий берег: один виклик малювання на глибину кадру.
// ------------------------------------------------------------
// Читає `coral_reef_set_cc0.glb` і зводить його вісім тіл в одну
// геометрію (`reefBackdrop.ts`). Уся арифметика — там і перевірена; тут
// лише перехід із GLTF у ті масиви, які вона чекає.
//
// НІЯКОГО СВІТЛА. Матеріал базовий: шар живе в тумані, на відстані, де
// освітлення однаково нічого не вирішує, а `MeshStandardMaterial` коштував
// би повного розрахунку на кожен його піксель.
// ============================================================
import { Suspense, useEffect, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { Mesh, MeshBasicMaterial, type Object3D } from 'three';
import { buildReefBackdropGeometry, type ReefBackdropPart } from './reefBackdrop';

const MODEL_URL = `${import.meta.env.BASE_URL}models/coral_reef_set_cc0.glb`;

/**
 * Тіла набору у СВІТОВИХ координатах свого вузла.
 *
 * Масштаб вузла обов'язковий: сирі вершини набору мікроскопічні (габарит
 * 0.0044 до множення на 100), і без матриці вузла тіла злились би в точку.
 * Це вже виміряно розбором GLB — `scripts/models/measure-reef.mjs` бере ту
 * саму матрицю.
 */
function readParts(scene: Object3D): ReefBackdropPart[] {
  const parts: ReefBackdropPart[] = [];
  scene.updateMatrixWorld(true);
  scene.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    const geometry = node.geometry.clone();
    geometry.applyMatrix4(node.matrixWorld);
    const position = geometry.getAttribute('position');
    const colour = geometry.getAttribute('color');
    const index = geometry.getIndex();
    if (!position || !index) return;
    parts.push({
      positions: Array.from(position.array),
      indices: Array.from(index.array),
      /*
       * Колір береться з ПЕРШОЇ вершини, і це не спрощення: у кожного тіла
       * набору рівно одне унікальне значення `COLOR_0` на всі 476–524
       * вершини (ADR-0182). Читати більше означало б вдавати, ніби там є
       * градієнт.
       */
      colour: colour
        ? [colour.getX(0), colour.getY(0), colour.getZ(0)]
        : [0.6, 0.7, 0.7],
    });
    geometry.dispose();
  });
  return parts;
}

interface ReefBackdropProps {
  /** Опорний розмір сцени — радіус каменя. */
  sceneRadius: number;
  seed: number;
}

function BackdropBody({ sceneRadius, seed }: ReefBackdropProps): React.JSX.Element | null {
  const { scene } = useGLTF(MODEL_URL);
  const parts = useMemo(() => readParts(scene), [scene]);

  const geometry = useMemo(() => buildReefBackdropGeometry(parts, {
    /*
     * Відстань і розмір — у радіусах каменя, а не в числах зі стелі.
     * П'ять радіусів були ЗАДАЛЕКО: туман з'їдав берег цілком, і на
     * знімку його не було видно зовсім, хоч розклад сцени показував усі
     * 6 080 трикутників. Виміряно знімком, а не прикинуто.
     *
     * 3.4 радіуса кладуть берег на початок смуги, де серпанок дна щойно
     * береться (0.16 від тринадцяти радіусів, тобто 2.1), — він видний
     * силуетом і вже розчиняється.
     */
    distance: sceneRadius * 4.2,
    spread: Math.PI * 1.1,
    scale: sceneRadius * 1.15,
    seed,
  }), [parts, sceneRadius, seed]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const material = useMemo(() => new MeshBasicMaterial({ vertexColors: true, fog: true }), []);
  useEffect(() => () => material.dispose(), [material]);

  if (parts.length === 0) return null;
  return <mesh geometry={geometry} material={material} renderOrder={-1} />;
}

/**
 * Далекий берег або нічого.
 *
 * `Suspense` із порожнім запасним варіантом — навмисно: поки GLB їде,
 * сцена мусить бути повною, а не чекати на тло. Асет лежить у лінивому
 * чанку рифа й не входить у precache, тож пара, що вибрала кристал, не
 * платить за нього трафіком (`vite.config.ts`).
 */
export function ReefBackdrop(props: ReefBackdropProps): React.JSX.Element {
  return (
    <Suspense fallback={null}>
      <BackdropBody {...props} />
    </Suspense>
  );
}
