// ============================================================
// Воркер намальованого неба (ADR-0210).
// ------------------------------------------------------------
// Малювання — два фрактальні шуми на піксель, 143 тисячі пікселів. У Node
// це ~130 мс; на телефоні кратно більше, і в головному потоці це був би
// ривок саме тоді, коли портал відкривається. Тут воно йде паралельно:
// до того, як небо готове, видно той самий градієнт, що й раніше.
// ============================================================
import {
  PORTAL_SKY_LOOKS,
  PORTAL_SKY_SHAPES,
  paintPortalSky,
  type PortalSkyShape,
} from './crystal3d/scene/portalSkyPainting';

self.onmessage = (event: MessageEvent<{ theme: 'light' | 'dark'; shape: PortalSkyShape }>) => {
  const theme = event.data.theme === 'dark' ? 'dark' : 'light';
  const { width, height } = PORTAL_SKY_SHAPES[event.data.shape === 'wide' ? 'wide' : 'tall'];
  const pixels = paintPortalSky(PORTAL_SKY_LOOKS[theme], width, height);
  (self as unknown as Worker).postMessage({ theme, width, height, pixels }, [pixels.buffer]);
};
