// ============================================================
// PortalEnvironment — сцена навколо артефакта, у тому ж WebGL-кадрі.
// ------------------------------------------------------------
// Раніше підлога, колони й зорі були CSS-шарами поверх прозорого
// полотна. Вони давали натяк на простір, але не могли зійтися з
// кристалом: у них не було спільної камери, тож при будь-якому
// повороті орбіти сцена лишалась нерухомою, а артефакт «плив» по ній.
//
// Тут усе стоїть на одній площині (PORTAL_GROUND_Y) і дивиться однією
// камерою. Небо лишається в CSS: градієнт — це не геометрія, а сфера
// на 60 одиниць коштувала б draw call і виняток із туману заради
// пікселів, які й так однакові.
// ============================================================
import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import {
  PORTAL_FIELD_DROP,
  PORTAL_GROUND_Y,
  PORTAL_PALETTES,
  buildPortalDaisGeometry,
  buildPortalRuneGeometry,
  buildPortalInlayGeometry,
  buildPortalPillarGeometry,
  buildPortalRitualSlabGeometry,
  buildPortalStarField,
  portalPillarInstances,
  type PortalCameraFrame,
} from './portalScene';

export interface PortalEnvironmentProps {
  /** Насіння артефакта: небо в кожної пари своє й незмінне. */
  seed: number;
  theme: 'light' | 'dark';
  /** Профіль якості з пайплайну кристала — сцена не має права коштувати
   *  більше за сам артефакт на слабкому пристрої. */
  quality: 'high' | 'balanced' | 'low' | 'fallback';
  /** Кадр камери для поточного аспекту; сцена й камера мусять читати
   *  одні й ті самі числа, тож він приходить згори. */
  frame: PortalCameraFrame;
  aspect: number;
  /** Масштаб подіуму під розмір друзи — див. portalDaisScale. */
  daisScale: number;
  /**
   * Напрямки гілок кварцової жили (профіль субстрату, `veinBearings`).
   *
   * Камінь платформи піднімається саме над ними. Без них він піднімався б у
   * власних, від насіння, — і тоді на подіумі було б дві незалежні системи
   * розломів: жила в артефакті й вигини в сцені.
   */
  veinBearings: readonly number[];
}

function starCount(quality: PortalEnvironmentProps['quality']): number {
  if (quality === 'high') return 260;
  if (quality === 'balanced') return 200;
  if (quality === 'low') return 140;
  return 90;
}

export function PortalEnvironment({
  seed,
  theme,
  quality,
  frame,
  aspect,
  daisScale,
  veinBearings,
}: PortalEnvironmentProps) {
  const palette = PORTAL_PALETTES[theme];
  const pillarsRef = useRef<THREE.InstancedMesh>(null);

  const daisGeometry = useMemo(() => buildPortalDaisGeometry(), []);
  // Інкрустація тепер від насіння теж: вона повторює вигин плити, а плита
  // вигинається там, де тріснула саме в цієї пари.
  const inlayGeometry = useMemo(
    () => buildPortalInlayGeometry(seed, veinBearings),
    [seed, veinBearings],
  );
  const pillarGeometry = useMemo(() => buildPortalPillarGeometry(), []);
  // Камінь платформи вигинається над жилою, тож перебудовується разом із нею.
  const slabGeometry = useMemo(
    () => buildPortalRitualSlabGeometry(seed, veinBearings),
    [seed, veinBearings],
  );
  const runeGeometry = useMemo(
    () => buildPortalRuneGeometry(seed, veinBearings),
    [seed, veinBearings],
  );
  const stars = useMemo(() => buildPortalStarField(seed, starCount(quality)), [seed, quality]);
  const pillars = useMemo(() => portalPillarInstances(frame, aspect), [frame, aspect]);

  useEffect(() => () => {
    daisGeometry.dispose();
    inlayGeometry.dispose();
    pillarGeometry.dispose();
    slabGeometry.dispose();
    runeGeometry.dispose();
  }, [daisGeometry, inlayGeometry, pillarGeometry, slabGeometry, runeGeometry]);

  const starGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(stars.positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(stars.colors, 3));
    return geometry;
  }, [stars]);

  useEffect(() => () => starGeometry.dispose(), [starGeometry]);

  // InstancedMesh матриці ставимо до першого кадру: інакше всі чотири
  // колони блимнули б в origin.
  useLayoutEffect(() => {
    const mesh = pillarsRef.current;
    if (mesh === null) return;
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    for (let index = 0; index < pillars.length; index += 1) {
      const pillar = pillars[index]!;
      position.set(pillar.position[0], pillar.position[1], pillar.position[2]);
      scale.set(pillar.scale[0], pillar.scale[1], pillar.scale[2]);
      quaternion.setFromEuler(new THREE.Euler(0, pillar.rotationY, 0));
      mesh.setMatrixAt(index, matrix.compose(position, quaternion, scale));
    }
    mesh.count = pillars.length;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [pillars]);

  return (
    <>
      <fog attach="fog" args={[palette.fog, frame.fogNear, frame.fogFar]} />

      {/* Поле навколо подіуму. Далекий край з'їдає туман — це і є
          горизонт, від якого відраховується «далеко». */}
      <mesh
        position={[0, PORTAL_GROUND_Y - PORTAL_FIELD_DROP, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[42, 64]} />
        <meshStandardMaterial color={palette.field} roughness={1} metalness={0} />
      </mesh>

      {/* Подіум: верхня площина рівно на PORTAL_GROUND_Y, тобто там, де
          починається субстрат кристала. Масштабується тільки по XZ —
          вища плита їхала б угору відносно тієї самої площини. */}
      <mesh
        geometry={daisGeometry}
        position={[0, PORTAL_GROUND_Y, 0]}
        scale={[daisScale, 1, daisScale]}
      >
        <meshStandardMaterial
          color={palette.dais}
          emissive={palette.daisEmissive}
          roughness={0.86}
          metalness={0.04}
          flatShading
        />
      </mesh>

      {/* Кам'яна платформа: суцільна верхня поверхня без жодного отвору під
          друзою. Кристали проросли крізь неї по кварцовій жилі, і камінь
          піднятий рівно над її гілками. Масштаб той самий, що в подіума,
          інакше вигин роз'їхався б із жилою, яка його зробила. */}
      <mesh
        geometry={slabGeometry}
        position={[0, PORTAL_GROUND_Y, 0]}
        scale={[daisScale, 1, daisScale]}
      >
        <meshStandardMaterial
          color={palette.slab}
          emissive={palette.daisEmissive}
          roughness={0.82}
          metalness={0.03}
          flatShading
        />
      </mesh>

      {/* Рунічні візерунки по кільцю. Тріщини звідси пішли: єдиний розлом у
          камені — це сама жила, яку публікує рушій. */}
      <mesh
        geometry={runeGeometry}
        position={[0, PORTAL_GROUND_Y, 0]}
        scale={[daisScale, 1, daisScale]}
      >
        <meshStandardMaterial
          color={palette.rune}
          emissive={palette.runeGlow}
          emissiveIntensity={0.35}
          roughness={0.62}
          metalness={0.1}
        />
      </mesh>

      {/* Інкрустація по обводу. Висоту вона несе у власній геометрії — та
          повторює вигин плити, — тож меш стоїть на площині подіуму без
          додаткового підйому. Тут лишалось `+ 0.079` від часів, коли кільця
          були пласкі: після переходу на вигнуті смуги воно додавалось до
          вже врахованої висоти, і золото висіло на товщину плити над нею. */}
      <mesh
        geometry={inlayGeometry}
        position={[0, PORTAL_GROUND_Y, 0]}
        scale={[daisScale, 1, daisScale]}
      >
        <meshStandardMaterial
          color={palette.inlay}
          emissive={palette.inlay}
          emissiveIntensity={0.42}
          roughness={0.34}
          metalness={0.7}
        />
      </mesh>

      <instancedMesh
        ref={pillarsRef}
        args={[pillarGeometry, undefined, pillars.length]}
        frustumCulled={false}
      >
        <meshStandardMaterial color={palette.pillar} roughness={0.94} metalness={0.02} flatShading />
      </instancedMesh>

      <points geometry={starGeometry}>
        <pointsMaterial
          size={1.7}
          sizeAttenuation={false}
          vertexColors
          transparent
          opacity={palette.starOpacity}
          depthWrite={false}
          // Зорі за туманом: інакше вся оболонка втопилась би у fogFar.
          fog={false}
        />
      </points>

      {/* Світло, що лежить на подіумі. Дешевше за будь-яку «пляму» в
          геометрії й на відміну від неї реагує на нахил каменю. */}
      <pointLight
        position={[0, PORTAL_GROUND_Y + 1.15, 0.9]}
        distance={6.5}
        decay={2}
        intensity={palette.daisLightIntensity}
        color={palette.daisLight}
      />
    </>
  );
}

/**
 * Тримає камеру й орбіту на кадрі з portalCameraFrame. Кадр залежить від
 * аспекту, а той змінюється при повороті телефона — прибити позицію до
 * пропсів <Canvas> означало б лишити вертикальний екран із кристалом,
 * що вилазить за краї.
 */
export function PortalCameraRig({
  frame,
  controls,
}: {
  frame: PortalCameraFrame;
  controls: RefObject<OrbitControlsImpl | null>;
}) {
  const camera = useThree((state) => state.camera);
  const applied = useRef('');

  useFrame(() => {
    const signature = frame.position.join(':');
    if (applied.current === signature) return;
    applied.current = signature;
    camera.position.set(frame.position[0], frame.position[1], frame.position[2]);
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = frame.fov;
      camera.updateProjectionMatrix();
    }
    const orbit = controls.current;
    if (orbit) {
      orbit.target.set(frame.target[0], frame.target[1], frame.target[2]);
      orbit.update();
    }
  });

  return null;
}
