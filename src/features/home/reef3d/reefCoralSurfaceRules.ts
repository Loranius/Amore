import * as THREE from 'three';

export const REEF_CORAL_SURFACE_RULES_VERSION = 'reef-coral-surface-rules-v1';
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

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function supportKind(mesh: THREE.Mesh): unknown {
  return mesh.userData.reefSupportSurfaceKind
    ?? mesh.geometry.userData.reefSupportSurfaceKind;
}

/**
 * Gives every support mesh a stable ecological role. Colony generation will
 * build on this taxonomy in later passes instead of treating every rock as the
 * same random scatter surface.
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

/**
 * Pure volcano rule used both by runtime raycasts and tests. The top quarter of
 * the cone is sterile, while the crater receives a wider radial exclusion zone.
 * Lower and middle slopes remain available for sparse colonies in later passes.
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
