import { seededUnit } from '../../growth/math';
import { stableHash32 } from '../../evolution';
import type { BarkReliefConfig } from './surfaceTypes';

/**
 * Why a trunk needs this at all.
 *
 * The sweep lays perfect circles along a curve, so every branch comes out a
 * lathe-turned dowel: the silhouette is two straight lines and the shading has
 * nothing to catch on. Flat shading used to hide that behind hard facets, and
 * the facets were the complaint — but turning them off left a rubber tube.
 * Neither is wood. A real trunk is irregular *in cross-section*: it is not a
 * circle that has been roughened, it is a lobed shape that swells and turns as
 * it rises.
 *
 * So the relief is geometry, not a texture. A texture would light correctly and
 * still leave a perfectly round outline, and the outline is what reads first at
 * portal distance.
 */

/** Angular lobes and axial swelling, both as a multiplier around 1. */
export interface BarkReliefSample {
  /** Radius multiplier at this angle and height. */
  radiusScale: number;
  /**
   * (∂r/∂θ) / r — how steeply the surface leans away from radial. The renderer
   * needs it to tilt the normal onto the lobed surface; without it the flutes
   * would show only on the silhouette and stay invisible in the shading.
   */
  angularSlope: number;
}

/** Deterministic per-branch phase, so two branches are not the same log. */
export function barkReliefPhase(branchId: string): number {
  return seededUnit(stableHash32(branchId), 'bark:phase') * Math.PI * 2;
}

/**
 * Lobes, not flutes.
 *
 * Three lobes with a fifth-order overtone, both spiralling with height, plus an
 * axial swelling that is uniform around the ring. The lobe count is bounded by
 * the ring: a ring of N vertices cannot describe more than about N/3 lobes
 * before they alias into a gear, and the trunk carries
 * `radialSegmentsByLod.medium` of them. Three primary lobes leave four samples
 * each even on the thinnest branch that still gets relief.
 *
 * `axial` is arc length in engine units, not a normalised fraction: measured in
 * fractions, a short twig would swell as many times as the whole trunk.
 */
export function barkRelief(
  angle: number,
  axial: number,
  radius: number,
  phase: number,
  config: BarkReliefConfig,
): BarkReliefSample {
  // Twigs stay smooth. Relief is a fraction of the radius, so on a 4mm branch
  // it is invisible anyway — but the normal tilt is not, and it would make thin
  // branches shimmer for no gain.
  const fade = Math.min(1, Math.max(0, radius / Math.max(1e-6, config.fadeRadius)));
  const depth = config.depth * fade * fade * (3 - 2 * fade);
  if (depth <= 0) return { radiusScale: 1, angularSlope: 0 };

  const primary = config.lobeCount * angle + config.twist * axial + phase;
  const overtone = config.overtoneCount * angle - config.twist * 0.6 * axial + phase * 1.7;
  const swell = config.swellFrequency * axial + phase * 0.6;

  // The swelling carries most of the weight, and that is a decision about
  // viewing distance rather than about wood. At portal size the trunk is about
  // sixty pixels wide: three lobes around it are a pixel and a half of shading
  // each and vanish, while a swelling changes the *outline* on both sides at
  // once and survives. The lobes stay because they break the outline's
  // symmetry as the tree turns — they are just not what does the reading.
  const shape =
    0.34 * Math.cos(primary)
    + 0.16 * Math.cos(overtone)
    + 0.5 * Math.cos(swell);
  const dShape =
    -0.34 * config.lobeCount * Math.sin(primary)
    - 0.16 * config.overtoneCount * Math.sin(overtone);

  const radiusScale = 1 + depth * shape;
  return {
    radiusScale,
    angularSlope: (depth * dShape) / Math.max(1e-6, radiusScale),
  };
}
