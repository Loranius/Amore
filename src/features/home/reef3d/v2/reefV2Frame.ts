// ============================================================
// Риф v2 у кадрі порталу (ADR-0219).
// ------------------------------------------------------------
// Масштаб СТАЛИЙ, як у кристала й дерева v2: дорослий (25-річний) риф
// заповнює кадр ушир, молодший лишається меншим. Дуже високий риф
// стискається до рамки, а не вилазить.
// ============================================================
import { ARTIFACT_FIT_HEIGHT, ARTIFACT_FIT_WIDTH } from '@/engine/renderer/three';
import type { ReefV2Geometry } from '@/engine/species/reefV2/geometry';

/** Розмах дорослого рифу в одиницях моделі: голова 1.3 і колонії на краю. */
const ADULT_REACH = 2.3;

export interface ReefV2Frame {
  scale: number;
  height: number;
  reach: number;
}

export function reefV2Frame(geometry: ReefV2Geometry): ReefV2Frame {
  const reference = ARTIFACT_FIT_WIDTH / (2 * ADULT_REACH);
  const contain = Math.min(
    ARTIFACT_FIT_HEIGHT / Math.max(1e-3, geometry.top),
    ARTIFACT_FIT_WIDTH / Math.max(1e-3, geometry.reach * 2),
  );
  const scale = Math.min(reference, contain);
  return { scale, height: geometry.top * scale, reach: geometry.reach * scale };
}
