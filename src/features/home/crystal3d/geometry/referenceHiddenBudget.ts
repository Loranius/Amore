// ============================================================
// referenceHiddenBudget — renderer-only бюджет прихованих тіл.
// ------------------------------------------------------------
// Базальна корона навмисно робить дрібні шпилі видимими. Для стабільного
// мобільного бюджету залишаємо логічні тіла у PublishedCrystal.bodies, але
// не публікуємо меші кількох найменших неакцентних листових супутників.
// Growth State, hostKey, стабільні ключі та attachment-граф не змінюються.
// ============================================================
import type * as THREE from 'three';
import type { ClusterBranch } from '../crystalCluster';

const MINIMUM_HIDDEN_BODIES = 4;

export interface ReferenceBudgetBody {
  readonly branch: ClusterBranch;
  readonly geometry: THREE.BufferGeometry;
}

const triangleCount = (body: ReferenceBudgetBody): number =>
  (body.geometry.getIndex()?.count ?? 0) / 3;

const bodyVolume = (body: ReferenceBudgetBody): number =>
  body.branch.height * body.branch.radiusBottom * body.branch.radiusBottom;

/**
 * Гарантує мінімальний renderer-budget без нових перетинів геометрії.
 * Кандидати вже мають побудовану/обрізану оболонку, тому ми відбираємо лише
 * реально видимі неакцентні тіла. Монарх, matrix, hero/dominant, базальна
 * акцентна фракція та господарі ВИДИМИХ дітей ніколи не відсікаються.
 */
export function enforceReferenceHiddenBudget(
  bodies: readonly ReferenceBudgetBody[],
  accentKeys: ReadonlySet<string>,
): void {
  if (!bodies.some((body) => body.branch.archetype === 'matrix')) return;

  const alreadyHidden = bodies.filter((body) => triangleCount(body) === 0).length;
  const missing = Math.max(0, MINIMUM_HIDDEN_BODIES - alreadyHidden);
  if (missing === 0) return;

  const visibleLoadBearing = new Set(
    bodies
      .filter((body) => triangleCount(body) > 0)
      .map((body) => body.branch.hostKey)
      .filter((key): key is string => key !== null),
  );

  const candidates = bodies
    .filter((body) => (
      triangleCount(body) > 0
      && !body.branch.primary
      && body.branch.archetype !== 'matrix'
      && body.branch.role !== 'dominant'
      && !accentKeys.has(body.branch.key)
      && !visibleLoadBearing.has(body.branch.key)
    ))
    .sort((left, right) => (
      bodyVolume(left) - bodyVolume(right)
      || left.branch.key.localeCompare(right.branch.key)
    ))
    .slice(0, missing);

  for (const body of candidates) {
    // Empty indexed geometry remains a valid logical PublishedBody, but it
    // cannot produce triangles, draw calls, shell violations or ray hits.
    body.geometry.setIndex([]);
  }
}
