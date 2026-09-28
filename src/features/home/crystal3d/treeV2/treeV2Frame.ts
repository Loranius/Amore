// ============================================================
// Дерево v2 у кадрі порталу (ADR-0218).
// ------------------------------------------------------------
// Масштаб СТАЛИЙ, як у кристала v2: доросле (40-річне) дерево заповнює
// кадр, молодше лишається пропорційно меншим — інакше кожне дерево було б
// одного розміру на екрані, і головне, що воно каже, — скільки ви разом, —
// зникло б. Дуже широка крона стискається до рамки, а не вилазить.
// ============================================================
import { ARTIFACT_FIT_HEIGHT, ARTIFACT_FIT_WIDTH } from '@/engine/renderer/three';
import type { TreeV2Geometry } from '@/engine/species/treeV2/geometry';

/** Висота дорослого дерева в одиницях моделі (`0.35 + 4.65 · 1`). */
const ADULT_HEIGHT = 5;

export interface TreeV2Frame {
  scale: number;
  height: number;
  reach: number;
}

export function treeV2Frame(geometry: TreeV2Geometry): TreeV2Frame {
  const reference = ARTIFACT_FIT_HEIGHT / ADULT_HEIGHT;
  const contain = ARTIFACT_FIT_WIDTH / Math.max(1e-3, geometry.crownRadius * 2);
  const scale = Math.min(reference, contain);
  return { scale, height: geometry.height * scale, reach: geometry.crownRadius * scale };
}
