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
 * Чотири тони, і головне в них — ПОРЯДОК, а не значення.
 *
 * **Value only. Not one of them moves the hue.** The set this replaces pulled
 * one tone toward blue (`0.70 / 0.75 / 0.90`), one toward violet and one toward
 * warm pink — so two neighbouring faces of the same crystal were different
 * *colours*, which is what the brief forbids outright. The permitted difference
 * between faces is brightness of the one colour.
 *
 * Multipliers over the body's base colour, so the couple's earned tint
 * (ADR-0004) still decides what the crystal *is*; these decide only which of
 * its planes caught more of it.
 *
 * ЧОМУ ЦИКЛ ЧЕРГУЄТЬСЯ. Тони роздаються за РАНГОМ грані в колі
 * (`facetTintForRank`), тобто сусідні грані беруть сусідні позиції цього
 * масиву. Отже різниця між сусідами — це крок ЦИКЛУ, і слабкий крок
 * псує стільки ж, скільки збіг.
 *
 * Стояло `1.0 / 0.73 / 1.18 / 1.30`: кроки 27%, 62%, 10%, 23%. Два
 * світлі тони поспіль (1.18 → 1.30) давали чверть усіх сусідніх пар
 * різницю в десять відсотків — рівно ту, яку `amore-crystal-look`
 * називає «читається гладкою формою».
 *
 * Тепер темний і світлий чергуються, тож жодна пара сусідів не є двома
 * світлими або двома темними: кроки 30%, 68%, 34%, 29%. Середня
 * яскравість набору 0.965 — тіло від цього не темнішає.
 */
const CRYSTAL_FACET_TINTS: readonly CrystalRgb[] = [
  { r: 1.16, g: 1.16, b: 1.16 },
  { r: 0.68, g: 0.68, b: 0.68 },
  { r: 1.38, g: 1.38, b: 1.38 },
  { r: 0.78, g: 0.78, b: 0.78 },
];

/**
 * Ваги для СТАРОГО ключа (`facetTintFor`), який роздає тон за номером
 * трикутника.
 *
 * Тіло кристала ним більше не користується: відколи тон іде за рангом
 * грані в колі (ADR-0086), ваги не читаються взагалі, і всі чотири тони
 * трапляються однаково часто. Лишаються, бо ключ ще існує й ним міряють
 * підкладку, — але «рідкісний теплий блиск на шість відсотків» більше не
 * описує кристал, і тримати цей опис означало б брехати про поверхню.
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
/**
 * Тон грані за її РАНГОМ у колі — котра вона по порядку, якщо обійти тіло.
 *
 * Ранг рахує викликач (`facetColors`), бо лише він має нормалі. Сусідні за
 * напрямком грані мають сусідні ранги, тож не можуть дістати однаковий
 * тон — а саме це було зламане в усіх трьох попередніх ключах (ADR-0086):
 * зважений жереб по номеру давав 33% збігів, черга по номеру не знала, що
 * номери не йдуть по колу, а кошик фіксованої ширини за азимутом ділив
 * пояс із 23 гранями так, що сусідні ГОЛОВНІ грані падали в один тон.
 */
export function facetTintForRank(
  tinting: CrystalFacetTinting,
  artifactSeed: number,
  bodyId: string,
  rank: number,
): CrystalRgb {
  const tints = tinting.tints;
  if (tints.length === 0) return { r: 1, g: 1, b: 1 };
  if (tints.length === 1) return tints[0]!;

  const safe = Number.isFinite(rank) ? Math.abs(Math.trunc(rank)) : 0;
  // Зсув із насіння: малюнок лишається власним і незмінним (ADR-0004).
  const shift = Math.floor(seededUnit(artifactSeed, `facet-shift:${bodyId}`) * tints.length);
  return tints[(safe + shift) % tints.length]!;
}

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
