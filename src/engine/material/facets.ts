import { seededUnit } from '../growth/math';
import { round6 } from './color';
import type { CrystalFacetTinting, CrystalRgb } from './types';

/**
 * Per-face tone.
 *
 * With one colour across a whole body, two neighbouring facets differ only by
 * how much light each catches — and the portal's fill lighting made that
 * difference small enough to vanish. The crystal read as a smooth shape no
 * matter how well the geometry was faceted.
 *
 * These are **multipliers over the body's base colour**, not colours. That
 * matters twice over: the couple's earned tint (ADR-0004) still decides what
 * the crystal *is*, and because the variation rides in a vertex attribute
 * rather than in the material, bodies that share an optical signature still
 * share one draw call.
 *
 * Deliberately kept at every quality tier. On a weak phone iridescence and
 * procedural reflection are off, which is exactly when per-face tone is the
 * only thing left separating one facet from the next.
 */

/**
 * Four tones: the body's own, a cooler darker one, a lighter lavender, and a
 * rare warm catch.
 *
 * **Value only. Not one of them moves the hue.** The set this replaces pulled
 * one tone toward blue (`0.70 / 0.75 / 0.90`), one toward violet and one toward
 * warm pink — so two neighbouring faces of the same crystal were different
 * *colours*, which is what the brief forbids outright. The permitted difference
 * between faces is brightness of the one colour, and these are the brief's own
 * four steps: 0.73 dark, 1.0 neutral, 1.18 light, 1.30 for the rare catch.
 *
 * Multipliers over the body's base colour, so the couple's earned tint
 * (ADR-0004) still decides what the crystal *is*; these decide only which of
 * its planes caught more of it.
 */
const CRYSTAL_FACET_TINTS: readonly CrystalRgb[] = [
  { r: 1, g: 1, b: 1 },
  { r: 0.73, g: 0.73, b: 0.73 },
  { r: 1.18, g: 1.18, b: 1.18 },
  { r: 1.3, g: 1.3, b: 1.3 },
];

/**
 * The warm catch is rare on purpose. An even split makes every fourth face
 * pink, which reads as a pattern; at six percent it reads as a flash of light
 * finding one plane.
 */
const CRYSTAL_FACET_WEIGHTS: readonly number[] = [0.44, 0.74, 0.94, 1];

/**
 * The plate takes no per-face tone at all.
 *
 * Tint is keyed on a body's position in its ring, which for a crystal is one
 * face running the full height — exactly right. The plate is not a lathe with a
 * ring: its top is a disc of concentric rings, so the same key hands every
 * triangle in an angular sector the same tone at every radius, and the plate
 * came out as a starburst of light and dark wedges radiating from the monarch.
 *
 * It loses nothing. The plate's grain comes from the shader's inclusion term,
 * which is a 3D noise field and does not care about ring position.
 */
const SUBSTRATE_FACET_TINTS: readonly CrystalRgb[] = [{ r: 1, g: 1, b: 1 }];

const SUBSTRATE_FACET_WEIGHTS: readonly number[] = [1];

export const CRYSTAL_FACET_TINTING: CrystalFacetTinting = {
  tints: CRYSTAL_FACET_TINTS,
  cumulativeWeights: CRYSTAL_FACET_WEIGHTS,
};

export const SUBSTRATE_FACET_TINTING: CrystalFacetTinting = {
  tints: SUBSTRATE_FACET_TINTS,
  cumulativeWeights: SUBSTRATE_FACET_WEIGHTS,
};

/**
 * Which tone a given triangle takes.
 *
 * Pure and seeded, so the same couple's crystal has the same faces every time
 * it is drawn — a per-frame or per-mount choice would make the surface shimmer
 * as if it were wet.
 *
 * Lives here rather than in the renderer adapter because it is an optical
 * decision, and adapters do not make those. The renderer calls it once per
 * triangle while filling the colour attribute.
 */
export function facetTintFor(
  tinting: CrystalFacetTinting,
  artifactSeed: number,
  bodyId: string,
  triangleIndex: number,
): CrystalRgb {
  const tints = tinting.tints;
  if (tints.length === 0) return { r: 1, g: 1, b: 1 };

  const pick = seededUnit(artifactSeed, `facet-tint:${bodyId}:${triangleIndex}`);
  for (let slot = 0; slot < tints.length; slot += 1) {
    if (pick < (tinting.cumulativeWeights[slot] ?? 1)) return tints[slot]!;
  }
  return tints[tints.length - 1]!;
}

/** Signature fragment so two materials with different tones never share a batch. */
export function facetTintingSignature(tinting: CrystalFacetTinting): string {
  return tinting.tints
    .map((tint, slot) => [
      round6(tint.r),
      round6(tint.g),
      round6(tint.b),
      round6(tinting.cumulativeWeights[slot] ?? 1),
    ].join(','))
    .join(';');
}
