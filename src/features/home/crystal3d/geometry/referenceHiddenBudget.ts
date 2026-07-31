// ============================================================
// referenceHiddenBudget — renderer-only бюджет прихованих тіл.
// ------------------------------------------------------------
// Базальна корона навмисно робить дрібні шпилі видимими. Для стабільного
// мобільного бюджету залишаємо логічні тіла у PublishedCrystal.bodies, але
// не публікуємо меші кількох найменших неакцентних листових тіл.
// Growth State, hostKey, стабільні ключі та attachment-граф не змінюються.
// ============================================================
import type * as THREE from 'three';
import type { ClusterBranch } from '../crystalCluster';

const DEFAULT_MINIMUM_HIDDEN_BODIES = 4;
const MAX_VISIBLE_SPECK_SHARE = 0.25;

export interface ReferenceBudgetBody {
  readonly branch: ClusterBranch;
  readonly geometry: THREE.BufferGeometry;
  readonly solid: {
    readonly profile: {
      readonly h: number;
      readonly r: number;
    };
  };
}

const triangleCount = (body: ReferenceBudgetBody): number =>
  (body.geometry.getIndex()?.count ?? 0) / 3;

const bodyVolume = (body: ReferenceBudgetBody): number =>
  body.branch.height * body.branch.radiusBottom * body.branch.radiusBottom;

function requiredSpeckCull(visibleCount: number, speckCount: number): number {
  if (visibleCount <= 0) return 0;
  const excess = speckCount - MAX_VISIBLE_SPECK_SHARE * visibleCount;
  if (excess <= 0) return 0;
  return Math.ceil(excess / (1 - MAX_VISIBLE_SPECK_SHARE) - 1e-9);
}

/**
 * Гарантує renderer-budget без нових перетинів геометрії.
 * `minimumHiddenBodies` може враховувати display-представлення, які
 * оживляють логічно прихований source key. `protectedKeys` не відсікаються:
 * їхній canonical mesh потрібен для shell/probe, навіть коли сам renderer
 * покаже контрольовану display-геометрію.
 */
export function enforceReferenceHiddenBudget(
  bodies: readonly ReferenceBudgetBody[],
  accentKeys: ReadonlySet<string>,
  minimumHiddenBodies = DEFAULT_MINIMUM_HIDDEN_BODIES,
  protectedKeys: ReadonlySet<string> = new Set(),
): void {
  if (!bodies.some((body) => body.branch.archetype === 'matrix')) return;

  const monarch = bodies.find((body) => body.branch.primary);
  if (monarch === undefined) return;
  const monarchRadius = monarch.solid.profile.r;

  const visible = bodies.filter((body) => triangleCount(body) > 0);
  const alreadyHidden = bodies.length - visible.length;
  const visibleSpecks = visible.filter((body) => (
    !body.branch.primary
    && body.branch.archetype !== 'matrix'
    && body.solid.profile.h < monarchRadius
  ));

  const hiddenMissing = Math.max(0, minimumHiddenBodies - alreadyHidden);
  const speckCull = requiredSpeckCull(visible.length, visibleSpecks.length);
  const targetCount = Math.max(hiddenMissing, speckCull);
  if (targetCount === 0) return;

  const visibleLoadBearing = new Set(
    visible
      .map((body) => body.branch.hostKey)
      .filter((key): key is string => key !== null),
  );

  const candidates = visible
    .filter((body) => {
      const protectedDominant = body.branch.role === 'dominant'
        && (body.branch.tier === 'support' || body.branch.emissive === true);
      return (
        !body.branch.primary
        && body.branch.archetype !== 'matrix'
        && !protectedDominant
        && !accentKeys.has(body.branch.key)
        && !protectedKeys.has(body.branch.key)
        && !visibleLoadBearing.has(body.branch.key)
      );
    })
    .sort((left, right) => {
      const leftSpeck = left.solid.profile.h < monarchRadius ? 0 : 1;
      const rightSpeck = right.solid.profile.h < monarchRadius ? 0 : 1;
      return (
        leftSpeck - rightSpeck
        || bodyVolume(left) - bodyVolume(right)
        || left.branch.key.localeCompare(right.branch.key)
      );
    })
    .slice(0, targetCount);

  for (const body of candidates) {
    body.geometry.setIndex([]);
  }
}
