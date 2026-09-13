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
 * ТРИ тони, і головне в них — що РІЗНЯТЬСЯ ВСІ ПАРИ, а не лише сусідні.
 *
 * Multipliers over the body's base colour, so the couple's earned tint
 * (ADR-0004) still decides what the crystal *is*; these decide only which of
 * its planes caught more of it. **Value only. Not one of them moves the hue.**
 * The set this replaces pulled one tone toward blue, one toward violet and one
 * toward warm pink — two neighbouring faces of the same crystal were different
 * *colours*, which is what the brief forbids outright.
 *
 * ЧОМУ ТРИ, А НЕ ЧОТИРИ (ADR-0176). Стояло чотири з чергуванням
 * світлий/темний — `1.16 / 0.68 / 1.38 / 0.78`. Кроки СУСІДІВ виходили
 * чудові (41%, 51%, 43%, 33%), і саме їх ADR-0120 і міряв. Але в четвірці
 * є друга відстань: пари ЧЕРЕЗ ОДНУ, тобто (0,2) і (1,3). У чергуванні це
 * два світлі тони й два темні: `1.16` проти `1.38` — 16%, `0.68` проти
 * `0.78` — 13%. Тобто «читається гладкою формою».
 *
 * Це не теорія. Вінець монарха має десять граней, у яких велика й
 * вузенька йдуть навпереміш (6–8 трикутників проти 1–3), тож ОКО БАЧИТЬ
 * КОЖНУ ДРУГУ — рівно ту пару через одну. Виміряно на живому кадрі:
 * прилад знаходив у вінці ОДНУ грань на 39 стовпців, яскравість
 * 0.21–0.23 без жодного кроку, тоді як на стовбурі — шість граней із
 * кроками 33–43%. Проба дикими тонами (0.2 проти 2.0) лишала вінець
 * так само рівним, бо при двох тонах усі непарні ранги — це один тон.
 *
 * У трійці другої відстані НЕМАЄ: на колі з трьох пари через одну — це ті
 * самі пари, що й сусідні. Тому досить, щоб різнились усі три, і жоден
 * крок ока — ані «кожну», ані «кожну другу» — не може впасти в збіг.
 *
 * ЧОМУ САМЕ ЦІ ЧИСЛА, І ЧОМУ ЇХ НЕ МОЖЕ БУТИ ЧОТИРИ. Драбина 0.68 →
 * 0.975 → 1.4 з відношенням 1.435: кроки 30%, 30% і 51% між крайніми,
 * середнє 1.02.
 * Обидві межі задані не тут: `facets.test.ts` тримає коридор 0.66…1.5
 * («жоден тон не темнить грань більше ніж на третину й не світлить
 * більше ніж наполовину, інакше заслужений колір перестає бути одним
 * кольором») і вимагає середнє 0.97…1.03.
 *
 * Чотири значення, попарно різні на 30%, у цей коридор НЕ ВМІЩАЮТЬСЯ:
 * для цього потрібне відношення 1.43³ = 2.92, а коридор дає 2.27. Тобто
 * трійка — не смак, а єдине, що можливо, якщо кожна пара має різнитись.
 *
 * Рівнем нутра завідує `interiorLevel` (ADR-0175), і це навмисно два
 * різні числа: тут — варіація навколо заслуженого кольору, там — висота,
 * на якій тіло сидить на кривій тонування.
 */
const CRYSTAL_FACET_TINTS: readonly CrystalRgb[] = [
  { r: 0.68, g: 0.68, b: 0.68 },
  { r: 0.975, g: 0.975, b: 0.975 },
  { r: 1.4, g: 1.4, b: 1.4 },
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
const CRYSTAL_FACET_WEIGHTS: readonly number[] = [0.44, 0.94, 1];

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
