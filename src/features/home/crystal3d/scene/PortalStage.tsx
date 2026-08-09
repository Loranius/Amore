// ============================================================
// PortalStage — усе, що всередині <Canvas>, крім самого артефакта.
// ------------------------------------------------------------
// Камера, орбіта, світло й оточення мусять читати один кадр
// (portalCameraFrame), інакше подіум опиниться в іншому місці, ніж на
// нього розраховує камера. Тримати їх у різних компонентах означало б
// передавати аспект трьома шляхами — тож вони живуть разом.
// ============================================================
import { useMemo, useRef, type ReactNode } from 'react';
import { useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { PortalCameraRig, PortalEnvironment } from './PortalEnvironment';
import { PORTAL_PALETTES, portalCameraFrame, portalDaisScale } from './portalScene';

export interface PortalStageProps {
  seed: number;
  theme: 'light' | 'dark';
  quality: 'high' | 'balanced' | 'low' | 'fallback';
  reduceMotion: boolean;
  /** Радіус каменю в одиницях сцени — подіум будується під нього. */
  artifactSceneRadius: number;
  /** Радіус самих кристалів — кадр камери будується під нього. */
  crystalsSceneRadius: number;
  /** Напрямки гілок кварцової жили — камінь платформи вигинається над ними. */
  veinBearings: readonly number[];
  /** Виліт жили в одиницях сцени — усередині нього камінь лишається пласким. */
  veinReach: number;
  children: ReactNode;
}

export function PortalStage({
  seed,
  theme,
  quality,
  reduceMotion,
  artifactSceneRadius,
  crystalsSceneRadius,
  veinBearings,
  veinReach,
  children,
}: PortalStageProps) {
  const size = useThree((state) => state.size);
  const controls = useRef<OrbitControlsImpl>(null);
  const aspect = size.height > 0 ? size.width / size.height : 1;
  const frame = useMemo(
    () => portalCameraFrame(aspect, crystalsSceneRadius),
    [aspect, crystalsSceneRadius],
  );
  const daisScale = useMemo(() => portalDaisScale(artifactSceneRadius), [artifactSceneRadius]);
  const palette = PORTAL_PALETTES[theme];

  return (
    <>
      {/* Одне домінантне джерело, решта — натяк.
          Було два майже рівні зустрічні прожектори (1.08 і 0.82) плюс
          ambient 0.26, point 0.34 і hemisphere 0.5. Сумарно заливка
          перевищувала ключове світло, тож будь-яка грань, відвернута від
          одного прожектора, потрапляла під другий — тіні між гранями
          заповнювались, і скільки б фасетів не мала геометрія, кристал
          читався рівним. Різниця яскравості між сусідніми площинами — це
          і є те, що робить грань гранню. */}
      <ambientLight intensity={0.1} />
      <directionalLight position={[3, 4, 2]} intensity={1.42} />
      {/* Не другий ключ, а контровий підсвіт: рівно стільки, щоб тіньовий
          бік не йшов у чорноту. */}
      <directionalLight position={[-2.5, 3.5, -3.5]} intensity={0.26} color="#fff1f6" />
      {/* Точкового світла тут більше немає. Виміряно занулюванням на живому
          порталі: воно зсувало сцену на 0.02 зі 255, а артефакт — на 0.01,
          тобто нижче за одиницю квантування. Причина арифметична: точкове
          джерело в three має decay 2, а це стояло за чотири одиниці від
          подіуму — 0.16 інтенсивності поділити на шістнадцять. Воно не було
          заслабким налаштуванням, воно було відсутнім. */}
      {/* Заповнювальне світло лишається, бо без нього колони й далеке поле
          провалюються в чорноту, а туман не має що підсвічувати — але вдвічі
          слабше. «Земля» тут — колір подіуму, а не поля: грані, повернуті
          вниз (нижній обвід каменю, з якого росте друза), бачать саме камінь
          під собою, і з темним полем вони йшли в суцільний чорний, який
          читався як діра. */}
      <hemisphereLight args={[palette.daisLight, palette.dais, 0.24]} />

      <PortalEnvironment
        seed={seed}
        theme={theme}
        quality={quality}
        frame={frame}
        aspect={aspect}
        daisScale={daisScale}
        veinBearings={veinBearings}
        veinReach={veinReach}
      />
      <PortalCameraRig frame={frame} controls={controls} />

      {children}

      <OrbitControls
        ref={controls}
        enablePan={false}
        enableZoom={false}
        enableDamping={!reduceMotion}
        dampingFactor={0.08}
        // Сцена стоїть на землі: дозволити камері пірнути під підлогу
        // означало б показати виворіт подіуму й вивернуті нормалі поля.
        minPolarAngle={Math.PI * 0.22}
        maxPolarAngle={Math.PI * 0.5}
        target={[frame.target[0], frame.target[1], frame.target[2]]}
      />
    </>
  );
}
