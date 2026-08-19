// ============================================================
// PortalStage — усе, що всередині <Canvas>, крім самого артефакта.
// ------------------------------------------------------------
// Камера, орбіта, світло й оточення мусять читати один кадр
// (portalCameraFrame), інакше опора опиниться в іншому місці, ніж на
// неї розраховує камера. Тримати їх у різних компонентах означало б
// передавати аспект трьома шляхами — тож вони живуть разом.
// ============================================================
import { useMemo, useRef, type ReactNode } from 'react';
import { useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { PortalCameraRig } from './PortalEnvironment';
import { FloatingTempleScene } from './FloatingTempleScene';
import type { WorldCameraPose } from '@/features/world/crystalAtlas';
import type { WorldMotionMode } from '@/features/world/sceneDirector';
import {
  PORTAL_KEY_LIGHT,
  PORTAL_PALETTES,
  PORTAL_RIM_LIGHT,
  portalCameraFrame,
  portalDaisScale,
} from './portalScene';

export interface PortalStageProps {
  seed: number;
  theme: 'light' | 'dark';
  quality: 'high' | 'balanced' | 'low' | 'fallback';
  reduceMotion: boolean;
  /** Радіус видимого опорного сліду — сцена будує храм під нього. */
  artifactSceneRadius: number;
  /** Радіус самих кристалів — кадр камери будується під нього. */
  crystalsSceneRadius: number;
  /**
   * Наскільки високо стоїть артефакт у сцені.
   *
   * Кадр камери йде за ним: малий кристал знімається зблизька як головний
   * артефакт екрана, великий — здалеку. Див. `portalCameraFrame`.
   */
  artifactSceneHeight: number;
  /** Напрямки гілок кварцової жили — лишаються частиною контракту артефакта. */
  veinBearings: readonly number[];
  /** Виліт жили в одиницях сцени. */
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
   * там: власник сформулював це прямо — «зробити покрут і стати сталим».
   */
  allowOrbit?: boolean | undefined;
  children: ReactNode;
}

export function PortalStage({
  seed,
  theme,
  quality,
  reduceMotion,
  artifactSceneRadius,
  crystalsSceneRadius,
  artifactSceneHeight,
  pose,
  spin,
  motionMode,
  allowOrbit = true,
  children,
}: PortalStageProps) {
  const size = useThree((state) => state.size);
  const controls = useRef<OrbitControlsImpl>(null);
  const aspect = size.height > 0 ? size.width / size.height : 1;
  const frame = useMemo(
    () => portalCameraFrame(aspect, crystalsSceneRadius, artifactSceneHeight),
    [aspect, crystalsSceneRadius, artifactSceneHeight],
  );
  const daisScale = useMemo(() => portalDaisScale(artifactSceneRadius), [artifactSceneRadius]);
  const palette = PORTAL_PALETTES[theme];

  return (
    <>
      {/* Нова сцена — плаваючий острів і храм на кам'яній долоні. Небо
          лишається CSS-фоном Canvas, а fog тільки зводить далеку скелю в нього. */}
      <fog attach="fog" args={[palette.fog, frame.fogNear, frame.fogFar]} />

      {/* Одне домінантне джерело, решта — натяк. */}
      <ambientLight intensity={palette.ambient} />
      <directionalLight
        position={[...PORTAL_KEY_LIGHT.position]}
        intensity={palette.keyIntensity}
        color={palette.keyColour}
      />
      <directionalLight
        position={[...PORTAL_RIM_LIGHT.position]}
        intensity={palette.rimIntensity}
        color={palette.rimColour}
      />
      <hemisphereLight args={[palette.daisLight, palette.dais, palette.hemisphere]} />

      <FloatingTempleScene
        seed={seed}
        theme={theme}
        quality={quality}
        daisScale={daisScale}
      />
      <PortalCameraRig frame={frame} controls={controls} pose={pose} mode={motionMode} spin={spin} />

      {children}

      <OrbitControls
        ref={controls}
        enablePan={false}
        enableZoom={false}
        enableRotate={allowOrbit}
        enableDamping={!reduceMotion}
        dampingFactor={0.08}
        // Верхня платформа й долоня мають читатись згори; нижче горизонту
        // камера показала б внутрішні площини скелі й сходів.
        minPolarAngle={Math.PI * 0.22}
        maxPolarAngle={Math.PI * 0.5}
        // Ціль щокадру ставить PortalCameraRig, бо вона залежить від пози
        // маршруту (targetHeight), а не лише від кадру.
      />
    </>
  );
}
