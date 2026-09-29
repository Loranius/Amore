// ============================================================
// Виверження на дотик (ADR-0235).
// ------------------------------------------------------------
// Власник: «нехай лава починає текти лише при дотику по вулкану». У спокої
// жерло світиться, а рік немає. Дотик — і лава витікає з виїмок губи й
// біжить схилом до підніжжя, стоїть, холоне й зникає. Новий дотик під час
// виверження починає нове: лава знову біжить від жерла.
// ============================================================

/** Скільки лава біжить від жерла до підніжжя, с. */
export const ERUPTION_FLOW_S = 3.2;
/** Скільки ріки стоять повні, с. */
export const ERUPTION_HOLD_S = 6;
/** Скільки лава холоне й зникає, с. */
export const ERUPTION_COOL_S = 2.5;

export interface EruptionState {
  /** Фронт лави: 0 — лише в жерлі, 1 — до самого підніжжя. */
  front: number;
  /** Застигання 0…1: скільки лави вже згасло. */
  cool: number;
}

export const ERUPTION_REST: EruptionState = { front: 0, cool: 0 };

/**
 * Стан виверження через `elapsed` секунд після дотику; `null` — дотику ще не
 * було. Без руху (`reduceMotion`) лава з'являється одразу повною й так само
 * одразу зникає — без бігу й застигання.
 */
export function eruptionAt(elapsed: number | null, reduceMotion = false): EruptionState {
  if (elapsed === null || elapsed < 0) return ERUPTION_REST;
  const end = ERUPTION_FLOW_S + ERUPTION_HOLD_S + ERUPTION_COOL_S;
  if (elapsed >= end) return ERUPTION_REST;
  if (reduceMotion) return elapsed < ERUPTION_FLOW_S + ERUPTION_HOLD_S ? { front: 1, cool: 0 } : ERUPTION_REST;
  if (elapsed < ERUPTION_FLOW_S) {
    // Швидко з жерла, повільніше на пологому низу — як густа рідина.
    const t = elapsed / ERUPTION_FLOW_S;
    return { front: 1 - (1 - t) ** 2, cool: 0 };
  }
  const cooling = elapsed - ERUPTION_FLOW_S - ERUPTION_HOLD_S;
  return { front: 1, cool: cooling <= 0 ? 0 : cooling / ERUPTION_COOL_S };
}
