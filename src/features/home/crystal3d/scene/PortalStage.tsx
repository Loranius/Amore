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
import { PORTAL_PALETTES, portalCameraFrame } from './portalScene';

export interface PortalStageProps {
  seed: number;
  theme: 'light' | 'dark';
  quality: 'high' | 'balanced' | 'low' | 'fallback';
  reduceMotion: boolean;
  children: ReactNode;
}

export function PortalStage({ seed, theme, quality, reduceMotion, children }: PortalStageProps) {
  const size = useThree((state) => state.size);
  const controls = useRef<OrbitControlsImpl>(null);
  const aspect = size.height > 0 ? size.width / size.height : 1;
  const frame = useMemo(() => portalCameraFrame(aspect), [aspect]);
  const palette = PORTAL_PALETTES[theme];

  return (
    <>
      <ambientLight intensity={0.26} />
      <directionalLight position={[3, 4, 2]} intensity={1.08} />
      <directionalLight position={[-2.5, 3.5, -3.5]} intensity={0.82} color="#fff1f6" />
      <pointLight position={[-3, -2, -2]} intensity={0.34} color="#e6a0bd" />
      {/* Заповнювальне світло знизу-ззаду: без нього колони й далеке
          поле провалюються в чорноту, а туман не має що підсвічувати. */}
      <hemisphereLight args={[palette.daisLight, palette.field, 0.42]} />

      <PortalEnvironment
        seed={seed}
        theme={theme}
        quality={quality}
        frame={frame}
        aspect={aspect}
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
