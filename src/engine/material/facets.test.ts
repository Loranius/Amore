import { describe, expect, it } from 'vitest';
import {
  CRYSTAL_FACET_TINTING,
  SUBSTRATE_FACET_TINTING,
  facetTintFor,
  facetTintingSignature,
} from './facets';
import type { CrystalFacetTinting } from './types';

const TINTINGS: readonly (readonly [string, CrystalFacetTinting])[] = [
  ['crystal', CRYSTAL_FACET_TINTING],
  ['substrate', SUBSTRATE_FACET_TINTING],
];

describe('per-face tone', () => {
  it('keeps every tone within a band that reads as one mineral', () => {
    // The band was ±12%, on the reasoning that past it a crystal stops looking
    // like one stone lit from several angles and starts looking like a mosaic
    // of tiles. Widened after two findings that arrived together.
    //
    // The tints were landing on triangles rather than on faces — the keying
    // still assumed the lathe's two-per-facet layout (ADR-0005 review) — so a
    // wide range really would have speckled a face rather than toned it, and
    // the narrow band was quietly compensating for a bug.
    //
    // And the three stylized gem assets the owner supplied put neighbouring
    // facets a long way apart: deep maroon beside bright pink, far past
    // anything lighting yields, painted into the albedo deliberately. With the
    // keying fixed, that separation is what the range is for.
    //
    // Still bounded, because the original reasoning holds at some width: no
    // tone may darken a face past a third or brighten it past a half, or the
    // couple's earned colour stops being one colour.
    for (const [name, tinting] of TINTINGS) {
      for (const tint of tinting.tints) {
        const brightness = (tint.r + tint.g + tint.b) / 3;
        expect(brightness, name).toBeGreaterThan(0.66);
        expect(brightness, name).toBeLessThan(1.5);
      }
      /*
       * НАБІР МУСИТЬ БУТИ НЕЙТРАЛЬНИМ У СЕРЕДНЬОМУ — ось що тут справді
       * стережеться: заслужений колір пари (ADR-0004) має ВАРІЮВАТИСЬ
       * навколо себе, а не зсуватись.
       *
       * Стояла інша умова: «один із тонів мусить дорівнювати 1.0». Вона
       * достатня, але не необхідна, і вона суперечить чергуванню
       * (ADR-0120): нейтральний тон стоїть між світлим і темним, тобто
       * власноруч робить один крок циклу слабким. Набір із середнім 1.0
       * дає те саме, чого вимагав старий припис, і не псує кроків.
       */
      const mean = tinting.tints.reduce(
        (total, tint) => total + (tint.r + tint.g + tint.b) / 3,
        0,
      ) / Math.max(1, tinting.tints.length);
      expect(mean, `${name} середнє`).toBeGreaterThan(0.97);
      expect(mean, `${name} середнє`).toBeLessThan(1.03);
    }
  });

  it('declares ascending weights that end at one', () => {
    for (const [name, tinting] of TINTINGS) {
      expect(tinting.cumulativeWeights, name).toHaveLength(tinting.tints.length);
      expect(tinting.cumulativeWeights.at(-1), name).toBe(1);
      for (let slot = 1; slot < tinting.cumulativeWeights.length; slot += 1) {
        expect(tinting.cumulativeWeights[slot]!).toBeGreaterThan(tinting.cumulativeWeights[slot - 1]!);
      }
    }
  });

  it('gives the same face the same tone every time it is drawn', () => {
    // A per-frame or per-mount choice would make the surface shimmer as if the
    // crystal were wet.
    for (let triangle = 0; triangle < 40; triangle += 1) {
      expect(facetTintFor(CRYSTAL_FACET_TINTING, 4242, 'crystal:mother', triangle))
        .toEqual(facetTintFor(CRYSTAL_FACET_TINTING, 4242, 'crystal:mother', triangle));
    }
  });

  it('gives neighbouring faces different tones often enough to read', () => {
    // The whole point: if a run of faces shares one tone, that run reads as one
    // smooth surface again and the geometry work is wasted.
    let changes = 0;
    let previous = facetTintFor(CRYSTAL_FACET_TINTING, 991, 'crystal:mother', 0);
    for (let triangle = 1; triangle < 200; triangle += 1) {
      const tint = facetTintFor(CRYSTAL_FACET_TINTING, 991, 'crystal:mother', triangle);
      if (tint !== previous) changes += 1;
      previous = tint;
    }

    expect(changes).toBeGreaterThan(100);
  });

  it('keeps the warm catch rare rather than every fourth face', () => {
    // An even split reads as a pattern; a few percent reads as light finding
    // one plane.
    const warm = CRYSTAL_FACET_TINTING.tints.at(-1)!;
    let hits = 0;
    const samples = 4000;
    for (let triangle = 0; triangle < samples; triangle += 1) {
      if (facetTintFor(CRYSTAL_FACET_TINTING, 7, 'crystal:mother', triangle) === warm) hits += 1;
    }

    const share = hits / samples;
    expect(share).toBeGreaterThan(0.02);
    expect(share).toBeLessThan(0.12);
  });

  it('gives two bodies different face patterns from the same seed', () => {
    // Otherwise every crystal in the druse would wear the same tone in the same
    // place, which reads as a decal rather than as mineral.
    let differences = 0;
    for (let triangle = 0; triangle < 100; triangle += 1) {
      const mother = facetTintFor(CRYSTAL_FACET_TINTING, 55, 'crystal:mother', triangle);
      const year = facetTintFor(CRYSTAL_FACET_TINTING, 55, 'crystal:year:1', triangle);
      if (mother !== year) differences += 1;
    }

    expect(differences).toBeGreaterThan(30);
  });

  it('survives a palette with nothing in it', () => {
    const empty: CrystalFacetTinting = { tints: [], cumulativeWeights: [] };
    expect(facetTintFor(empty, 1, 'body', 0)).toEqual({ r: 1, g: 1, b: 1 });
  });

  it('signs different palettes differently and identical ones alike', () => {
    expect(facetTintingSignature(CRYSTAL_FACET_TINTING))
      .toBe(facetTintingSignature(CRYSTAL_FACET_TINTING));
    expect(facetTintingSignature(CRYSTAL_FACET_TINTING))
      .not.toBe(facetTintingSignature(SUBSTRATE_FACET_TINTING));
  });
});
