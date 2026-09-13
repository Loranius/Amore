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

  it('ранги ЧЕРЕЗ ОДИН теж ніколи не дають однаковий тон', () => {
    /*
     * Четверта поломка того самого ключа, і знайшов її кадр, а не тест
     * (ADR-0176). Ранги сусідні — коли око бачить кожну грань. Але там,
     * де кожна друга грань вузька, воно бачить кожну ДРУГУ, і в наборі з
     * чотирьох чергованих тонів пара через одну — це два світлі або два
     * темні: 16% і 13%.
     *
     * Виміряно: у вінці монарха (десять граней, велика й вузенька
     * навпереміш) прилад знаходив ОДНУ грань на 39 стовпців із
     * яскравістю 0.21–0.23, тоді як стовбур давав шість граней із
     * кроками 33–43%.
     */
    for (let rank = 0; rank < 40; rank += 1) {
      const here = facetTintForRank(CRYSTAL_FACET_TINTING, SEED, 'crystal:mother', rank);
      const after = facetTintForRank(CRYSTAL_FACET_TINTING, SEED, 'crystal:mother', rank + 2);
      expect(here.r, `ранги ${rank} і ${rank + 2}`).not.toBe(after.r);
    }
  });

  it('найслабша пара тонів різниться щонайменше на 30%', () => {
    // Поріг `amore-crystal-look` — про дві сусідні площини. Набір із трьох
    // означає, що ця перевірка покриває ВСІ пари, а не лише сусідні.
    const values = CRYSTAL_FACET_TINTING.tints.map((tint) => tint.r);
    for (let left = 0; left < values.length; left += 1) {
      for (let right = left + 1; right < values.length; right += 1) {
        const low = Math.min(values[left]!, values[right]!);
        const high = Math.max(values[left]!, values[right]!);
        expect((high - low) / high, `${low} проти ${high}`).toBeGreaterThanOrEqual(0.29);
      }
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
