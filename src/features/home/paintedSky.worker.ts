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
  PORTAL_SKY_PAINT_HEIGHT,
  PORTAL_SKY_PAINT_WIDTH,
  paintPortalSky,
} from './crystal3d/scene/portalSkyPainting';

self.onmessage = (event: MessageEvent<'light' | 'dark'>) => {
  const theme = event.data === 'dark' ? 'dark' : 'light';
  const pixels = paintPortalSky(PORTAL_SKY_LOOKS[theme]);
  (self as unknown as Worker).postMessage(
    { theme, width: PORTAL_SKY_PAINT_WIDTH, height: PORTAL_SKY_PAINT_HEIGHT, pixels },
    [pixels.buffer],
  );
};
