import * as THREE from 'three';
import type { ReefColonyMorphotype } from '@/engine/species/reef';

export const REEF_CORAL_SURFACE_RULES_VERSION = 'reef-coral-surface-rules-v1';
export const REEF_CORAL_SURFACE_COLONIZATION_VERSION = 'reef-coral-surface-colonization-v1';
export const VOLCANO_CORAL_SUMMIT_NO_GROW_RATIO = 0.72;
export const VOLCANO_CORAL_CRATER_MIN_HEIGHT_RATIO = 0.5;
export const VOLCANO_CORAL_CRATER_RADIUS_RATIO = 0.23;

export type ReefCoralSurfaceType = 'terrace' | 'volcano' | 'arch' | 'rock' | 'unknown';
export type ReefCoralSurfaceRejectionReason = 'volcano-summit' | 'volcano-crater';

export interface ReefCoralSurfaceAssessment {
  allowed: boolean;
  surfaceType: ReefCoralSurfaceType;
  reason?: ReefCoralSurfaceRejectionReason;
  heightRatio?: number;
  radialRatio?: number;
}

export interface ReefVolcanoCoralEnvelope {
  minY: number;
  maxY: number;
  maxRadius: number;
  craterRadius?: number;
}

export interface ReefCoralSurfaceColonizationPolicy {
  /** Smallest upward component accepted for a support face. */
  minNormalY: number;
  /** Maximum local height discontinuity tolerated across the colony footprint. */
  maxHeightDelta: number;
  /** Relative ecological affinity. Zero means the morphotype never colonizes this surface. */
  morphotypeWeight: Readonly<Record<ReefColonyMorphotype, number>>;
}

const SURFACE_COLONIZATION: Readonly<Record<
  ReefCoralSurfaceType,
  ReefCoralSurfaceColonizationPolicy
>> = {
  terrace: {
    minNormalY: 0.72,
    maxHeightDelta: 0.16,
    morphotypeWeight: {
      branching: 1,
      massive: 0.95,
      plating: 0.92,
      encrusting: 1,
      'soft-coral': 0.82,
      'sea-fan': 0.68,
    },
  },
  volcano: {
    // Lower basalt slopes are deliberately sparse pioneer habitat. The crater
    // and summit are still rejected separately by assessVolcanoCoralLocalPoint.
    minNormalY: 0.46,
    maxHeightDelta: 0.22,
    morphotypeWeight: {
      branching: 0,
      massive: 0.28,
      plating: 0.2,
      encrusting: 0.5,
      'soft-coral': 0.08,
      'sea-fan': 0,
    },
  },
  arch: {
    // Eroded limestone crowns favour light, attached forms over bulky colonies.
    minNormalY: 0.28,
    maxHeightDelta: 0.3,
    morphotypeWeight: {
      branching: 0.18,
      massive: 0.1,
      plating: 0.28,
      encrusting: 0.58,
      'soft-coral': 0.56,
      'sea-fan': 0.72,
    },
  },
  rock: {
    minNormalY: 0.52,
    maxHeightDelta: 0.22,
    morphotypeWeight: {
      branching: 0.58,
      massive: 0.72,
      plating: 0.44,
      encrusting: 0.82,
      'soft-coral': 0.62,
      'sea-fan': 0.56,
    },
  },
  unknown: {
    minNormalY: 0.68,
    maxHeightDelta: 0.16,
    morphotypeWeight: {
      branching: 0.12,
      massive: 0.12,
      plating: 0.12,
      encrusting: 0.12,
      'soft-coral': 0.12,
      'sea-fan': 0.12,
    },
  },
};

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function stableUnit(seed: number, label: string): number {
  let hash = (seed ^ 0x9e3779b9) >>> 0;
  for (let index = 0; index < label.length; index += 1) {
    hash ^= label.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  return (hash >>> 0) / 0xffffffff;
}

function supportKind(mesh: THREE.Mesh): unknown {
  return mesh.userData.reefSupportSurfaceKind
    ?? mesh.geometry.userData.reefSupportSurfaceKind;
}

/**
 * Gives every support mesh a stable ecological role. Colony generation will
 * build on this taxonomy instead of treating every rock as the same surface.
 */
export function classifyReefCoralSurface(mesh: THREE.Mesh): ReefCoralSurfaceType {
  const kind = supportKind(mesh);

  if (kind === 'volcano' || mesh.userData.reefVolcano === true) return 'volcano';
  if (
    kind === 'arch'
    || typeof mesh.geometry.userData.reefSourceArchId === 'string'
  ) return 'arch';
  if (
    kind === 'terrace'
    || mesh.name === 'reef-terraced-foundation'
    || mesh.name.startsWith('reef:growth-zone:')
  ) return 'terrace';
  if (
    kind === 'rock'
    || mesh.userData.reefSupportSurface === true
    || mesh.geometry.userData.reefSupportSurface === true
  ) return 'rock';

  return 'unknown';
}

export function reefCoralSurfaceColonizationPolicy(
  surfaceType: ReefCoralSurfaceType,
): ReefCoralSurfaceColonizationPolicy {
  return SURFACE_COLONIZATION[surfaceType];
}

export function reefCoralMorphotypeCanColonizeSurface(
  morphotype: ReefColonyMorphotype,
  surfaceType: ReefCoralSurfaceType,
): boolean {
  return SURFACE_COLONIZATION[surfaceType].morphotypeWeight[morphotype] > 0;
}

/**
 * Chooses one preferred habitat deterministically from the surfaces that exist
 * in the current scene. Weights are ecological affinities, so the result creates
 * dense generalist terraces, sparse pioneer volcano colonies and light arch life
 * without changing identity when the app reloads.
 */
export function chooseReefCoralPreferredSurface({
  seed,
  morphotype,
  availableSurfaceTypes,
}: {
  seed: number;
  morphotype: ReefColonyMorphotype;
  availableSurfaceTypes: readonly ReefCoralSurfaceType[];
}): ReefCoralSurfaceType | null {
  const unique = Array.from(new Set(availableSurfaceTypes));
  const weighted = unique
    .map((surfaceType) => ({
      surfaceType,
      weight: SURFACE_COLONIZATION[surfaceType].morphotypeWeight[morphotype],
    }))
    .filter((entry) => entry.weight > 0);
  if (weighted.length === 0) return unique[0] ?? null;

  const totalWeight = weighted.reduce((total, entry) => total + entry.weight, 0);
  let cursor = stableUnit(seed, `reef:coral-habitat:${morphotype}`) * totalWeight;
  for (const entry of weighted) {
    cursor -= entry.weight;
    if (cursor <= 0) return entry.surfaceType;
  }
  return weighted[weighted.length - 1]?.surfaceType ?? null;
}

/**
 * Pure volcano rule used both by runtime raycasts and tests. The top quarter of
 * the cone is sterile, while the crater receives a wider radial exclusion zone.
 * Lower and middle slopes remain available for sparse pioneer colonies.
 */
export function assessVolcanoCoralLocalPoint(
  point: Pick<THREE.Vector3, 'x' | 'y' | 'z'>,
  envelope: ReefVolcanoCoralEnvelope,
): ReefCoralSurfaceAssessment {
  const height = Math.max(1e-6, envelope.maxY - envelope.minY);
  const maxRadius = Math.max(1e-6, envelope.maxRadius);
  const heightRatio = clamp01((point.y - envelope.minY) / height);
  const radialRatio = Math.hypot(point.x, point.z) / maxRadius;

  if (heightRatio >= VOLCANO_CORAL_SUMMIT_NO_GROW_RATIO) {
    return {
      allowed: false,
      surfaceType: 'volcano',
      reason: 'volcano-summit',
      heightRatio,
      radialRatio,
    };
  }

  const craterRadius = finite(envelope.craterRadius) && envelope.craterRadius > 0
    ? envelope.craterRadius
    : maxRadius * (VOLCANO_CORAL_CRATER_RADIUS_RATIO / 1.5);
  const craterNoGrowRadius = craterRadius * 1.5;
  if (
    heightRatio >= VOLCANO_CORAL_CRATER_MIN_HEIGHT_RATIO
    && Math.hypot(point.x, point.z) <= craterNoGrowRadius
  ) {
    return {
      allowed: false,
      surfaceType: 'volcano',
      reason: 'volcano-crater',
      heightRatio,
      radialRatio,
    };
  }

  return {
    allowed: true,
    surfaceType: 'volcano',
    heightRatio,
    radialRatio,
  };
}

function volcanoEnvelope(mesh: THREE.Mesh): ReefVolcanoCoralEnvelope {
  const geometry = mesh.geometry;
  geometry.computeBoundingBox();
  const box = geometry.boundingBox ?? new THREE.Box3(
    new THREE.Vector3(-1, -1, -1),
    new THREE.Vector3(1, 1, 1),
  );
  const positions = geometry.getAttribute('position');
  let maxRadius = 1e-6;

  if (positions) {
    for (let index = 0; index < positions.count; index += 1) {
      maxRadius = Math.max(
        maxRadius,
        Math.hypot(positions.getX(index), positions.getZ(index)),
      );
    }
  }

  const metadataCraterRadius = geometry.userData.reefVolcanoCraterRadius
    ?? mesh.userData.reefVolcanoCraterRadius;

  return {
    minY: box.min.y,
    maxY: box.max.y,
    maxRadius,
    ...(finite(metadataCraterRadius) && metadataCraterRadius > 0
      ? { craterRadius: metadataCraterRadius }
      : {}),
  };
}

/**
 * Runtime gate for coral terrain placement. World-space hits are converted into
 * the support mesh's local coordinates, so the rule keeps working when the
 * volcano is moved deeper into the scene or rotated later.
 */
export function assessReefCoralSupportHit(
  hit: THREE.Intersection,
): ReefCoralSurfaceAssessment {
  if (!(hit.object instanceof THREE.Mesh)) {
    return { allowed: true, surfaceType: 'unknown' };
  }

  const mesh = hit.object;
  const surfaceType = classifyReefCoralSurface(mesh);
  if (surfaceType !== 'volcano') return { allowed: true, surfaceType };

  mesh.updateWorldMatrix(true, false);
  const localPoint = mesh.worldToLocal(hit.point.clone());
  return assessVolcanoCoralLocalPoint(localPoint, volcanoEnvelope(mesh));
}
