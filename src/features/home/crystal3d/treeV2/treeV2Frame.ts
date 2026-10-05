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
  /** Одиниці моделі → сцени: з цим масштабом дерево малюється. */
  scale: number;
  /** Висота й розмах для кадру камери й розміру острова (без `TREE_EMPHASIS`). */
  height: number;
  reach: number;
  /**
   * Справжній розмах намальованого дерева в сцені: найдальша вершина листя
   * з `TREE_EMPHASIS`. Маси крони виходять за кластери, тож `crownRadius`
   * моделі його недооцінює. За ним камера тримає крону в кадрі.
   */
  drawnReach: number;
}

/**
 * Дерево більше в композиції на чверть (власник, 2026-10-05: «збільш
 * дерево на 20–30% у композиції»). Камера кадрує за висотою предмета, а
 * острів росте з його розмахом, тож просто більший масштаб лише відсунув би
 * камеру. Тому дерево МАЛЮЄТЬСЯ більшим, а кадр і острів рахуються з
 * масштабу без цього множника.
 */
export const TREE_EMPHASIS = 1.25;

export function treeV2Frame(geometry: TreeV2Geometry): TreeV2Frame {
  // Дерево референсу — головне в кадрі, над островом (ADR-0222): доросле
  // трохи вище за рамку артефакту, острів лишається спільного розміру.
  const reference = (ARTIFACT_FIT_HEIGHT * 1.45) / ADULT_HEIGHT;
  const contain = ARTIFACT_FIT_WIDTH / Math.max(1e-3, geometry.crownRadius * 2);
  const base = Math.min(reference, contain);
  // Камера кадрує з запасом (крона 12-річного дуба бере ~58% ширини кадру),
  // тож +25% лягають у кадр і для широкої крони.
  const scale = base * TREE_EMPHASIS;
  let leaves = 0;
  const p = geometry.leaves.positions;
  for (let i = 0; i < p.length; i += 3) leaves = Math.max(leaves, Math.hypot(p[i]!, p[i + 2]!));
  return {
    scale,
    height: geometry.height * base,
    reach: geometry.crownRadius * base,
    drawnReach: Math.max(geometry.crownRadius, leaves) * scale,
  };
}
