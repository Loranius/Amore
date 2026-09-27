// ============================================================
// Воркер туманності «Нашого шляху» (ADR-0214).
// ------------------------------------------------------------
// Пів мільйона пікселів тривимірного шуму — у головному потоці це був би
// ривок саме тоді, коли модуль відкривається. Зірки тим часом уже світять:
// вони не чекають на туманність.
// ============================================================
import { JOURNEY_NEBULA_HEIGHT, JOURNEY_NEBULA_WIDTH, paintJourneyNebula } from './journeySky';

self.onmessage = () => {
  const pixels = paintJourneyNebula();
  (self as unknown as Worker).postMessage(
    { width: JOURNEY_NEBULA_WIDTH, height: JOURNEY_NEBULA_HEIGHT, pixels },
    [pixels.buffer],
  );
};
