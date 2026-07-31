import type { BufferAttribute } from 'three';
import type { ReefFoundationSurface } from '@/engine/species/reef';
import type { ReefPreviewBuild } from './buildReefPreview';
import type { ReefThreeSceneState } from './reefThreeAdapter';

export const REEF_FOUNDATION_PRESENTATION_VERSION = 'reef-foundation-v1';
export const REEF_FOUNDATION_PASS = 'phase-12-foundation-seafloor';

export const REEF_FOUNDATION_PROFILE = Object.freeze({
  primaryEdgeLobes: 3,
  secondaryEdgeLobes: 7,
  primaryEdgeAmplitude: 0.105,
  secondaryEdgeAmplitude: 0.046,
  asymmetricEdgeAmplitude: 0.038,
  bottomTaper: 0.95,
  topReliefRatio: 0.016,
  edgeShelfRatio: 0.014,
  edgeErosionRatio: 0.018,
  bottomDepthVariationRatio: 0.018,
  colonyBedLiftRatio: 0.009,
  colonyBedRadiusMultiplier: 1.65,
});

const TAU = Math.PI * 2;
const EPSILON = 1e-6;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp01((value - edge0) / Math.max(EPSILON, edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function mutableArray(attribute: BufferAttribute): Float32Array {
  return attribute.array as Float32Array;
}

function stablePhase(seed: number): number {
  let hash = (seed ^ 0x9e3779b9) >>> 0;
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b);
  hash ^= hash >>> 16;
  return (hash >>> 0) / 0xffffffff * TAU;
}

function maximumRadius(positions: Float32Array): number {
  let maximum = EPSILON;
  for (let offset = 0; offset < positions.length; offset += 3) {
    maximum = Math.max(
      maximum,
      Math.hypot(positions[offset] ?? 0, positions[offset + 2] ?? 0),
    );
  }
  return maximum;
}

function colonyBedLift(
  build: ReefPreviewBuild,
  x: number,
  z: number,
  maximumFoundationRadius: number,
): number {
  let lift = 0;
  for (const attachment of build.foundation.attachments) {
    const radius = Math.max(
      maximumFoundationRadius * 0.045,
      attachment.footprintRadius * REEF_FOUNDATION_PROFILE.colonyBedRadiusMultiplier,
    );
    const distance = Math.hypot(
      x - attachment.position.x,
      z - attachment.position.z,
    );
    if (distance >= radius) continue;
    const normalized = 1 - distance / radius;
    const influence = normalized * normalized * (3 - 2 * normalized);
    const targetLift = Math.min(
      maximumFoundationRadius * REEF_FOUNDATION_PROFILE.colonyBedLiftRatio,
      0.009 + attachment.targetHeight * 0.009,
    );
    lift = Math.max(lift, targetLift * influence);
  }
  return lift;
}

function radialSilhouetteScale(
  angle: number,
  radiusT: number,
  phase: number,
  surface: ReefFoundationSurface,
): number {
  const edge = smoothstep(0.58, 1, radiusT);
  const primary = Math.sin(
    angle * REEF_FOUNDATION_PROFILE.primaryEdgeLobes + phase,
  ) * REEF_FOUNDATION_PROFILE.primaryEdgeAmplitude;
  const secondary = Math.sin(
    angle * REEF_FOUNDATION_PROFILE.secondaryEdgeLobes - phase * 0.63,
  ) * REEF_FOUNDATION_PROFILE.secondaryEdgeAmplitude;
  const asymmetric = Math.cos(angle - phase * 0.35)
    * REEF_FOUNDATION_PROFILE.asymmetricEdgeAmplitude;
  const upperScale = 1 + edge * (primary + secondary + asymmetric);
  return surface === 'side'
    ? upperScale * REEF_FOUNDATION_PROFILE.bottomTaper
    : upperScale;
}

function topRelief(
  angle: number,
  radiusT: number,
  phase: number,
  maximumFoundationRadius: number,
): number {
  const unit = maximumFoundationRadius * REEF_FOUNDATION_PROFILE.topReliefRatio;
  const shelf = Math.sin(radiusT * Math.PI * 4.25 + phase * 0.72)
    * unit
    * (0.82 - radiusT * 0.24);
  const crossCurrent = Math.sin(angle * 2 - phase * 0.4)
    * unit
    * 0.48
    * smoothstep(0.12, 0.92, radiusT);
  const edgeShelf = Math.sin(angle * 5 + phase * 1.17)
    * maximumFoundationRadius
    * REEF_FOUNDATION_PROFILE.edgeShelfRatio
    * smoothstep(0.6, 1, radiusT);
  const edgeErosion = -maximumFoundationRadius
    * REEF_FOUNDATION_PROFILE.edgeErosionRatio
    * smoothstep(0.76, 1, radiusT)
    * (0.72 + Math.sin(angle * 3 - phase * 0.91) * 0.28);
  return shelf + crossCurrent + edgeShelf + edgeErosion;
}

/**
 * Phase 12 sculpts only the already published renderer foundation. It keeps
 * the accepted shell topology, indices, source vertices, attachments, colony
 * geometry, draw calls and materials unchanged.
 */
export function applyReefFoundationPresentation(
  scene: ReefThreeSceneState,
  build: ReefPreviewBuild,
): ReefThreeSceneState {
  const geometry = scene.foundation.geometry;
  if (
    geometry.userData.reefFoundationPresentationVersion
      === REEF_FOUNDATION_PRESENTATION_VERSION
  ) {
    return scene;
  }

  const positionAttribute = geometry.getAttribute('position') as BufferAttribute;
  const positions = mutableArray(positionAttribute);
  if (build.foundation.vertices.length * 3 !== positions.length) {
    throw new Error('Reef Phase 12 requires one source foundation vertex per rendered vertex.');
  }

  const radius = maximumRadius(positions);
  const phase = stablePhase(build.species.artifactSeed);

  build.foundation.vertices.forEach((sourceVertex, index) => {
    const offset = index * 3;
    const sourceX = positions[offset] ?? 0;
    const sourceY = positions[offset + 1] ?? 0;
    const sourceZ = positions[offset + 2] ?? 0;
    const sourceRadius = Math.hypot(sourceX, sourceZ);
    const radiusT = clamp01(sourceRadius / radius);
    const angle = sourceRadius <= EPSILON ? 0 : Math.atan2(sourceZ, sourceX);
    const radialScale = radialSilhouetteScale(
      angle,
      radiusT,
      phase,
      sourceVertex.surface,
    );

    positions[offset] = sourceX * radialScale;
    positions[offset + 2] = sourceZ * radialScale;

    if (sourceVertex.surface === 'top') {
      positions[offset + 1] = sourceY
        + topRelief(angle, radiusT, phase, radius)
        + colonyBedLift(build, sourceX, sourceZ, radius);
    } else if (sourceVertex.surface === 'side') {
      const depthVariation = Math.sin(angle * 4 - phase * 0.82)
        * radius
        * REEF_FOUNDATION_PROFILE.bottomDepthVariationRatio;
      positions[offset + 1] = sourceY - Math.abs(depthVariation) * 0.45 + depthVariation * 0.55;
    }
  });

  positionAttribute.needsUpdate = true;
  geometry.computeVertexNormals();
  const normalAttribute = geometry.getAttribute('normal') as BufferAttribute;
  normalAttribute.needsUpdate = true;
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.reefFoundationPresentationVersion = REEF_FOUNDATION_PRESENTATION_VERSION;
  geometry.userData.reefFoundationPass = REEF_FOUNDATION_PASS;
  geometry.userData.reefFoundationBottomTaper = REEF_FOUNDATION_PROFILE.bottomTaper;

  return scene;
}
