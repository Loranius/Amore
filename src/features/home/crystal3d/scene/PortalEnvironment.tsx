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
  type PortalCameraFrame,
} from './portalScene';
import {
  CAVE_CEILING_HEIGHT,
  CAVE_DRUSE_CLUSTERS,
  buildPortalCaveDruseGeometry,
  buildPortalCaveFloorGeometry,
  buildPortalCaveOculusGeometry,
  buildPortalCaveShaftGeometry,
  buildPortalCaveShellGeometry,
} from './portalCave';

export interface PortalEnvironmentProps {
  /** Насіння артефакта: печера в кожної пари своя й незмінна. */
  seed: number;
  theme: 'light' | 'dark';
  /** Профіль якості з пайплайну кристала — сцена не має права коштувати
   *  більше за сам артефакт на слабкому пристрої. */
  quality: 'high' | 'balanced' | 'low' | 'fallback';
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

/*
 * ТУТ ЖИЛО НЕБО, І ВОНО ПІШЛО РАЗОМ ІЗ ХРАМОМ.
 *
 * Зорі, туманність і небесні дуги малювались одним point pass із власним
 * шейдером; `starCount`/`hazeCount` роздавали їм кількість за профілем
 * якості. Усе це описувало ВІДКРИТИЙ простір над руїною.
 *
 * У печері неба немає — є розлом у склепінні, і крізь нього видно рівно
 * один диск (`buildPortalCaveOculusGeometry`). Лишити зорі означало б
 * малювати їх крізь камінь: вони йшли `depthTest`, але сфера радіусом 34
 * стоїть ЗА стіною, тобто половина кадру світилась би точками там, де
 * має бути порода.
 */

export function PortalEnvironment({
  seed,
  theme,
  quality,
  frame,
}: PortalEnvironmentProps) {
  const palette = PORTAL_PALETTES[theme];

  const caveShell = useMemo(() => buildPortalCaveShellGeometry(seed), [seed]);
  const caveFloor = useMemo(() => buildPortalCaveFloorGeometry(seed), [seed]);
  const caveOculus = useMemo(() => buildPortalCaveOculusGeometry(seed), [seed]);
  const caveShaft = useMemo(() => buildPortalCaveShaftGeometry(seed), [seed]);
  /*
   * Друза коштує трикутників, тож її кількість веде профіль якості — і
   * на запасному рендерері її немає взагалі. Це єдина частина печери, яку
   * можна не малювати: стіни без друзи лишаються печерою, друза без стін
   * висить у порожнечі.
   */
  const druseClusters = CAVE_DRUSE_CLUSTERS[quality];
  const caveDruse = useMemo(
    () => (druseClusters > 0 ? buildPortalCaveDruseGeometry(seed, druseClusters) : null),
    [seed, druseClusters],
  );

  useEffect(() => () => {
    caveShell.dispose();
    caveFloor.dispose();
    caveOculus.dispose();
    caveShaft.dispose();
    caveDruse?.dispose();
  }, [caveShell, caveFloor, caveOculus, caveShaft, caveDruse]);

  /*
   * Раніше тут повільно оберталось небо. Печера не обертається: камінь
   * стоїть, і рухається в цьому кадрі тільки сам артефакт.
   */

  return (
    <>
      <fog attach="fog" args={[palette.fog, frame.fogNear, frame.fogFar]} />

      {/*
        ПЕЧЕРА ЗАМІСТЬ ХРАМУ (ADR-0117).
        ------------------------------------------------------------
        Тут стояла авторська руїна `amore_ruin.glb` — мармуровий подіум,
        обеліски, золоте кільце, — а до неї храм, зібраний кодом із
        вісімнадцяти колон, арок і світильників.

        Власник скасував цей світ разом із `PRODUCT.md` і `DESIGN.md`. І
        причина не в тому, що руїна погана: `amore-crystal-look` каже
        прямо, що гладка суцільна поверхня під кристалом читається
        п'єдесталом, хай як її формувати. Жеода, яку ADR-0115 підняв
        коміром, стояла на мармуровій плиті — тобто порода лежала на
        підставці.

        Підлога печери лягає рівно на `PORTAL_GROUND_Y`, як і верх
        п'єдесталу руїни до неї. Про заміну сцени не дізнається жоден
        інший файл.
      */}
      {/*
        Камінь НАМАЛЬОВАНИЙ, а не освітлений — `meshBasicMaterial` із
        вершинним кольором. Причина виміряна й записана в `portalCave.ts`:
        світло, якого досить, щоб побачити стіну за десять одиниць,
        залило б кристал за три, а різниця яскравості сусідніх граней і є
        те, що робить кристал кристалом. Жодне джерело сцени печери не
        торкається, тож ця різниця лишається такою, як її виміряли.
      */}
      <mesh geometry={caveShell} frustumCulled={false}>
        <meshBasicMaterial color={palette.caveRock} vertexColors />
      </mesh>
      <mesh geometry={caveFloor} frustumCulled={false}>
        <meshBasicMaterial color={palette.caveFloor} vertexColors />
      </mesh>

      {/* Розлом у склепінні. Він не отвір, а диск: справжня дірка лишила б
          оболонку відкритою, і туман зали витікав би крізь неї у фон. */}
      <mesh geometry={caveOculus} frustumCulled={false}>
        <meshBasicMaterial color={palette.oculus} toneMapped={false} fog={false} />
      </mesh>

      {/* Друза по стінах — те, що робить печеру КРИСТАЛЬНОЮ. Уночі вона
          світиться сама й є другим джерелом світла після артефакта; удень
          не світиться взагалі: при денному промені світний кристал на стіні
          читається лампою, а не мінералом. */}
      {caveDruse !== null && (
        <mesh geometry={caveDruse} frustumCulled={false}>
          <meshStandardMaterial
            color={palette.caveDruse}
            emissive={palette.caveDruse}
            emissiveIntensity={palette.caveDruseEmissive}
            roughness={0.32}
            metalness={0}
            flatShading
          />
        </mesh>
      )}

      {/* САМ ПРОМІНЬ — тіло, а не світло.
          ------------------------------------------------------------
          Напрямлене джерело нижче освітлює кристал і друзу; побачити
          промінь від нього неможливо — промінь видно тому, що в повітрі
          пил, а об'ємного розсіювання тут немає й не буде.

          Тому конус: адитивний, без запису глибини, гасне донизу
          вершинним кольором. Він нічого не освітлює — він і Є те, що
          видно. Опукла сторона відсічена (`BackSide` не потрібен): конус
          дивиться назовні, і глядач бачить його дальню стінку крізь
          ближню саме тому, що глибина не пишеться. */}
      <mesh geometry={caveShaft} frustumCulled={false} renderOrder={2}>
        <meshBasicMaterial
          color={palette.oculus}
          vertexColors
          transparent
          opacity={palette.shaftOpacity}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
          toneMapped={false}
          fog={false}
        />
      </mesh>

      {/* Напрямлене світло з розлому — єдине, що відрізняє день від ночі
          в печері: удень воно веде сцену, уночі лишається натяком. */}
      <directionalLight
        position={[0.6, PORTAL_GROUND_Y + CAVE_CEILING_HEIGHT, 0.4]}
        intensity={palette.oculusIntensity}
        color={palette.oculus}
      />

      <pointLight
        position={[0, PORTAL_GROUND_Y + 0.35, 0.9]}
        distance={6.5}
        decay={2}
        intensity={palette.rootLightIntensity}
        color={palette.rootLight}
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
