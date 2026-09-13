// ============================================================
// PortalStage — усе, що всередині <Canvas>, крім самого артефакта.
// ------------------------------------------------------------
// Камера, орбіта, світло й оточення мусять читати один кадр
// (portalCameraFrame), інакше подіум опиниться в іншому місці, ніж на
// нього розраховує камера. Тримати їх у різних компонентах означало б
// передавати аспект трьома шляхами — тож вони живуть разом.
// ============================================================
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { PORTAL_ORBIT_DAMPING, coarsePointerNow, portalOrbitRotateSpeed } from './portalOrbit';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { PortalCameraRig, PortalEnvironment } from './PortalEnvironment';
import { PortalSky } from './PortalSky';
import { CRYSTAL_CENTRE_POSE, type WorldCameraPose } from '@/features/world/crystalAtlas';
import { MANUAL_ZOOM_RANGE, type WorldMotionMode } from '@/features/world/sceneDirector';
import {
  PORTAL_KEY_LIGHT,
  PORTAL_PALETTES,
  PORTAL_RIM_LIGHT,
  portalCameraFrame,
} from './portalScene';

export interface PortalStageProps {
  seed: number;
  theme: 'light' | 'dark';
  quality: 'high' | 'balanced' | 'low' | 'fallback';
  reduceMotion: boolean;
  /**
   * Радіус видимих кристалів.
   *
   * Подіум під нього більше не масштабується: руїна — це місце сталого
   * розміру, і підганятись тепер мусить кристал (`PortalRuin`). Проп
   * лишається, бо саме він понесе цю підгонку, коли кристал перепишуть;
   * доти сцена його не читає, і це названо, а не сховано.
   */
  artifactSceneRadius?: number | undefined;
  /** Радіус самих кристалів — кадр камери будується під нього. */
  crystalsSceneRadius: number;
  /**
   * Наскільки високо стоїть артефакт у сцені.
   *
   * Кадр камери йде за ним: малий кристал знімається зблизька як головний
   * артефакт екрана, великий — здалеку, з залою за ним. Див.
   * `portalCameraFrame`.
   */
  artifactSceneHeight: number;
  /** Напрямки гілок кварцової жили — камінь платформи вигинається над ними. */
  veinBearings: readonly number[];
  /** Виліт жили в одиницях сцени — усередині нього камінь лишається пласким. */
  veinReach: number;
  /**
   * Куди дивиться світ на поточному маршруті (атлас, ADR-0021).
   *
   * Приходить пропом, а не з `useWorldPose()` тут, і це не стиль. `<Canvas>`
   * тримає власний корінь React; зміна контексту ззовні не перемальовує його
   * сама по собі. Виміряно на живому порталі: коли позу читали всередині
   * полотна, зміна маршруту доїжджала до камери **через 30 секунд** — рівно
   * тоді, коли щось інше змушувало перемалюватись батька. Проп проходить
   * через дітей `<Canvas>`, і це працює завжди.
   */
  pose?: WorldCameraPose | undefined;
  /** Власне обертання кристала у фоні модуля, рад/с. */
  spin?: number | undefined;
  /** Режим руху світу (§27). Реф — його читає цикл рендера, не DOM. */
  motionMode?: { current: Exclude<WorldMotionMode, 'navigation'> } | undefined;
  /**
   * Чи можна крутити сцену пальцем.
   *
   * Тільки на головній. У модулі камера приходить у позу маршруту й лишається
   * там: власник сформулював це прямо — «зробити покрут і стати сталим». Поки
   * орбіту дозволяли всюди, дошка бажань будувалась під один азимут, а глядач
   * від'їжджав на інший, і половину бажань доводилось дошукувати обертом.
   */
  allowOrbit?: boolean | undefined;
  /**
   * Режим огляду з конструктора: відпускає режисер камери та додає zoom/pan.
   * Після вимкнення PortalCameraRig повертає канонічний кадр сцени.
   */
  freeCamera?: boolean | undefined;
  /**
   * Малювати небо В СЦЕНІ, а не лишати його CSS-градієнту під полотном.
   *
   * Вмикається разом із заломленням (`?gfx=refraction`) і тільки з ним:
   * буфер `renderTransmissionPass` містить лише об'єкти сцени, тож без
   * цього прозоре тіло показує білий прямокутник (ADR-0178).
   */
  sky?: boolean | undefined;
  children: ReactNode;
}

export function PortalStage({
  seed,
  theme,
  quality,
  reduceMotion,
  crystalsSceneRadius,
  artifactSceneHeight,
  veinBearings,
  veinReach,
  pose,
  spin,
  motionMode,
  allowOrbit = true,
  freeCamera = false,
  sky = false,
  children,
}: PortalStageProps) {
  const size = useThree((state) => state.size);
  const controls = useRef<OrbitControlsImpl>(null);
  // Питається РАЗ: миша не з'являється на телефоні посеред жесту.
  const [coarsePointer] = useState(coarsePointerNow);
  const aspect = size.height > 0 ? size.width / size.height : 1;
  const frame = useMemo(
    () => portalCameraFrame(aspect, crystalsSceneRadius, artifactSceneHeight),
    [aspect, crystalsSceneRadius, artifactSceneHeight],
  );
  const palette = PORTAL_PALETTES[theme];
  /*
   * Від чого відлічується ×5 (ADR-0160).
   *
   * Від відстані, на якій маршрут ЩОЙНО закадрував артефакт, а не від
   * сталої в одиницях сцени. Кадр і так їде за віком кристала, тож стала
   * означала б, що на молодій парі «×5 назад» показує пів неба, а на
   * дорослій — ледве відступ. Множник кадру тримає жест тим самим у будь-
   * якому віці.
   *
   * ТІ САМІ ЧИСЛА ЗНАЄ Й ДИРЕКТОР (`MANUAL_ZOOM_RANGE`), і саме тому вони
   * одна стала на двох. Орбіта зупиняє жест, директор зберігає результат;
   * розійшлись би — між ними з'явилась би мертва зона, у якій палець
   * тягне, а камера стоїть.
   */
  const zoomAnchor = frame.distance * (pose?.distance ?? CRYSTAL_CENTRE_POSE.distance);
  const handZoom = freeCamera || allowOrbit;
  /*
   * Режим огляду конструктора лишається зі СВОЇМИ межами (0.16…3.2), і це
   * навмисне виключення. Вони старші за це прохання й вирішують іншу
   * задачу: підійти впритул до грані (0.6 одиниці — там, де камера ще не
   * пірнула в тіло) у режимі, де директор камеру не тримає взагалі.
   * Накинути на них ×5 означало б ВІДІБРАТИ 0.16.
   */
  const nearest = freeCamera
    ? Math.max(0.6, frame.distance * 0.16)
    : zoomAnchor / MANUAL_ZOOM_RANGE;
  const farthest = freeCamera ? frame.distance * 3.2 : zoomAnchor * MANUAL_ZOOM_RANGE;

  return (
    <>
      {sky && <PortalSky theme={theme} />}
      {/* Одне домінантне джерело, решта — натяк.
          Було два майже рівні зустрічні прожектори (1.08 і 0.82) плюс
          ambient 0.26, point 0.34 і hemisphere 0.5. Сумарно заливка
          перевищувала ключове світло, тож будь-яка грань, відвернута від
          одного прожектора, потрапляла під другий — тіні між гранями
          заповнювались, і скільки б фасетів не мала геометрія, кристал
          читався рівним. Різниця яскравості між сусідніми площинами — це
          і є те, що робить грань гранню. */}
      <ambientLight intensity={palette.ambient} />
      {/* Сила й колір — із палітри, позиція — спільна. Ніч і полудень
          різняться яскравістю, а не композицією: §10 каже, ЗВІДКИ падає
          ключ, і це властивість сцени, а не пори доби. */}
      {/* Ключ ліворуч-згори і теплий, а не білий (§10 брифу).
          Камера дивиться з +Z на початок координат, тож екранне «ліворуч» —
          це від'ємний X; світло стояло на +3, тобто праворуч.

          1.42 → 1.9. Не «щоб яскравіше»: заливку виміряно, і без цього
          підняття ключ програвав їй. Див. коментар до кореневого світла. */}
      <directionalLight
        position={[...PORTAL_KEY_LIGHT.position]}
        intensity={palette.keyIntensity}
        color={palette.keyColour}
      />
      {/* Не другий ключ, а контровий підсвіт: рівно стільки, щоб тіньовий
          бік не йшов у чорноту. Прохолодний бузковий проти теплого ключа —
          пара, яку вимагає §10; був майже білий рожевий, тобто того ж
          відтінку, що й ключ, і контраст між боками нічого не додавав.
          Стоїть навпроти нового ключа, бо асиметрія — це і є весь сенс. */}
      <directionalLight
        position={[...PORTAL_RIM_LIGHT.position]}
        intensity={palette.rimIntensity}
        color={palette.rimColour}
      />
      {/* Точкового світла тут більше немає. Виміряно занулюванням на живому
          порталі: воно зсувало сцену на 0.02 зі 255, а артефакт — на 0.01,
          тобто нижче за одиницю квантування. Причина арифметична: точкове
          джерело в three має decay 2, а це стояло за чотири одиниці від
          подіуму — 0.16 інтенсивності поділити на шістнадцять. Воно не було
          заслабким налаштуванням, воно було відсутнім. */}
      {/* Заповнювальне світло: без нього грані, повернуті вниз, ідуть у
          суцільний чорний, який читається дірою. «Небо» тут — світло від
          кореня, «земля» — світло, ВІДБИТЕ плато: саме його бачить під
          собою нижній обвід жеоди. Окремою роллю, а не кольором самого
          каменю — див. `groundBounce` у палітрі: коли ці двоє злились,
          різниця сусідніх граней кристала впала нижче порога.

          Самого острова це світло не торкається взагалі — він намальований
          (`portalIsland.ts`), а не освітлений. */}
      <hemisphereLight args={[palette.rootLight, palette.groundBounce, palette.hemisphere]} />

      <PortalEnvironment
        seed={seed}
        theme={theme}
        quality={quality}
        reduceMotion={reduceMotion}
        frame={frame}
        aspect={aspect}
        veinBearings={veinBearings}
        veinReach={veinReach}
      />
      <PortalCameraRig
        frame={frame}
        controls={controls}
        pose={pose}
        mode={motionMode}
        spin={spin}
        freeCamera={freeCamera}
      />

      {children}

      <OrbitControls
        key={freeCamera ? 'free-camera' : 'directed-camera'}
        ref={controls}
        enablePan={freeCamera}
        enableZoom={handZoom}
        enableRotate={freeCamera || allowOrbit}
        enableDamping={!reduceMotion}
        /*
         * Згасання й швидкість повороту живуть у `portalOrbit.ts` разом
         * із таблицею, за якою їх обрано: три застосовує згасання НА
         * КАДР, тож на телефоні з нижчою частотою колишні 0.08 давали за
         * 200 мс лише 39% жесту. Саме це власник назвав «повільним і
         * важким».
         */
        dampingFactor={PORTAL_ORBIT_DAMPING}
        rotateSpeed={portalOrbitRotateSpeed(coarsePointer, freeCamera)}
        /*
         * ЩИПОК ТЕПЕР НАШ, І ЦЕ ЦІНА, А НЕ ДРІБНИЦЯ.
         *
         * Тут стояло, що масштаб на головній вимкнено, «а перевизначати
         * жести двома пальцями означало б забрати в сторінки щипок». Так
         * і є: над полотном пара більше не збільшить сторінку двома
         * пальцями. Власник попросив зум прямо, і плата названа, а не
         * схована. Поза полотном щипок лишається сторінці — `OrbitControls`
         * слухає лише елемент `<canvas>`.
         *
         * Зсув НЕ вмикається разом із масштабом. Зсув зрушує точку
         * прицілу, тобто дозволяє вивести артефакт із кадру й лишити пару
         * дивитись у порожнє небо без способу повернутись; масштаб цього
         * зробити не може.
         */
        zoomSpeed={0.78}
        panSpeed={0.68}
        screenSpacePanning={freeCamera}
        minDistance={handZoom ? nearest : 0}
        maxDistance={handZoom ? farthest : Infinity}
        // Сцена стоїть на землі: дозволити камері пірнути під підлогу
        // означало б показати виворіт подіуму й вивернуті нормалі поля.
        minPolarAngle={Math.PI * (freeCamera ? 0.06 : 0.22)}
        maxPolarAngle={Math.PI * 0.5}
        // Цілі тут більше немає, і це не пропуск: її щокадру ставить
        // PortalCameraRig, бо вона залежить від пози маршруту (targetHeight),
        // а не лише від кадру. Проп повертав би її до кадру на кожному
        // перемальовуванні — два власники однієї величини.
      />
    </>
  );
}
