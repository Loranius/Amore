import { describe, expect, it } from 'vitest';
import { CRYSTAL_FACET_TINTING, facetTintForRank } from './facets';

// ============================================================
// Ключ, яким тон лягає на грань. Ламався ТРИЧІ, і жодного разу цього не
// помітив тест — саме тому він тепер є.
// ------------------------------------------------------------
//   1. зважений жереб по номеру грані: 33% сусідніх пар діставали один
//      тон, і вимкнення тонування цілком ПІДНІМАЛО розділення 15% → 17%;
//   2. черга `faceId % 4`: номери граней не йдуть по колу — грань 0
//      дивиться на 0°, грань 1 на −135°, сусідніх по колу 14 пар із 22;
//   3. кошик за азимутом шириною 360/ring.length: пояс має 23 грані разом
//      із фасками, тож сусідні ГОЛОВНІ грані падали в один тон.
//
// Спільне в усіх трьох — ключ не знав, ЩО СУСІДНЄ. Ранг знає: сусідні за
// напрямком грані одного поясу мають сусідні ранги (ADR-0087).
// ============================================================

const SEED = 987_654;

describe('тон грані береться рангом у колі', () => {
  it('сусідні ранги ніколи не дають однаковий тон', () => {
    for (let rank = 0; rank < 40; rank += 1) {
      const here = facetTintForRank(CRYSTAL_FACET_TINTING, SEED, 'crystal:mother', rank);
      const next = facetTintForRank(CRYSTAL_FACET_TINTING, SEED, 'crystal:mother', rank + 1);
      expect(here.r, `ранги ${rank} і ${rank + 1}`).not.toBe(next.r);
    }
  });

  it('той самий ранг завжди дає той самий тон', () => {
    // Детермінізм: артефакт пари не має мерехтіти між збірками.
    const first = facetTintForRank(CRYSTAL_FACET_TINTING, SEED, 'crystal:year:3', 7);
    const again = facetTintForRank(CRYSTAL_FACET_TINTING, SEED, 'crystal:year:3', 7);
    expect(again).toEqual(first);
  });

  it('різні пари дістають різний малюнок при тому самому ранзі', () => {
    /*
     * Зсув береться з насіння (ADR-0004): малюнок власний і незмінний.
     * Перевіряється не «завжди різний» — щаблів чотири, а насінь безліч, —
     * а що зсув узагалі працює: серед кількох насінь є хоча б два різні.
     */
    const tones = new Set(
      [1, 2, 3, 4, 5, 6, 7, 8].map(
        (seed) => facetTintForRank(CRYSTAL_FACET_TINTING, seed, 'crystal:mother', 0).r,
      ),
    );
    expect(tones.size).toBeGreaterThan(1);
  });

  it('порожня й одинична гами не падають', () => {
    const none = { tints: [], cumulativeWeights: [] };
    expect(facetTintForRank(none, SEED, 'x', 3)).toEqual({ r: 1, g: 1, b: 1 });
    const one = { tints: [{ r: 0.5, g: 0.5, b: 0.5 }], cumulativeWeights: [1] };
    expect(facetTintForRank(one, SEED, 'x', 3).r).toBe(0.5);
  });

  it('сміттєвий ранг не ламає тон', () => {
    // Ранг приходить із мапи, і `?? 0` там уже є; це друга лінія.
    expect(facetTintForRank(CRYSTAL_FACET_TINTING, SEED, 'x', Number.NaN).r)
      .toBeGreaterThan(0);
    expect(facetTintForRank(CRYSTAL_FACET_TINTING, SEED, 'x', -5).r).toBeGreaterThan(0);
  });
});
