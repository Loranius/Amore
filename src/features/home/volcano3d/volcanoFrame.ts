// ============================================================
// Вулкан у кадрі порталу (ADR-0235).
// ------------------------------------------------------------
// Масштаб СТАЛИЙ, як у кристала, дерева й рифу: дорослий вулкан (≈25 років)
// заповнює кадр, молодший лишається меншим — ріст видно з року в рік. Дуже
// високий чи широкий стискається до рамки, а не вилазить.
// ============================================================
import { ARTIFACT_FIT_HEIGHT, ARTIFACT_FIT_WIDTH } from '@/engine/renderer/three';
import type { VolcanoGeometry } from '@/engine/species/volcano/geometry';
import { dioramaIslandRadius } from '@/features/home/diorama/dioramaStyle';

/** Дорослий вулкан в одиницях моделі: висота з коралами й розмах підніжжя. */
const ADULT_TOP = 2.7;
const ADULT_REACH = 1.6;

/**
 * Острів — та сама формула, що в кристала й дерева: спільний радіус 1.3,
 * більший лише коли самому вулканові (з коралами підніжжя) забракло місця.
 */
export function volcanoIsland(frame: VolcanoFrame): number {
  return dioramaIslandRadius(frame.reach * 1.1);
}

export interface VolcanoFrame {
  scale: number;
  height: number;
  reach: number;
}

export function volcanoFrame(geometry: Pick<VolcanoGeometry, 'top' | 'reach'>): VolcanoFrame {
  const reference = Math.min(ARTIFACT_FIT_HEIGHT / ADULT_TOP, ARTIFACT_FIT_WIDTH / (2 * ADULT_REACH));
  const contain = Math.min(
    ARTIFACT_FIT_HEIGHT / Math.max(1e-3, geometry.top),
    ARTIFACT_FIT_WIDTH / Math.max(1e-3, geometry.reach * 2),
  );
  const scale = Math.min(reference, contain);
  return { scale, height: geometry.top * scale, reach: geometry.reach * scale };
}
