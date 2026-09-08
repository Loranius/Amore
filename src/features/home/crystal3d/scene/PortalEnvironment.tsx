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
// пікселів, які й так однакові. Відколи сцена — літаючий острів
// (ADR-0141), це вже не компроміс, а сама будова кадру: полотно
// прозоре, і небо теми ВИДНО за краєм острова.
// ============================================================
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { rockGrainTexture } from './rockGrainTexture';
import { portalLevitation } from './portalLevitation';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { CRYSTAL_CENTRE_POSE, type WorldCameraPose } from '@/features/world/crystalAtlas';
import {
  NO_MANUAL_VIEW,
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
  PORTAL_CLOUD_BANKS,
  PORTAL_DRIFT_ROCKS,
  PORTAL_ISLAND_RUBBLE,
  buildPortalCloudGeometry,
  buildPortalDriftGeometry,
  buildPortalIslandGeometry,
  buildPortalTempleGeometry,
  portalIslandScale,
} from './portalIsland';

export interface PortalEnvironmentProps {
  /** Насіння артефакта: острів у кожної пари свій і незмінний. */
  seed: number;
  theme: 'light' | 'dark';
  /** Профіль якості з пайплайну кристала — сцена не має права коштувати
   *  більше за сам артефакт на слабкому пристрої. */
  quality: 'high' | 'balanced' | 'low' | 'fallback';
  /**
   * Чи просив пристрій менше руху.
   *
   * Левітація брил зупиняється разом із диханням камери: §47 каже, що
   * зменшений рух зберігає простір і прибирає подорож, а камінь, що
   * гойдається під нерухомою камерою, — це і є подорож без згоди.
   */
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
  reduceMotion,
  frame,
}: PortalEnvironmentProps) {
  const palette = PORTAL_PALETTES[theme];

  const island = useMemo(
    () => buildPortalIslandGeometry(seed, PORTAL_ISLAND_RUBBLE[quality]),
    [seed, quality],
  );
  const temple = useMemo(() => buildPortalTempleGeometry(seed), [seed]);
  const drift = useMemo(
    () => buildPortalDriftGeometry(seed, PORTAL_DRIFT_ROCKS[quality]),
    [seed, quality],
  );
  const clouds = useMemo(
    () => buildPortalCloudGeometry(seed, PORTAL_CLOUD_BANKS[quality]),
    [seed, quality],
  );

  /*
   * Одне полотно на весь застосунок — і на обидві теми: воно несе лише
   * яскравість, а тон дає палітра. `useMemo` без залежностей тримає його
   * від перебудови; сама функція теж кешує, тож двох полотен не буде й
   * при двох порталах.
   */
  const rockGrain = useMemo(() => rockGrainTexture(), []);

  /*
   * ЛЕВІТАЦІЯ БРИЛ (ADR-0162).
   *
   * Годинник живе в рефі, а не в стані: він рухається щокадру, і стан
   * перемальовував би все дерево шістдесят разів на секунду заради одного
   * числа в уніформі. Так само влаштований годинник аврори в рушії.
   */
  const floatClock = useRef<{ value: number } | null>(null);
  const levitate = useMemo(() => portalLevitation(floatClock), []);
  const floatSeconds = useRef(0);
  useFrame((_, delta) => {
    // Зупиняється разом із диханням камери, а не окремим прапорцем: камінь,
    // що гойдається під нерухомою камерою, — це подорож без згоди (§47).
    if (reduceMotion) return;
    if (floatClock.current === null) return;
    floatSeconds.current += Math.min(delta, 1 / 15);
    floatClock.current.value = floatSeconds.current;
  });

  /*
   * ОДИН МАСШТАБ НА ВСЮ СЦЕНУ, І ВІН ІДЕ ЗА КАДРОМ.
   *
   * Острів будується в одиницях острова — радіус 1, верх плато на нулі, —
   * а світові координати дістає тут. Причина в тому, що кадр порталу
   * підганяється під артефакт: чим старша пара, тим далі камера. Сцена
   * сталого розміру означала б два різні світи — у молодої пари рівнина
   * за обидва краї кадру, у старої камінець під кристалом.
   *
   * Оскільки масштаб іде за відстанню, екранний розмір острова сталий, і
   * вся арифметика цієї сцени рахувалась один раз.
   */
  const scale = portalIslandScale(frame.distance);

  useEffect(() => () => {
    island.dispose();
    temple.dispose();
    drift.dispose();
    clouds.dispose();
  }, [island, temple, drift, clouds]);

  return (
    <>
      {/*
        ТУМАН НЕ ДІСТАЄ ДО ХМАР, І ЦЕ НАВМИСНО.
        ------------------------------------------------------------
        `fogFar` = відстань камери + 26, тобто близько тридцяти одиниць.
        Море хмар стоїть на 56–130, бо ближче воно ховається за самим
        островом (арифметика в `portalIsland.ts`). Отже під туманом воно
        було б рівно кольору туману — тобто нічим. Хмари беруть `fog`
        вимкненим і малюються власним тоном.
      */}
      <fog attach="fog" args={[palette.fog, frame.fogNear, frame.fogFar]} />

      {/*
        ЛІТАЮЧИЙ ОСТРІВ ЗАМІСТЬ ПЕЧЕРИ (ADR-0141).
        ------------------------------------------------------------
        Тут стояла кристальна печера: зала, розлом у склепінні, промінь і
        друза по стінах. Власник скасував її прямо — «прибираємо печеру,
        робимо древній маленький храм, який знаходиться на літаючому
        острові».

        Що НЕ змінилось: верх острова лежить рівно на `PORTAL_GROUND_Y`,
        тій самій площині, на якій рушій ставить кристали, і про заміну
        сцени не дізнається жоден інший файл.
      */}
      {/*
        Камінь НАМАЛЬОВАНИЙ, а не освітлений — `meshBasicMaterial` із
        вершинним кольором. Причина виміряна й не залежить від того, який
        тут світ: світло, якого досить, щоб побачити камінь за десять
        одиниць, залило б кристал за три, а різниця яскравості сусідніх
        граней і є те, що робить кристал кристалом.

        ЗЕРНО — ЄДИНА КАРТА В ЦІЙ СЦЕНІ, І ВОНА ТІЛЬКИ НА КАМЕНІ.
        `amore-crystal-look` проводить межу прямо: карта на вирощеній
        грані перебігає через ребро й каже оку, що дві площини — одна
        поверхня. Битий камінь — випадок протилежний, і зерно є більшою
        частиною того, що відрізняє камінь від пластику.
      */}
      <group position={[0, PORTAL_GROUND_Y, 0]} scale={scale}>
        <mesh geometry={island} frustumCulled={false}>
          <meshBasicMaterial color={palette.islandRock} vertexColors map={rockGrain} />
        </mesh>

      {/*
        Храм СВІТЛІШИЙ за плато й БЕЗ зерна.
        ------------------------------------------------------------
        Зерно тут працювало б проти змісту: воно каже «злам породи», а
        храм — камінь тесаний. Різниця тону плюс відсутність зерна і є те,
        чим око відрізняє зроблене руками від того, що просто лежить.
      */}
        <mesh geometry={temple} frustumCulled={false}>
          <meshBasicMaterial color={palette.templeStone} vertexColors />
        </mesh>

      {/*
        Брили в небі — те, що НЕСЕ слово «літаючий». Камера дивиться на
        острів згори й не бачить його обриву; про порожнечу під ногами
        каже камінь, який висить поруч без опори.
      */}
        <mesh geometry={drift} frustumCulled={false}>
          {/*
            ЛЕВІТАЦІЯ — тут і тільки тут. Меш острова того самого атрибута
            не має, тож він не рухається за побудовою, а не за домовленістю
            (ADR-0162).
          */}
          <meshBasicMaterial
            color={palette.driftRock}
            vertexColors
            map={rockGrain}
            onBeforeCompile={levitate}
          />
        </mesh>

      {/*
        Море хмар — друга половина тієї самої фрази. Прозоре трохи, щоб
        читалось повітрям, і без запису глибини: хмари стоять найдалі за
        все в сцені, тож нічого й не мають перекривати.
      */}
        <mesh geometry={clouds} frustumCulled={false} renderOrder={-1}>
          <meshBasicMaterial
            color={palette.cloudSea}
            vertexColors
            transparent
            opacity={palette.cloudOpacity}
            depthWrite={false}
            fog={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      {/* Небо над островом — єдине, що відрізняє день від ночі: удень
          воно веде сцену, уночі лишається натяком.

          Висота ФІКСОВАНА, а не масштабована разом з островом: у
          напрямленого світла позиція задає лише НАПРЯМОК, тож масштаб
          сцени робив би сонце то вищим, то нижчим залежно від віку пари.
          А кут падіння — це різниця яскравості сусідніх граней, тобто
          рівно те, чим кристал і читається кристалом. */}
      <directionalLight
        position={[0.6, PORTAL_GROUND_Y + 5.2, 0.4]}
        intensity={palette.skyIntensity}
        color={palette.skyLight}
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
  const written = useRef<{ azimuth: number; elevation: number; distance: number } | null>(null);
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

    let drift = NO_MANUAL_VIEW;
    if (written.current && orbit) {
      const actual = portalCameraTurn(
        [camera.position.x, camera.position.y, camera.position.z],
        [orbit.target.x, orbit.target.y, orbit.target.z],
      );
      drift = {
        azimuth: shortestTurn(written.current.azimuth, actual.azimuth),
        elevation: actual.elevation - written.current.elevation,
        /*
         * Масштаб — ВІДНОШЕННЯ, а не різниця, бо `distance` пози сама є
         * множником кадру. Знаменник береться з того, що директор
         * написав минулого кадру, тож зведення пальців на 10% лишається
         * десятьма відсотками і зблизька, і здалеку.
         */
        zoom: written.current.distance > 1e-6 ? actual.distance / written.current.distance : 1,
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
