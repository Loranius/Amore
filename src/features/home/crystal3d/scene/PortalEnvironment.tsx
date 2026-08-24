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
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { PortalRuin } from './PortalRuin';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { CRYSTAL_CENTRE_POSE, type WorldCameraPose } from '@/features/world/crystalAtlas';
import {
  NO_MANUAL_TURN,
  advanceSceneDirector,
  createSceneDirector,
  sceneDirectorPose,
  shortestTurn,
  type SceneDirectorState,
  type WorldMotionMode,
} from '@/features/world/sceneDirector';
import {
  PORTAL_GROUND_Y,
  PORTAL_PALETTES,
  portalCameraTurn,
  portalCameraView,
  buildPortalStarField,
  type PortalCameraFrame,
} from './portalScene';
import {
  buildPortalCelestialArcGeometry,
  buildPortalHazeField,
} from './portalSceneDecor';

export interface PortalEnvironmentProps {
  /** Насіння артефакта: небо в кожної пари своє й незмінне. */
  seed: number;
  theme: 'light' | 'dark';
  /** Профіль якості з пайплайну кристала — сцена не має права коштувати
   *  більше за сам артефакт на слабкому пристрої. */
  quality: 'high' | 'balanced' | 'low' | 'fallback';
  /** Stops atmospheric drift and emissive breathing for accessibility. */
  reduceMotion: boolean;
  /** Кадр камери для поточного аспекту; сцена й камера мусять читати
   *  одні й ті самі числа, тож він приходить згори. */
  frame: PortalCameraFrame;
  aspect: number;
  /**
   * Напрямки кварцової жили лишаються частиною контракту сцени для наступного
   * персоналізованого inlay-pass. Круглий механічний релікварій навмисно не
   * деформується за тріщинами: їх уже правдиво показує engine-owned substrate.
   */
  veinBearings: readonly number[];
  /**
   * Радіус engine-owned substrate. Передається далі тим самим стабільним API,
   * але метал залишається нижче ground plane й не може накрити кварцову жилу.
   */
  veinReach: number;
}

function starCount(quality: PortalEnvironmentProps['quality']): number {
  if (quality === 'high') return 260;
  if (quality === 'balanced') return 200;
  if (quality === 'low') return 140;
  return 90;
}

function hazeCount(quality: PortalEnvironmentProps['quality']): number {
  if (quality === 'high') return 7;
  if (quality === 'balanced') return 6;
  if (quality === 'low') return 5;
  return 3;
}

const ATMOSPHERE_VERTEX_SHADER = /* glsl */`
  attribute vec3 color;
  attribute float pointSize;
  attribute float pointAlpha;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vColor = color;
    vAlpha = pointAlpha;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = pointSize;
  }
`;

const ATMOSPHERE_FRAGMENT_SHADER = /* glsl */`
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float radius = length(gl_PointCoord - vec2(0.5)) * 2.0;
    float falloff = smoothstep(1.0, 0.0, radius);
    float alpha = vAlpha * falloff * falloff;
    if (alpha < 0.002) discard;
    gl_FragColor = vec4(vColor, alpha);
  }
`;

export function PortalEnvironment({
  seed,
  theme,
  quality,
  reduceMotion,
  frame,
}: PortalEnvironmentProps) {
  const palette = PORTAL_PALETTES[theme];
  const pixelRatio = useThree((state) => state.gl.getPixelRatio());
  const skyRef = useRef<THREE.Group>(null);

  const celestialArcGeometry = useMemo(() => buildPortalCelestialArcGeometry(seed), [seed]);
  const stars = useMemo(() => buildPortalStarField(seed, starCount(quality)), [seed, quality]);
  const haze = useMemo(() => buildPortalHazeField(seed, hazeCount(quality)), [quality, seed]);

  useEffect(() => () => celestialArcGeometry.dispose(), [celestialArcGeometry]);

  const starGeometry = useMemo(() => {
    const count = stars.count + haze.count;
    const positions = new Float32Array(count * 3);
    const colours = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const alphas = new Float32Array(count);
    positions.set(stars.positions);
    colours.set(stars.colors);
    const ratio = Math.min(1.5, Math.max(1, pixelRatio));
    for (let index = 0; index < stars.count; index += 1) {
      const brightness = Math.max(
        stars.colors[index * 3]!,
        stars.colors[index * 3 + 1]!,
        stars.colors[index * 3 + 2]!,
      );
      sizes[index] = (1.15 + brightness * 0.95) * ratio;
      alphas[index] = palette.starOpacity * (0.45 + brightness * 0.55);
    }
    const hazeColour = new THREE.Color(palette.haze);
    for (let index = 0; index < haze.count; index += 1) {
      const target = stars.count + index;
      positions.set(haze.positions.subarray(index * 3, index * 3 + 3), target * 3);
      hazeColour.toArray(colours, target * 3);
      sizes[target] = haze.sizes[index]! * ratio;
      alphas[target] = palette.hazeOpacity * haze.alphas[index]!;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    geometry.setAttribute('pointSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('pointAlpha', new THREE.BufferAttribute(alphas, 1));
    return geometry;
  }, [haze, palette.haze, palette.hazeOpacity, palette.starOpacity, pixelRatio, stars]);

  useEffect(() => () => starGeometry.dispose(), [starGeometry]);


  /*
   * Лишилось тільки небо.
   *
   * Тут же «дихала» емісія релікварію й чотирьох світильників храму —
   * разом із самим храмом вони пішли. Руїна не світиться: вона камінь,
   * і єдине, що має світитись у цьому кадрі, — кристал пари.
   */
  useFrame((_, delta) => {
    if (!reduceMotion && skyRef.current !== null) {
      skyRef.current.rotation.y = (skyRef.current.rotation.y + delta * 0.0024) % (Math.PI * 2);
    }
  });

  return (
    <>
      <fog attach="fog" args={[palette.fog, frame.fogNear, frame.fogFar]} />

      {/*
        Руїна замість зібраного з частин храму.
        ------------------------------------------------------------
        Тут стояли підлога, вісімнадцять колон з арками, полотнища, лози,
        чотири світильники з власними point light'ами й металевий
        релікварій — усе процедурне, з власними числами в кожного.

        Власник замінив це однією авторською руїною. Кристал росте з її
        п'єдесталу: `PortalRuin` саджає верх `Stand` рівно на
        `PORTAL_GROUND_Y`, тож площина, на якій стоять кристали, не
        зрушила ані на одиницю — про заміну сцени не знає жоден інший
        файл.
      */}
      <PortalRuin theme={theme} quality={quality} />

      {/* Зорі й кілька великих м'яких плям туманності йдуть одним point pass.
          Дуги — окрема лінійна геометрія. Разом вони дають глибину верхній
          половині кадру, але лишають її переважно порожньою. */}
      <group ref={skyRef}>
        <points geometry={starGeometry} frustumCulled={false}>
          <shaderMaterial
            vertexShader={ATMOSPHERE_VERTEX_SHADER}
            fragmentShader={ATMOSPHERE_FRAGMENT_SHADER}
            transparent
            depthWrite={false}
            depthTest
            blending={THREE.AdditiveBlending}
            toneMapped={false}
            fog={false}
          />
        </points>
        <lineSegments geometry={celestialArcGeometry} frustumCulled={false}>
          <lineBasicMaterial
            color={palette.celestialArc}
            transparent
            opacity={palette.celestialArcOpacity}
            depthWrite={false}
            toneMapped={false}
            fog={false}
          />
        </lineSegments>
      </group>

      {/* Слабке світло від кореня (§10 брифу). Дешевше за будь-яку «пляму» в
          геометрії й на відміну від неї реагує на нахил каменю.

          **Було найсильнішим джерелом у сцені, а не найслабшим.** Виміряно за
          формулою згасання three (decay 2 з обрізанням) уздовж висоти
          підігнаного артефакта, на колоніях в 1, 7 і 25 років:

            ключ / уся заливка   0.36–0.48 у найгіршій точці

          тобто там, де кристал найширший і граней найбільше, заливка була
          вдвічі-втричі сильніша за ключ. Це рівно та вада, яку коментар вище
          в PortalStage описує й вважає виправленою — тільки там рахували
          лише напрямлені джерела та ambient, а це точкове ніхто не рахував.
          Різниця яскравості між сусідніми площинами — це і є те, що робить
          грань гранню; при такій заливці її не лишається.

          Три зміни, кожна виміряна розгорткою:
            позиція  y = ground+1.15 → +0.35, тобто справді біля кореня;
                     низ тепер світиться у 2.41 раза сильніше за верх, а було
                     0.43 — світло падало згори, а не піднімалось від жили;
            сила     2.2–2.6 → 0.42–0.5;
            z        лишається 0.9. Ближче до осі — і ближнє поле точкового
                     джерела вибухає: при z=0.5 ключ/заливка падає до 0.74.

          Разом із ключем 1.9 це дає ключ/заливка ≥ 1.42 у найгіршій точці на
          всіх розмірах колонії й в обох темах. */}
      <pointLight
        position={[0, PORTAL_GROUND_Y + 0.35, 0.9]}
        distance={6.5}
        decay={2}
        intensity={palette.daisLightIntensity}
        color={palette.daisLight}
      />
    </>
  );
}

/**
 * Тримає камеру й орбіту на кадрі з portalCameraFrame, зміщеному позою
 * поточного маршруту (атлас, ADR-0021).
 *
 * Кадр залежить від аспекту, а той змінюється при повороті телефона —
 * прибити позицію до пропсів <Canvas> означало б лишити вертикальний
 * екран із кристалом, що вилазить за краї.
 *
 * Поза тут **накладається**, а не замінює кадр. Кадр знає, як умістити
 * артефакт цієї пари в цей екран; атлас знає, з якого боку й з якої
 * висоти на нього дивитись. Перше — арифметика, друге — сенс, і
 * змішувати їх в одному числі означало б зламати обидва, щойно кристал
 * підросте.
 *
 * Рух — не стрибок: між позами камеру веде директор сцени (ADR-0022).
 * Тут лишається тільки те, що директор не може знати, — переклад пози в
 * координати сцени й зчитування назад того, що зробив палець.
 */
export function PortalCameraRig({
  frame,
  controls,
  pose,
  mode,
  spin = 0,
  freeCamera = false,
}: {
  frame: PortalCameraFrame;
  controls: RefObject<OrbitControlsImpl | null>;
  pose?: WorldCameraPose | undefined;
  /** Режим руху світу; читається щокадру, тож приходить рефом (§27). */
  mode?: { current: Exclude<WorldMotionMode, 'navigation'> } | undefined;
  /**
   * Скільки кристал повертається сам, рад/с. Нуль на головній: там він
   * предмет розмови, а не фон. Рішення приймає той, хто знає маршрут.
   */
  spin?: number | undefined;
  /** Коли true, OrbitControls одноосібно володіє камерою для огляду сцени. */
  freeCamera?: boolean | undefined;
}) {
  const camera = useThree((state) => state.camera);
  const director = useRef<SceneDirectorState>(createSceneDirector(pose ?? CRYSTAL_CENTRE_POSE));
  // Що директор написав минулого кадру. Різниця між цим і тим, де камера
  // насправді опинилась, — і є те, що зробив палець через OrbitControls:
  // інакше кожен кадр стирав би ручний оберт.
  const written = useRef<{ azimuth: number; elevation: number } | null>(null);
  const wasFreeCamera = useRef(freeCamera);

  useFrame((_, delta) => {
    const orbit = controls.current;
    const target = pose ?? CRYSTAL_CENTRE_POSE;

    // У режимі огляду режисер не має права щокадру повертати камеру назад.
    // OrbitControls зберігає поточну позицію на вході й керує нею напряму.
    if (freeCamera) {
      wasFreeCamera.current = true;
      written.current = null;
      return;
    }

    // Вихід із режиму — новий чистий кадр, а не велетенський «ручний дрейф»
    // між останньою вільною позицією і старим записом режисера.
    if (wasFreeCamera.current) {
      director.current = createSceneDirector(target);
      written.current = null;
      wasFreeCamera.current = false;
    }

    let drift = NO_MANUAL_TURN;
    if (written.current && orbit) {
      const actual = portalCameraTurn(
        [camera.position.x, camera.position.y, camera.position.z],
        [orbit.target.x, orbit.target.y, orbit.target.z],
      );
      drift = {
        azimuth: shortestTurn(written.current.azimuth, actual.azimuth),
        elevation: actual.elevation - written.current.elevation,
      };
    }

    director.current = advanceSceneDirector(director.current, {
      target,
      mode: mode?.current ?? 'idle',
      dt: delta,
      drift,
      spin,
    });

    const view = sceneDirectorPose(director.current);
    const placed = portalCameraView(frame, view);
    camera.position.set(placed.position[0], placed.position[1], placed.position[2]);
    if (camera instanceof THREE.PerspectiveCamera && camera.fov !== frame.fov) {
      camera.fov = frame.fov;
      camera.updateProjectionMatrix();
    }
    if (orbit) {
      orbit.target.set(placed.target[0], placed.target[1], placed.target[2]);
      orbit.update();
      // Знімок береться ПІСЛЯ update(), а не з того, що ми щойно написали:
      // update() дотягує власне згасання орбіти, і якби воно потрапило в
      // знімок як «різниця», директор порахував би власний рух за рух пальця
      // і поїхав би сам по собі.
      written.current = portalCameraTurn(
        [camera.position.x, camera.position.y, camera.position.z],
        [orbit.target.x, orbit.target.y, orbit.target.z],
      );
    }
  });

  return null;
}
