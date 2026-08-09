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
  MONARCH_FULL_TERM_YEARS,
  MONARCH_MAX_FACETS,
  MONARCH_MIN_FACETS,
  WISH_CHANNEL_CAP,
  WISH_TOTAL_CAP,
  anniversaryOn,
  childAzimuthRad,
  childDimensions,
  childClearance,
  childDistance,
  skirtDistance,
  childGrowthProgress,
  childRadialBias,
  childRingIndex,
  childRingStep,
  ringSeatingRadius,
  CONSISTENCY_WINDOW_MONTHS,
  consistency,
  facetThresholdForYears,
  groundSpread,
  PORTAL_MODULE_COUNT,
  SHARED_DAYS_OFF_FULL_YEAR,
  yearActivity,
  yearFill,
  yearTogetherness,
  mediaSparkleCount,
  monarchAxialScale,
  monarchFacetCount,
  monarchRadialScale,
  relationshipYears,
  veteranGirth,
  wishTint,
} from './growthModel';

const YEAR = 365;

describe('monarch height (ADR-0004)', () => {
  it('grows to its full height over thirty years and then stops', () => {
    // The owner's rule, and it replaces the previous one outright. The curve
    // before this was `0.42 + 0.3·ln(1 + years)`, which never stopped — and the
    // test here required every decade to be taller than the last, for a good
    // reason at the time: the exponential *it* replaced saturated at five years
    // and rendered a twenty-year couple the same as a ten-year one.
    //
    // Both of those readings are now superseded. Height answers "how long have
    // we been together" over a term the owner set at thirty years; past it the
    // history goes into girth and new faces instead (`veteranGirth`,
    // `monarchFacetCount`), so the artifact keeps changing without the one
    // dimension that has to be framed growing without bound.
    for (const years of [1, 3, 7, 12, 20, 29]) {
      expect(monarchAxialScale(years * YEAR))
        .toBeLessThan(monarchAxialScale((years + 1) * YEAR));
    }
    const full = monarchAxialScale(MONARCH_FULL_TERM_YEARS * YEAR);
    expect(monarchAxialScale(40 * YEAR)).toBe(full);
    expect(monarchAxialScale(80 * YEAR)).toBe(full);
  });

  it('starts small on the first day', () => {
    // A couple on day one has a crystal, not a promise of one — but a fifth of
    // the full height, not a third. The old curve began at 0.42 against a full
    // height of 1.4, so a relationship one day old was already 30% grown.
    const first = monarchAxialScale(0);
    const full = monarchAxialScale(MONARCH_FULL_TERM_YEARS * YEAR);
    expect(first / full).toBeGreaterThan(0.15);
    expect(first / full).toBeLessThan(0.25);
  });

  it('is well under half grown at three years', () => {
    // The complaint this pass answers, written as a number: the owner read a
    // three-year monarch as too big. On the old curve it stood at 60% of the
    // full height with twenty-seven years still to come.
    const three = monarchAxialScale(3 * YEAR);
    const full = monarchAxialScale(MONARCH_FULL_TERM_YEARS * YEAR);
    expect(three / full).toBeGreaterThan(0.28);
    expect(three / full).toBeLessThan(0.4);
  });

  it('still moves fastest in the years a young couple is living', () => {
    // Starting low is only worth it if the early years feel like they count.
    // Day one to three years has to be the biggest proportional gain in the
    // whole term, or the artifact says nothing to the couples most likely to be
    // looking at it.
    const gain = (from: number, to: number) =>
      monarchAxialScale(to * YEAR) / monarchAxialScale(from * YEAR);
    expect(gain(0, 3)).toBeGreaterThan(gain(10, 13));
    expect(gain(10, 13)).toBeGreaterThan(gain(25, 28));
  });

  it('separates a young relationship from an old one', () => {
    expect(monarchAxialScale(YEAR)).toBeLessThan(monarchAxialScale(5 * YEAR));
    expect(monarchAxialScale(5 * YEAR)).toBeLessThan(monarchAxialScale(10 * YEAR));
  });

  it('puts a veteran relationship into girth and faces instead', () => {
    // What replaces the height once it has stopped. Both only ever grow, so
    // neither can take back something the couple already had.
    expect(veteranGirth(10 * YEAR)).toBe(1);
    expect(veteranGirth(MONARCH_FULL_TERM_YEARS * YEAR)).toBe(1);
    expect(veteranGirth(40 * YEAR)).toBeGreaterThan(1);
    expect(veteranGirth(60 * YEAR)).toBeGreaterThan(veteranGirth(40 * YEAR));
    // Stouter, never a boulder: the curve saturates.
    expect(veteranGirth(200 * YEAR)).toBeLessThan(1.4);

    // One face every five years past the term, on top of whatever the photos
    // earned — so a fortieth year does not look exactly like a thirtieth.
    const photos: number[] = [];
    expect(monarchFacetCount(photos, MONARCH_FULL_TERM_YEARS * YEAR))
      .toBe(monarchFacetCount(photos, 10 * YEAR));
    expect(monarchFacetCount(photos, 40 * YEAR))
      .toBeGreaterThan(monarchFacetCount(photos, MONARCH_FULL_TERM_YEARS * YEAR));
    expect(monarchFacetCount(photos, 200 * YEAR)).toBeLessThanOrEqual(MONARCH_MAX_FACETS);
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

  it('can never touch the monarch, at any age or ring', () => {
    // ADR-0016 brought the ring in until the bases share one node of quartz,
    // so the floor is now the *only* thing between the two surfaces — there is
    // no activity term left to absorb an error in it. Checked across ages
    // because both radii move with the monarch and the floor has to survive
    // their ratio changing, not just one couple's numbers.
    for (const years of [0, 1, 3, 10, 30, 60]) {
      const monarchAxial = monarchAxialScale(years * YEAR);
      const monarchRadial = monarchRadialScale(monarchAxial, 10_000);
      for (const ringIndex of [0, 1, 2]) {
        const child = childDimensions(monarchAxial, yearFill(1, 1));
        const distance = childDistance({
          monarchRadialScale: monarchRadial,
          childRadialScale: child.radialScale,
          widestChildRadialScale: child.radialScale,
          ringIndex,
          ringOccupancy: 1,
        });
        const gap = distance - monarchRadial - child.radialScale;
        // Epsilon for the `round6` the published distance goes through, not
        // slack in the guarantee: the subtraction lands a unit in the last
        // place under the clearance, which is float noise and not contact.
        expect(gap, `${years}y ring ${ringIndex}`)
          .toBeGreaterThanOrEqual(childClearance(monarchRadial, child.radialScale) - 1e-9);
        // And never below the absolute floor, whatever the radii do.
        expect(gap, `${years}y ring ${ringIndex}`)
          .toBeGreaterThanOrEqual(CHILD_MIN_CLEARANCE - 1e-9);
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

  it('stands every child at the floor and nowhere else (ADR-0016)', () => {
    // This replaces "draws closer with each important event". That mechanism
    // added a standoff a busy year could close but never cross — a crystal
    // reaching for a monarch it could not join — and the owner named it as the
    // thing keeping the colony from growing out of one vein. What a year did
    // with itself now shows in its size, facets and fill; where it stands is
    // fixed, and it is as close as the geometry allows.
    const base = {
      monarchRadialScale: 0.15,
      childRadialScale: 0.08,
      widestChildRadialScale: 0.08,
      ringOccupancy: 1,
    };

    expect(childDistance({ ...base, ringIndex: 0 }))
      .toBeCloseTo(0.15 + 0.08 + childClearance(0.15, 0.08), 6);
    // And the floor is genuinely tight: the air between the two surfaces is a
    // fraction of the child's own width, not a multiple of it. At 0.055 it was
    // 0.080 against a child 0.040 across — two of its own widths of nothing.
    expect(CHILD_MIN_CLEARANCE).toBeLessThan(0.08 * 0.5);
  });

  it('keeps the skirt outside every ring of years, not only the first', () => {
    // The fixed 0.24 this replaces crossed the year ring in both directions:
    // outside it at four years, inside it at twenty-five. Then the first fix
    // cleared only ring 0, which a nine-year couple already outgrows — the
    // sweep put ring 1 a full 0.032 *inside* its own hem.
    for (const years of [1, 4, 9, 25, 60]) {
      const monarchAxial = monarchAxialScale(years * YEAR);
      const monarchRadial = monarchRadialScale(monarchAxial, 200);
      const widest = childDimensions(monarchAxial, 1).radialScale;
      const skirtRadial = 0.14 * 0.3;
      const outermostRingIndex = childRingIndex(Math.max(0, years - 1));

      const occupancy = Math.max(1, years - outermostRingIndex * CHILD_RING_CAPACITY);
      const ring = childDistance({
        monarchRadialScale: monarchRadial,
        childRadialScale: widest,
        widestChildRadialScale: widest,
        ringIndex: outermostRingIndex,
        ringOccupancy: occupancy,
      });
      const skirt = skirtDistance({
        monarchRadialScale: monarchRadial,
        widestChildRadialScale: widest,
        skirtRadialScale: skirtRadial,
        outermostRingIndex,
        outermostRingOccupancy: occupancy,
        skirtCount: 6,
      });

      // Clear of the outermost year's outer surface, by the skirt's own radius.
      expect(skirt - skirtRadial, `${years}y`).toBeGreaterThan(ring + widest);
    }
  });

  it('seats a full ring without its own members touching', () => {
    // The circle constraint the placement was not asking about: eight bodies of
    // width 2r with a gap between them need n·(2r + gap) of circumference. The
    // sweep found two of a nine-year couple's first-ring crystals 0.0014 into
    // each other because the radius answered only to the monarch.
    for (const years of [4, 9, 25]) {
      const widest = childDimensions(monarchAxialScale(years * YEAR), 1).radialScale;
      const radius = ringSeatingRadius(CHILD_RING_CAPACITY, widest);
      const arcPerBody = (Math.PI * 2 * radius) / CHILD_RING_CAPACITY;
      expect(arcPerBody, `${years}y`).toBeGreaterThan(widest * 2);
    }
    // One body needs no room made for it, and zero is not a ring.
    expect(ringSeatingRadius(1, 0.1)).toBe(0);
    expect(ringSeatingRadius(0, 0.1)).toBe(0);
  });

  it('opens each ring wide enough for the bodies standing in it', () => {
    // The step used to be a flat 0.2, which held only while a child was slim.
    // Thickening them to the reference cluster's aspect took a twenty-five-year
    // child's radius past 0.1, so two adjacent rings needed 0.21 and had 0.20.
    for (const years of [1, 4, 9, 25, 60]) {
      const widest = childDimensions(monarchAxialScale(years * YEAR), 1).radialScale;
      expect(childRingStep(widest), `${years}y`).toBeGreaterThan(widest * 2);
    }
  });

  it('opens a new ring every eight years so no year is crowded out', () => {
    expect(childRingIndex(0)).toBe(0);
    expect(childRingIndex(CHILD_RING_CAPACITY - 1)).toBe(0);
    expect(childRingIndex(CHILD_RING_CAPACITY)).toBe(1);
    expect(childRingIndex(CHILD_RING_CAPACITY * 2)).toBe(2);

    const inner = childDistance({
      monarchRadialScale: 0.15, childRadialScale: 0.08, widestChildRadialScale: 0.08,
      ringIndex: 0, ringOccupancy: 8,
    });
    const outer = childDistance({
      monarchRadialScale: 0.15, childRadialScale: 0.08, widestChildRadialScale: 0.08,
      ringIndex: 1, ringOccupancy: 8,
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

  it('never leaves a balanced couple colourless (ADR-0016)', () => {
    // This reverses the rule it replaces, which asserted `[1, 1, 1]` here and
    // called the resulting white the reward for balance, paid in iridescence.
    // Measured on the owner's own portal, that reward is indistinguishable from
    // having granted nothing at all: the live couple's fourth year was 2/2/2
    // and published exactly `[1, 1, 1]`. Balance still drives iridescence — it
    // just no longer cancels the colour on its way there.
    const balanced = wishTint({ forFirst: 10, shared: 10, forSecond: 10 });
    expect(balanced.iridescence).toBeCloseTo(1, 6);
    expect(Math.min(...balanced.rgb)).toBeLessThan(0.7);

    // Balance may cost a little chroma — the blend of three hues sits nearer
    // the middle than any one of them does — but it may never cost most of it.
    // Measured at the same total granted: 0.745 balanced against 0.825 for the
    // most one-sided, which is 90%.
    const distance = (tint: { rgb: readonly [number, number, number] }): number =>
      tint.rgb.reduce((total, channel) => total + (1 - channel), 0);
    for (const lopsided of [
      { forFirst: 30, shared: 0, forSecond: 0 },
      { forFirst: 0, shared: 30, forSecond: 0 },
      { forFirst: 0, shared: 0, forSecond: 30 },
    ]) {
      expect(distance(balanced)).toBeGreaterThan(distance(wishTint(lopsided)) * 0.8);
    }

    // The small case matters more than the extreme one, because it is the one
    // real couples are in: 2/2/2 has to be visibly coloured.
    const small = wishTint({ forFirst: 2, shared: 2, forSecond: 2 });
    expect(Math.min(...small.rgb)).toBeLessThan(0.95);
  });

  it('points the colour at whoever was given to', () => {
    // Each channel now aims at a mineral hue rather than at an RGB channel —
    // rose, amethyst, aquamarine — so the assertion is that the three are
    // distinguishable and each leans the way its own stone does.
    const rose = wishTint({ forFirst: 10, shared: 0, forSecond: 0 });
    const amethyst = wishTint({ forFirst: 0, shared: 10, forSecond: 0 });
    const aqua = wishTint({ forFirst: 0, shared: 0, forSecond: 10 });

    // Rose is the warmest, aqua the coolest, amethyst between them.
    expect(rose.rgb[0]).toBeGreaterThan(amethyst.rgb[0]);
    expect(amethyst.rgb[0]).toBeGreaterThan(aqua.rgb[0]);
    expect(aqua.rgb[2]).toBeGreaterThanOrEqual(amethyst.rgb[2]);
    expect(amethyst.rgb[2]).toBeGreaterThan(rose.rgb[2]);

    // One-sided giving earns no rainbow, whichever side it is.
    for (const tint of [rose, amethyst, aqua]) expect(tint.iridescence).toBe(0);
  });

  it('deepens with the total granted, then stops at the cap', () => {
    // Depth reads the *total* now, not the largest single channel — the defect
    // this replaces made 3/3/3 and 3/0/0 pull identically, so giving three
    // times as much bought nothing.
    const distance = (tint: { rgb: readonly [number, number, number] }): number =>
      tint.rgb.reduce((total, channel) => total + (1 - channel), 0);

    const few = wishTint({ forFirst: 2, shared: 0, forSecond: 0 });
    const many = wishTint({ forFirst: 9, shared: 0, forSecond: 0 });
    expect(distance(many)).toBeGreaterThan(distance(few));

    const one = wishTint({ forFirst: 3, shared: 0, forSecond: 0 });
    const three = wishTint({ forFirst: 3, shared: 3, forSecond: 3 });
    expect(distance(three)).toBeGreaterThan(distance(one));

    // Past both caps — the per-channel one for the hue, the total for the
    // depth — nothing moves again.
    expect(wishTint({ forFirst: 400, shared: 0, forSecond: 0 }))
      .toEqual(wishTint({ forFirst: WISH_TOTAL_CAP, shared: 0, forSecond: 0 }));
    expect(WISH_TOTAL_CAP).toBeGreaterThanOrEqual(WISH_CHANNEL_CAP);
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

  it('counts shared days off as a second way a year can be full (ADR-0017)', () => {
    // The work schedule is the only module in the portal that measures time
    // *together* rather than records logged. Two years with identical portal
    // activity must not look identical when one of them had five shared days
    // off a month and the other had none.
    const quiet = yearActivity(2, 6);
    const apart = yearFill(1, quiet, yearTogetherness(2));
    const together = yearFill(1, quiet, yearTogetherness(SHARED_DAYS_OFF_FULL_YEAR));

    expect(together).toBeGreaterThan(apart);
    // Worth seeing, not a rounding step.
    expect(together - apart).toBeGreaterThan(0.15);
    // And it can never overtake what the couple actually recorded.
    expect(yearFill(1, 1, yearTogetherness(0)))
      .toBeGreaterThan(yearFill(1, 0, yearTogetherness(SHARED_DAYS_OFF_FULL_YEAR)));
  });

  it('never lets the schedule take anything away, at any activity', () => {
    // The defect this replaces, caught by a pipeline test rather than by
    // reading the formula. The first version blended activity and togetherness
    // — 0.65/0.35 — so a couple who *started keeping* the schedule and had a
    // quiet year saw an already-published crystal shrink. Adopting a module may
    // never cost a couple something they already had; ADR-0004 states that rule
    // for facets and it holds for every signal that arrives late.
    for (const activity of [0, 0.25, 0.5, 0.75, 1]) {
      const withoutSchedule = yearFill(1, activity);
      for (const days of [0, 1, 12, SHARED_DAYS_OFF_FULL_YEAR, 400]) {
        expect(
          yearFill(1, activity, yearTogetherness(days)),
          `${activity} / ${days}d`,
        ).toBeGreaterThanOrEqual(withoutSchedule);
      }
    }
  });

  it('credits only the days it can see, and saturates at the cap', () => {
    // The second thing the live portal corrected. An earlier version divided
    // by the months the schedule covered, so 18 shared days off across two
    // covered months extrapolated to a *full* year — one stretch of a newly
    // adopted module outvoting everything the couple had recorded. Flat
    // counting says what is known and no more.
    expect(yearTogetherness(18)).toBeCloseTo(0.3, 6);
    expect(yearTogetherness(0)).toBe(0);
    expect(yearFill(1, 0.5, 0)).toBe(yearFill(1, 0.5));
    expect(yearTogetherness(SHARED_DAYS_OFF_FULL_YEAR * 4))
      .toBe(yearTogetherness(SHARED_DAYS_OFF_FULL_YEAR));
  });

  it('survives nonsense schedule counts', () => {
    for (const value of [Number.NaN, -5, Number.POSITIVE_INFINITY]) {
      expect(Number.isFinite(yearTogetherness(value))).toBe(true);
      expect(Number.isFinite(yearFill(1, 0.5, yearTogetherness(value)))).toBe(true);
    }
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
