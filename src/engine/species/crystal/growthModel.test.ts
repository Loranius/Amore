import { describe, expect, it } from 'vitest';
import { GROUND_LEAN_SCALE } from '../../growth';
import {
  CHILD_GROWTH_STEPS,
  CHILD_MIN_CLEARANCE,
  CHILD_MIN_UPWARD,
  CHILD_MONARCH_SHARE,
  CHILD_RING_CAPACITY,
  CHILD_TILT_MAX_DEG,
  CHILD_TILT_MIN_DEG,
  MONARCH_MAX_FACETS,
  MONARCH_MIN_FACETS,
  WISH_CHANNEL_CAP,
  anniversaryOn,
  childAzimuthRad,
  childDimensions,
  childDistance,
  childGrowthProgress,
  childRadialBias,
  childRingIndex,
  CONSISTENCY_WINDOW_MONTHS,
  consistency,
  facetThresholdForYears,
  groundSpread,
  PORTAL_MODULE_COUNT,
  yearActivity,
  yearFill,
  mediaSparkleCount,
  monarchAxialScale,
  monarchFacetCount,
  monarchRadialScale,
  relationshipYears,
  wishTint,
} from './growthModel';

const YEAR = 365;

describe('monarch height (ADR-0004)', () => {
  it('never stops growing, unlike the curve it replaces', () => {
    // The exponential it replaces saturated near five years: a twenty-year
    // couple and a ten-year couple rendered the same crystal. Every decade
    // must still be visibly taller than the one before it.
    const decades = [10, 20, 30, 40].map((y) => monarchAxialScale(y * YEAR));
    for (let index = 1; index < decades.length; index += 1) {
      expect(decades[index]!).toBeGreaterThan(decades[index - 1]!);
    }
  });

  it('decelerates hard so the monarch never becomes huge', () => {
    const ten = monarchAxialScale(10 * YEAR);
    const forty = monarchAxialScale(40 * YEAR);
    // Four times the relationship must not be anywhere near four times the
    // crystal — that was the owner's whole complaint about the old monarch.
    expect(forty / ten).toBeLessThan(1.5);
    expect(forty / ten).toBeGreaterThan(1.1);
  });

  it('stays modest at three years and barely moves by seven', () => {
    // The owner read a three-year monarch as already too big, and the seven
    // year projection as alarming. These bounds are that judgement written
    // down: the next few years must add very little.
    const threeAndAHalf = monarchAxialScale(3.6 * YEAR);
    const seven = monarchAxialScale(7 * YEAR);

    expect(threeAndAHalf).toBeLessThan(1);
    expect(seven / threeAndAHalf).toBeLessThan(1.25);
  });

  it('separates a young relationship from an old one', () => {
    expect(monarchAxialScale(YEAR)).toBeLessThan(monarchAxialScale(5 * YEAR));
    expect(monarchAxialScale(5 * YEAR)).toBeLessThan(monarchAxialScale(10 * YEAR));
  });

  it('survives a nonsense age', () => {
    for (const days of [0, -400, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(Number.isFinite(monarchAxialScale(days))).toBe(true);
      expect(monarchAxialScale(days)).toBeGreaterThan(0);
    }
  });
});

describe('monarch girth', () => {
  it('thickens with portal activity but only within the silhouette', () => {
    const axial = monarchAxialScale(3.6 * YEAR);
    const quiet = monarchRadialScale(axial, 0);
    const busy = monarchRadialScale(axial, 47);
    const extreme = monarchRadialScale(axial, 100_000);

    expect(busy).toBeGreaterThan(quiet);
    expect(extreme).toBeGreaterThan(busy);
    // Activity must never turn the spire into a block, nor a quiet couple's
    // crystal into a needle.
    // Tolerance covers the round6 quantisation of the published radius.
    expect(axial / (2 * extreme)).toBeGreaterThanOrEqual(3.8 - 1e-4);
    expect(axial / (2 * quiet)).toBeLessThanOrEqual(6.2 + 1e-4);
  });

  it('lands a typical couple near the silhouette the owner already accepted', () => {
    // The shipped monarch was about 4.6:1 and signed off at that shape.
    // 47 is the real couple's count of *deliberate* acts — plans, gifts,
    // places, milestones — not their 104 total events, since girth stopped
    // counting photos.
    const axial = monarchAxialScale(3.6 * YEAR);
    const aspect = axial / (2 * monarchRadialScale(axial, 47));
    expect(aspect).toBeGreaterThan(4.2);
    expect(aspect).toBeLessThan(5.4);
  });

  it('lets a longer relationship carry more girth at the same activity', () => {
    const young = monarchAxialScale(YEAR);
    const old = monarchAxialScale(20 * YEAR);
    expect(monarchRadialScale(old, 5_000)).toBeGreaterThan(monarchRadialScale(young, 5_000));
  });
});

describe('facets from photos', () => {
  it('charges each photo the threshold in force when it was taken', () => {
    expect(facetThresholdForYears(0)).toBe(5);
    expect(facetThresholdForYears(1)).toBe(10);
    expect(facetThresholdForYears(4)).toBe(10);
    expect(facetThresholdForYears(5)).toBe(15);
    expect(facetThresholdForYears(10)).toBe(20);
    expect(facetThresholdForYears(40)).toBe(20);
  });

  it('never loses a facet when the couple crosses a threshold', () => {
    // The regression this whole accumulator exists for. Dividing the current
    // photo count by the current threshold would take a couple with 100
    // photos from 20 facets to 10 the day they pass their first anniversary.
    const before = monarchFacetCount(new Array<number>(100).fill(0));
    const afterOneMorePhoto = monarchFacetCount([...new Array<number>(100).fill(0), 1]);

    expect(afterOneMorePhoto).toBeGreaterThanOrEqual(before);
  });

  it('is monotonic across any history', () => {
    const history = [0, 0, 0, 1, 1, 4, 5, 5, 9, 10, 12, 30];
    let previous = 0;
    for (let taken = 0; taken <= history.length; taken += 1) {
      const facets = monarchFacetCount(history.slice(0, taken));
      expect(facets).toBeGreaterThanOrEqual(previous);
      previous = facets;
    }
  });

  it('stays inside the range where the shape still reads as a crystal', () => {
    expect(monarchFacetCount([])).toBe(MONARCH_MIN_FACETS);
    expect(monarchFacetCount(new Array<number>(10_000).fill(0))).toBe(MONARCH_MAX_FACETS);
  });

  it('matches the owner-stated cost per tier', () => {
    // Five photos in year one buy exactly one facet; four do not.
    expect(monarchFacetCount(new Array<number>(4).fill(0))).toBe(MONARCH_MIN_FACETS);
    expect(monarchFacetCount(new Array<number>(5).fill(0))).toBe(MONARCH_MIN_FACETS + 1);
    // Ten photos in year three buy one; in year six they do not.
    expect(monarchFacetCount(new Array<number>(10).fill(3))).toBe(MONARCH_MIN_FACETS + 1);
    expect(monarchFacetCount(new Array<number>(10).fill(6))).toBe(MONARCH_MIN_FACETS);
  });
});

describe('relationship years', () => {
  it('gives one year per anniversary plus the one in progress', () => {
    // The real couple: started 2022-12-26, asked on 2026-08-02.
    const years = relationshipYears('2022-12-26', '2026-08-02', 'feb-28');
    expect(years).toHaveLength(4);
    expect(years[0]!.startsAt).toBe('2022-12-26');
    expect(years[3]!.startsAt).toBe('2025-12-26');
    expect(years.filter((year) => year.complete)).toHaveLength(3);
    expect(years[3]!.complete).toBe(false);
  });

  it('opens the next year exactly on the anniversary', () => {
    const before = relationshipYears('2022-12-26', '2025-12-25', 'feb-28');
    const on = relationshipYears('2022-12-26', '2025-12-26', 'feb-28');
    expect(before).toHaveLength(3);
    expect(on).toHaveLength(4);
    expect(on[2]!.complete).toBe(true);
  });

  it('always gives the couple at least the year they are living', () => {
    expect(relationshipYears('2026-08-01', '2026-08-02', 'feb-28')).toHaveLength(1);
    expect(relationshipYears('2026-08-02', '2026-08-02', 'feb-28')).toHaveLength(1);
  });

  it('honours the leap-day policy the rest of the engine uses', () => {
    expect(anniversaryOn('2020-02-29', 2023, 'feb-28')).toBe('2023-02-28');
    expect(anniversaryOn('2020-02-29', 2023, 'mar-1')).toBe('2023-03-01');
    expect(anniversaryOn('2020-02-29', 2024, 'feb-28')).toBe('2024-02-29');
  });

  it('returns nothing for an unusable start date instead of guessing', () => {
    expect(relationshipYears('not-a-date', '2026-08-02', 'feb-28')).toEqual([]);
  });
});

describe('child growth steps', () => {
  const year = { index: 3, startsAt: '2025-12-26', endsAt: '2026-12-26', complete: false };

  it('is born at one twelfth rather than at nothing', () => {
    expect(childGrowthProgress(year, '2025-12-26')).toBeCloseTo(1 / CHILD_GROWTH_STEPS, 6);
  });

  it('advances once a month, on the day of the month it was born', () => {
    expect(childGrowthProgress(year, '2026-01-25')).toBeCloseTo(1 / 12, 6);
    expect(childGrowthProgress(year, '2026-01-26')).toBeCloseTo(2 / 12, 6);
    expect(childGrowthProgress(year, '2026-08-02')).toBeCloseTo(8 / 12, 6);
  });

  it('is exactly full once the year has closed', () => {
    expect(childGrowthProgress({ ...year, complete: true }, '2026-12-26')).toBe(1);
  });

  it('never runs past full even on a late clock', () => {
    expect(childGrowthProgress(year, '2027-06-01')).toBeLessThanOrEqual(1);
  });
});

describe('child crystals', () => {
  it('never exceeds half the monarch it stands beside', () => {
    const monarch = monarchAxialScale(4 * YEAR);
    const child = childDimensions(monarch, yearFill(1, 1));
    // Tolerance is one round6 step: every published number is quantised to
    // six decimals, so an exact-equality bound would fail on the rounding.
    expect(child.axialScale).toBeLessThanOrEqual(monarch * CHILD_MONARCH_SHARE + 1e-6);
    expect(child.axialScale).toBeLessThan(monarch);
    expect(child.radialScale * 2).toBeLessThan(monarch);
  });

  it('grows with its months and with the year that fed it', () => {
    const monarch = monarchAxialScale(4 * YEAR);
    expect(childDimensions(monarch, yearFill(0.5, 1)).axialScale)
      .toBeGreaterThan(childDimensions(monarch, yearFill(0.25, 1)).axialScale);
    expect(childDimensions(monarch, yearFill(1, 1)).axialScale)
      .toBeGreaterThan(childDimensions(monarch, yearFill(1, 0)).axialScale);
  });

  it('lets a couple fill in a year they lived before joining the portal', () => {
    // The reason a closed year is not simply immutable. A couple three years
    // in, who only started logging recently, has to be able to go back and
    // put their first years in — and see those crystals answer.
    const monarch = monarchAxialScale(4 * YEAR);
    const empty = childDimensions(monarch, yearFill(1, 0));
    const filled = childDimensions(monarch, yearFill(1, 1));

    expect(filled.axialScale).toBeGreaterThan(empty.axialScale * 1.5);
  });

  it('scales the whole ring with the monarch rather than stranding old years', () => {
    // Measuring a year against the monarch as she was at its close made a
    // couple's first years permanently tiny however much they filled them in.
    const full = yearFill(1, 1);
    expect(childDimensions(monarchAxialScale(10 * YEAR), full).axialScale)
      .toBeGreaterThan(childDimensions(monarchAxialScale(YEAR), full).axialScale);
  });

  it('can never touch the monarch, whatever the year held', () => {
    const monarchRadial = monarchRadialScale(monarchAxialScale(10 * YEAR), 10_000);
    for (const events of [0, 1, 4, 40, 10_000]) {
      for (const ringIndex of [0, 1, 2]) {
        const child = childDimensions(monarchAxialScale(10 * YEAR), yearFill(1, 1));
        const distance = childDistance({
          monarchRadialScale: monarchRadial,
          childRadialScale: child.radialScale,
          ringIndex,
          importantEventCount: events,
        });
        const gap = distance - monarchRadial - child.radialScale;
        // Epsilon for the `round6` the published distance goes through, not
        // slack in the guarantee: the subtraction lands a unit in the last
        // place under the clearance, which is float noise and not contact.
        expect(gap).toBeGreaterThanOrEqual(CHILD_MIN_CLEARANCE - 1e-9);
      }
    }
  });

  it('leans every child 45–55° off the monarch`s axis, always outward', () => {
    // The requirement, stated as the three things that can go wrong: an angle
    // outside the band reads either as a standing pin or as a fallen crystal;
    // a lean toward the axis would drive the child into the monarch — which is
    // why the bias may never be negative and why the engine mixes it with the
    // child's own outward bearing rather than a free direction; and a bias
    // above 1 would be silently clamped, so the widest angle in the band has
    // to be reachable rather than merely requested.
    //
    // Measured off the *monarch*, not off the platform. The first pass stated
    // it against the platform, which put the crown 10° shallower than asked.
    for (const seed of [1, 7, 4242, 99_991, 0x7fff_ffff]) {
      const bias = childRadialBias(seed);
      expect(bias).toBeGreaterThan(0);
      expect(bias).toBeLessThanOrEqual(1);

      // Volume III's lean, reproduced: up·(1−lean) + out·lean, normalised.
      const lean = bias * GROUND_LEAN_SCALE;
      const abovePlatform = (Math.atan2(1 - lean, lean) * 180) / Math.PI;
      const offMonarch = 90 - abovePlatform;
      expect(offMonarch).toBeGreaterThanOrEqual(CHILD_TILT_MIN_DEG - 1e-6);
      expect(offMonarch).toBeLessThanOrEqual(CHILD_TILT_MAX_DEG + 1e-6);
      // And the floor the adapter hands the engine cannot stand that lean
      // back up: `ensureUpward` only intervenes below this.
      expect(Math.sin((abovePlatform * Math.PI) / 180))
        .toBeGreaterThanOrEqual(CHILD_MIN_UPWARD - 1e-6);
    }

    // Seeded, not constant: a colony of identically leaning siblings reads as
    // machined. And deterministic, like everything else here.
    const spread = new Set([1, 2, 3, 4, 5].map((seed) => childRadialBias(seed)));
    expect(spread.size).toBeGreaterThan(1);
    expect(childRadialBias(4242)).toBe(childRadialBias(4242));
  });

  it('draws closer with each important event', () => {
    const base = {
      monarchRadialScale: 0.15,
      childRadialScale: 0.08,
      ringIndex: 0,
    };
    const quiet = childDistance({ ...base, importantEventCount: 0 });
    const one = childDistance({ ...base, importantEventCount: 1 });
    const many = childDistance({ ...base, importantEventCount: 4 });

    expect(one).toBeLessThan(quiet);
    expect(many).toBeLessThan(one);
    // One event has to be worth seeing: the couple in question logs only
    // one or two calendar milestones a year, so a subtle step would read as
    // no step at all. A quarter of the reach — tighter again now that the
    // children lean outward and the whole ring was pulled in to match.
    expect(quiet - one).toBeGreaterThan(0.01);
    // Four events close the reach entirely and no more: the floor is the
    // arithmetic clearance, which no amount of activity may eat into.
    expect(many).toBeCloseTo(0.15 + 0.08 + CHILD_MIN_CLEARANCE, 6);
  });

  it('opens a new ring every eight years so no year is crowded out', () => {
    expect(childRingIndex(0)).toBe(0);
    expect(childRingIndex(CHILD_RING_CAPACITY - 1)).toBe(0);
    expect(childRingIndex(CHILD_RING_CAPACITY)).toBe(1);
    expect(childRingIndex(CHILD_RING_CAPACITY * 2)).toBe(2);

    const inner = childDistance({
      monarchRadialScale: 0.15, childRadialScale: 0.08, ringIndex: 0, importantEventCount: 2,
    });
    const outer = childDistance({
      monarchRadialScale: 0.15, childRadialScale: 0.08, ringIndex: 1, importantEventCount: 2,
    });
    expect(outer).toBeGreaterThan(inner);
  });

  it('never puts two years at the same bearing', () => {
    const seen = new Set<number>();
    for (let index = 0; index < 40; index += 1) {
      const azimuth = childAzimuthRad(index);
      expect(azimuth).toBeGreaterThanOrEqual(0);
      expect(azimuth).toBeLessThan(Math.PI * 2);
      seen.add(azimuth);
    }
    expect(seen.size).toBe(40);
  });
});

describe('colour from fulfilled wishes', () => {
  it('leaves a year with no gifts as the white crystal it was born', () => {
    const tint = wishTint({ forFirst: 0, shared: 0, forSecond: 0 });
    expect(tint.rgb).toEqual([1, 1, 1]);
    expect(tint.iridescence).toBe(0);
  });

  it('rewards a perfectly balanced year with rainbow, not grey', () => {
    // The reason this is not a literal RGB triple. Ten, ten and ten is the
    // best year a couple can have; mapped straight onto channels it would
    // render grey — the dullest crystal on the platform.
    const tint = wishTint({ forFirst: 10, shared: 10, forSecond: 10 });
    expect(tint.rgb[0]).toBeCloseTo(1, 6);
    expect(tint.rgb[1]).toBeCloseTo(1, 6);
    expect(tint.rgb[2]).toBeCloseTo(1, 6);
    expect(tint.iridescence).toBeCloseTo(1, 6);
  });

  it('tints toward the partner who was given to', () => {
    const red = wishTint({ forFirst: 10, shared: 0, forSecond: 0 });
    expect(red.rgb[0]).toBeGreaterThan(red.rgb[1]);
    expect(red.rgb[0]).toBeGreaterThan(red.rgb[2]);
    expect(red.iridescence).toBe(0);

    const blue = wishTint({ forFirst: 0, shared: 0, forSecond: 10 });
    expect(blue.rgb[2]).toBeGreaterThan(blue.rgb[0]);

    const green = wishTint({ forFirst: 0, shared: 10, forSecond: 0 });
    expect(green.rgb[1]).toBeGreaterThan(green.rgb[0]);
  });

  it('deepens with the count and then stops at the cap', () => {
    const few = wishTint({ forFirst: 2, shared: 0, forSecond: 0 });
    const many = wishTint({ forFirst: 9, shared: 0, forSecond: 0 });
    const capped = wishTint({ forFirst: WISH_CHANNEL_CAP, shared: 0, forSecond: 0 });
    const beyond = wishTint({ forFirst: 400, shared: 0, forSecond: 0 });

    expect(many.rgb[1]).toBeLessThan(few.rgb[1]);
    expect(beyond).toEqual(capped);
  });

  it('stays a translucent stone rather than stained glass', () => {
    // Even the most one-sided year keeps enough light in the other channels
    // to read as crystal.
    const extreme = wishTint({ forFirst: 10, shared: 0, forSecond: 0 });
    expect(Math.min(...extreme.rgb)).toBeGreaterThan(0.2);
  });

  it('produces finite colours for nonsense counts', () => {
    const tint = wishTint({ forFirst: Number.NaN, shared: -5, forSecond: Number.POSITIVE_INFINITY });
    expect(tint.rgb.every(Number.isFinite)).toBe(true);
    expect(Number.isFinite(tint.iridescence)).toBe(true);
  });
});

describe('sparkles from media', () => {
  it('always leaves some life around the artifact', () => {
    expect(mediaSparkleCount(0, 42)).toBe(6);
  });

  it('grows with what the couple finished, with diminishing returns', () => {
    expect(mediaSparkleCount(25, 128)).toBeLessThan(mediaSparkleCount(169, 128));
    expect(mediaSparkleCount(169, 128)).toBeLessThan(mediaSparkleCount(400, 128));

    // Diminishing returns means the same *number* of extra titles buys less
    // dust the more you already have — not that a larger multiple buys less,
    // which is a different (and false) claim.
    const earlyHundred = mediaSparkleCount(200, 128) - mediaSparkleCount(100, 128);
    const lateHundred = mediaSparkleCount(600, 128) - mediaSparkleCount(500, 128);
    expect(lateHundred).toBeLessThan(earlyHundred);
  });

  it('respects the device cap it is given', () => {
    expect(mediaSparkleCount(10_000, 18)).toBe(18);
    expect(mediaSparkleCount(10_000, 0)).toBe(0);
  });
});

describe('how lived-in a year was', () => {
  it('counts breadth across the portal above sheer volume', () => {
    // The defect this replaces. On a real couple's data, counting events made
    // a year of nothing but six photos rank *above* a year with a trip, an
    // anniversary and a photo — because volume is really a photo count, and
    // photos already drive the monarch's facets.
    const sixModulesFewEvents = yearActivity(6, 10);
    const oneModuleManyEvents = yearActivity(1, 60);

    expect(sixModulesFewEvents).toBeGreaterThan(oneModuleManyEvents);
  });

  it('separates a couple`s real years instead of bunching them', () => {
    // Measured: photos/places/calendar per year for the couple who prompted
    // this. The old formula put the three closed years inside nine percent of
    // each other, which is invisible on screen.
    const closed = [
      yearFill(1, yearActivity(3, 4)),
      yearFill(1, yearActivity(2, 2)),
      yearFill(1, yearActivity(1, 6)),
    ];
    const spread = Math.max(...closed) - Math.min(...closed);
    expect(spread).toBeGreaterThan(0.1);

    // And the fullest year is far clear of all of them.
    expect(yearFill(1, yearActivity(6, 80))).toBeGreaterThan(Math.max(...closed) * 1.5);
  });

  it('rises with either signal and never leaves 0..1', () => {
    expect(yearActivity(3, 10)).toBeGreaterThan(yearActivity(2, 10));
    expect(yearActivity(3, 20)).toBeGreaterThan(yearActivity(3, 10));
    expect(yearActivity(0, 0)).toBe(0);
    expect(yearActivity(PORTAL_MODULE_COUNT, 10_000)).toBeLessThanOrEqual(1);
    // More modules than exist cannot buy extra credit.
    expect(yearActivity(99, 10)).toBe(yearActivity(PORTAL_MODULE_COUNT, 10));
  });

  it('still gives an empty year something rather than nothing', () => {
    // A year the couple lived through is never a zero-height crystal, but it
    // must be clearly smaller than one they filled.
    const empty = yearFill(1, 0);
    expect(empty).toBeGreaterThan(0.2);
    expect(empty).toBeLessThan(yearFill(1, 1) * 0.4);
  });

  it('survives nonsense counts', () => {
    for (const value of [Number.NaN, -5, Number.POSITIVE_INFINITY]) {
      expect(Number.isFinite(yearActivity(value, 10))).toBe(true);
      expect(Number.isFinite(yearActivity(3, value))).toBe(true);
    }
  });
});

describe('ground spread from places visited', () => {
  it('widens the rock with travel and then levels off', () => {
    // The map was the second-largest module in a real couple's history and
    // drove nothing of its own; the substrate was derived purely from the
    // druse's footprint, so it carried no meaning.
    expect(groundSpread(0)).toBe(1);
    expect(groundSpread(26)).toBeGreaterThan(groundSpread(5));
    expect(groundSpread(200)).toBeGreaterThan(groundSpread(26));

    const earlyTen = groundSpread(20) - groundSpread(10);
    const lateTen = groundSpread(120) - groundSpread(110);
    expect(lateTen).toBeLessThan(earlyTen);
  });

  it('only ever widens, so it cannot uncover a buried base', () => {
    // ADR-0003 hides each crystal's base cap under the rock. A multiplier
    // below one could expose it, so the range is one and up by construction.
    for (const places of [0, 1, 26, 10_000, Number.NaN, -4, Number.POSITIVE_INFINITY]) {
      const spread = groundSpread(places);
      expect(spread).toBeGreaterThanOrEqual(1);
      expect(Number.isFinite(spread)).toBe(true);
    }
  });

  it('never grows the rock into a plate', () => {
    expect(groundSpread(Number.MAX_SAFE_INTEGER)).toBeLessThanOrEqual(1.5);
  });
});

describe('consistency', () => {
  it('rewards showing up regularly, not showing up hard once', () => {
    // The signal volume cannot express: forty photos in one weekend and
    // silence either side is not the same relationship with the portal as
    // something small most months.
    expect(consistency(10, 12)).toBeGreaterThan(consistency(1, 12));
    expect(consistency(12, 12)).toBe(1);
    expect(consistency(0, 12)).toBe(0);
  });

  it('judges a young couple on the months they have actually lived', () => {
    // Three months in, having shown up all three, is perfect attendance —
    // not a quarter of it.
    expect(consistency(3, 3)).toBe(1);
    expect(consistency(3, 12)).toBeLessThan(1);
  });

  it('cannot exceed one however the counts arrive', () => {
    expect(consistency(50, 12)).toBe(1);
    expect(consistency(5, 2)).toBe(1);
  });

  it('is zero before the couple has lived a month', () => {
    expect(consistency(0, 0)).toBe(0);
  });

  it('looks back over a bounded window rather than all history', () => {
    // Over a whole relationship this could only ever fall, which is decay by
    // another name — exactly what the artifact refuses to do.
    expect(CONSISTENCY_WINDOW_MONTHS).toBe(12);
    expect(consistency(12, 240)).toBe(1);
  });

  it('survives nonsense counts', () => {
    for (const value of [Number.NaN, -3, Number.POSITIVE_INFINITY]) {
      expect(Number.isFinite(consistency(value, 12))).toBe(true);
      expect(Number.isFinite(consistency(6, value))).toBe(true);
    }
  });
});
