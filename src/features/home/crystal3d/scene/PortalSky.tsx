// ============================================================
// PortalSky — небо як тло СЦЕНИ, а не як CSS під полотном.
// ------------------------------------------------------------
// Існує заради заломлення (ADR-0178): буфер `renderTransmissionPass`
// містить лише сцену — і тло, бо `three` малює його тим же проходом
// (`background.render( scene )`). Поки небо було градієнтом під прозорим
// полотном, прозоре тіло показувало на його місці білий прямокутник,
// який `three` заливає сам.
// ============================================================
import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { PORTAL_PALETTES } from './portalScene';
import { buildPortalSkyTexture } from './portalSkyBackdrop';

export interface PortalSkyProps {
  theme: 'light' | 'dark';
}

export function PortalSky({ theme }: PortalSkyProps) {
  const scene = useThree((state) => state.scene);

  useEffect(() => {
    const texture = buildPortalSkyTexture(PORTAL_PALETTES[theme]);
    /*
     * Попереднє тло запам'ятовується й повертається на місце. Прапорець
     * `?gfx=` існує заради бісекції, а бісекція має сенс лише тоді, коли
     * «вимкнено» — це рівно той стан, що був до неї.
     */
    const previous = scene.background;
    scene.background = texture;
    return () => {
      scene.background = previous;
      texture.dispose();
    };
  }, [scene, theme]);

  return null;
}
