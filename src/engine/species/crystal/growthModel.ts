// ============================================================
// growthModel — arithmetic of the crystal's growth (ADR-0004).
// ------------------------------------------------------------
// Every number the druse is made of is decided here, and nothing here
// touches state, dates-as-clocks, meshes or colours-as-pixels. It is
// deliberately a pure module so the whole growth story can be checked
// with a table of inputs instead of a rendered screenshot.
//
// The rule this replaces was "one portal row = one crystal". It made the
// body count grow without a ceiling (a real couple reached 104 events)
// and then hid the overflow behind a device-dependent cap. Here the body
// count follows the years a couple has been together, and the modules
// change size, facets, colour and sparkle instead of adding bodies.
// ============================================================
import type { LeapDayPolicy } from '../../evolution/types';
import { clamp01, round6 } from './math';

const DAYS_PER_YEAR = 365;

// ── Monarch ─────────────────────────────────────────────────

/**
 * Height of the monarch from days spent together.
 *
 * The previous curve, `1 - exp(-days/1600)`, saturates: past roughly five
 * years the crystal stops growing at all, and every long relationship
 * renders identically. A logarithm never stops but decelerates hard —
 * forty years is only about a third taller than ten. That is the whole
 * point of the "harder progression": visible progress forever, without
 * the monarch ever becoming huge.
 *
 *   1 year  0.94    5 years  1.44    20 years  2.02
 *   3 years 1.28    10 years 1.72    40 years  2.33
 */
export function monarchAxialScale(daysTogether: number): number {
  const days = Number.isFinite(daysTogether) ? Math.max(0, daysTogether) : 0;
  return round6(0.62 + 0.46 * Math.log(1 + days / DAYS_PER_YEAR));
}

/**
 * Stoutest and slimmest silhouettes the monarch may take, as
 * height-to-width ratios. Below ~3.8:1 she reads as a block rather than a
 * spire; above ~6.2:1 as a needle. The shipped monarch the owner accepted
 * sat at about 4.6:1, which is where a typical couple lands here.
 */
const MONARCH_STOUTEST_ASPECT = 3.8;
const MONARCH_SLIMMEST_ASPECT = 6.2;

/** Contributions beyond which extra activity stops thickening the monarch. */
const MONARCH_ACTIVITY_SATURATION = 400;

/**
 * Girth of the monarch from how much the couple has put into the portal.
 *
 * Activity moves the *proportion*, not an absolute thickness. Expressing it
 * as an aspect ratio rather than a radius is what makes it legible: a quiet
 * couple gets a slender spire and a busy one a sturdy column at any age,
 * where an absolute girth term plus a clamp — the first thing tried here —
 * left the clamp doing all the work and activity visible nowhere.
 *
 * Activity thickens and never lengthens. That separation is what stops any
 * one module from running away with the artifact: a thousand photos cannot
 * make the monarch tall.
 */
export function monarchRadialScale(axialScale: number, contributions: number): number {
  const total = Number.isFinite(contributions) ? Math.max(0, contributions) : 0;
  const activity = clamp01(
    Math.log(1 + total / 40) / Math.log(1 + MONARCH_ACTIVITY_SATURATION / 40),
  );
  const aspect = MONARCH_SLIMMEST_ASPECT
    - (MONARCH_SLIMMEST_ASPECT - MONARCH_STOUTEST_ASPECT) * activity;
  return round6(axialScale / (2 * aspect));
}

/** A crystal with fewer sides stops reading as a crystal. */
export const MONARCH_MIN_FACETS = 6;
/** Beyond this it reads as a cylinder; reaching it is a deliberate endgame. */
export const MONARCH_MAX_FACETS = 24;

/**
 * How many photos one new facet costs, by how long the couple had been
 * together when that photo was taken.
 */
export function facetThresholdForYears(completedYears: number): number {
  if (completedYears < 1) return 5;
  if (completedYears < 5) return 10;
  if (completedYears < 10) return 15;
  return 20;
}

/**
 * Facets on the monarch, from the couple's photos.
 *
 * Each photo contributes `1 / threshold-at-the-time-it-was-taken`, and the
 * contributions accumulate for good. Dividing the *current* photo count by
 * the *current* threshold would have been simpler and wrong: a couple with
 * 100 photos at eleven months has 20 facets, and two months later the
 * divisor changes and they have 10. The crystal must never lose a facet
 * because time passed, so the cost is fixed per photo at the moment it
 * arrives.
 *
 * @param photoYears completed relationship years at each photo's date.
 */
export function monarchFacetCount(photoYears: readonly number[]): number {
  let earned = 0;
  for (const years of photoYears) {
    if (!Number.isFinite(years)) continue;
    earned += 1 / facetThresholdForYears(Math.max(0, Math.floor(years)));
  }
  return Math.min(
    MONARCH_MAX_FACETS,
    MONARCH_MIN_FACETS + Math.floor(round6(earned)),
  );
}

// ── Relationship years ──────────────────────────────────────

export interface RelationshipYear {
  /** 0 for the first year of the relationship. */
  index: number;
  /** Anniversary the year opens on, `YYYY-MM-DD`. */
  startsAt: string;
  /** Anniversary it closes on, `YYYY-MM-DD`. */
  endsAt: string;
  /** True once `endsAt` has passed: the crystal for it is frozen. */
  complete: boolean;
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * The anniversary date in a given calendar year, honouring the couple's
 * leap-day policy. Mirrors the rule the calendar adapter already applies
 * to yearly events so a Feb 29 relationship does not drift between them.
 */
export function anniversaryOn(
  startedAt: string,
  year: number,
  leapDayPolicy: LeapDayPolicy,
): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(startedAt);
  if (!match) return null;
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month === 2 && day === 29 && !isLeapYear(year)) {
    return leapDayPolicy === 'feb-28' ? `${year}-02-28` : `${year}-03-01`;
  }
  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * Every relationship year up to and including the one in progress.
 *
 * The count is what decides how many child crystals exist, so it is the
 * single place the body count comes from. A couple always has at least
 * one year — the one they are living now.
 */
export function relationshipYears(
  startedAt: string,
  asOf: string,
  leapDayPolicy: LeapDayPolicy,
): RelationshipYear[] {
  const start = /^(\d{4})-(\d{2})-(\d{2})/.exec(startedAt);
  const now = /^(\d{4})-(\d{2})-(\d{2})/.exec(asOf);
  if (!start || !now) return [];

  const startYear = Number(start[1]);
  const years: RelationshipYear[] = [];
  // A relationship cannot plausibly outrun this, and the bound keeps a
  // malformed date from spinning the loop.
  const MAX_YEARS = 150;

  for (let index = 0; index < MAX_YEARS; index += 1) {
    const startsAt = anniversaryOn(startedAt, startYear + index, leapDayPolicy);
    const endsAt = anniversaryOn(startedAt, startYear + index + 1, leapDayPolicy);
    if (startsAt === null || endsAt === null) break;
    if (startsAt > asOf) break;
    years.push({ index, startsAt, endsAt, complete: endsAt <= asOf });
  }

  return years;
}

/** Twelve discrete steps; a newborn crystal is one twelfth, never nothing. */
export const CHILD_GROWTH_STEPS = 12;

/**
 * How far through its year a child crystal has grown, in whole months.
 *
 * Deliberately stepped rather than continuous: the owner asked for growth
 * "every month", and a visible monthly increment is the point. A finished
 * year is always exactly 1.
 */
export function childGrowthProgress(year: RelationshipYear, asOf: string): number {
  if (year.complete) return 1;
  const start = /^(\d{4})-(\d{2})-(\d{2})/.exec(year.startsAt);
  const now = /^(\d{4})-(\d{2})-(\d{2})/.exec(asOf);
  if (!start || !now) return 1 / CHILD_GROWTH_STEPS;

  const startMonths = Number(start[1]) * 12 + Number(start[2]);
  const nowMonths = Number(now[1]) * 12 + Number(now[2]);
  let elapsed = nowMonths - startMonths;
  // The month only turns over once the day-of-month is reached again.
  if (Number(now[3]) < Number(start[3])) elapsed -= 1;

  const step = Math.min(CHILD_GROWTH_STEPS - 1, Math.max(0, elapsed));
  return round6((step + 1) / CHILD_GROWTH_STEPS);
}

// ── Child crystals ──────────────────────────────────────────

/** A child never exceeds half the monarch she was frozen beside. */
export const CHILD_MONARCH_SHARE = 0.5;
/** Engine units of air that must remain between a child and the monarch. */
export const CHILD_MIN_CLEARANCE = 0.12;
/** Years per ring before a new, wider ring opens. */
export const CHILD_RING_CAPACITY = 8;
/**
 * How much further out each successive ring sits, and how far a year with no
 * important events stands back.
 *
 * Both are deliberately tight. Measured across ages, a looser ring made the
 * druse far wider than tall — at twenty years it was 4.2 wide against a 2.5
 * monarch, which reads as a pancake with the monarch lost in it. At these
 * values the footprint stays roughly as wide as it is tall at every age.
 */
const CHILD_RING_STEP = 0.3;
const CHILD_EVENT_REACH = 0.22;
/** Fraction of that reach one important event closes. */
const CHILD_EVENT_STEP = 0.25;

export function childRingIndex(yearIndex: number): number {
  return Math.max(0, Math.floor(yearIndex / CHILD_RING_CAPACITY));
}

export interface ChildDimensions {
  axialScale: number;
  radialScale: number;
}

/**
 * Size of a year's crystal.
 *
 * `monarchAxialAtClose` is the monarch's height at the year's *end*, not
 * today: a frozen year keeps the proportion it had when it closed. Since
 * the monarch keeps growing afterwards, older rings end up shorter than
 * newer ones on their own, and the ring reads as a growth history without
 * any extra mechanism.
 */
export function childDimensions(
  monarchAxialAtClose: number,
  progress: number,
  yearActivity: number,
): ChildDimensions {
  const activity = 0.7 + 0.3 * clamp01(yearActivity);
  const axialScale = round6(
    monarchAxialAtClose * CHILD_MONARCH_SHARE * clamp01(progress) * activity,
  );
  // Children stay a little stouter than the monarch so she keeps the eye.
  return { axialScale, radialScale: round6(axialScale / 8.5) };
}

/**
 * Distance from the monarch's axis to a child's axis.
 *
 * Important events during the year pull the crystal inward, but the floor
 * is the sum of both radii plus a fixed clearance, so contact is
 * arithmetically impossible however many events a year holds.
 */
export function childDistance(input: {
  monarchRadialScale: number;
  childRadialScale: number;
  ringIndex: number;
  importantEventCount: number;
}): number {
  const floor = input.monarchRadialScale
    + input.childRadialScale
    + CHILD_MIN_CLEARANCE
    + input.ringIndex * CHILD_RING_STEP;
  const closeness = clamp01(Math.max(0, input.importantEventCount) * CHILD_EVENT_STEP);
  return round6(floor + (1 - closeness) * CHILD_EVENT_REACH);
}

/** Golden angle: successive years never line up, in one ring or across rings. */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export function childAzimuthRad(yearIndex: number): number {
  const angle = (yearIndex * GOLDEN_ANGLE) % (Math.PI * 2);
  return round6(angle < 0 ? angle + Math.PI * 2 : angle);
}

// ── Colour from fulfilled wishes ────────────────────────────

/**
 * Wishes granted during one relationship year.
 *
 * Named for the two partners rather than for genders: which partner is
 * which colour is an application-layer decision, and the engine has no
 * business knowing. `forFirst` counts wishes belonging to the first
 * partner that the second one granted, and vice versa.
 */
export interface WishGiftTally {
  forFirst: number;
  shared: number;
  forSecond: number;
}

/** Wishes per channel per year beyond which the colour stops deepening. */
export const WISH_CHANNEL_CAP = 10;

export interface CrystalTint {
  /** Linear RGB in 0..1; pure white when the year granted no wishes. */
  rgb: readonly [number, number, number];
  /** 0..1 rainbow strength on the facets. */
  iridescence: number;
}

const WHITE: CrystalTint = { rgb: [1, 1, 1], iridescence: 0 };

/**
 * Colour of a year's crystal from the wishes granted during it.
 *
 * Not a literal RGB triple. Mapping counts straight onto channels would
 * make a year with no gifts *black*, contradicting the white crystal every
 * body is born as, and — worse — would make a perfectly balanced year
 * (ten, ten and ten) render grey, so the best possible year looked like
 * the dullest.
 *
 * Instead the counts give tone and saturation over white, and how *evenly*
 * the couple gave decides iridescence. A year where both partners granted
 * as much as they received comes out almost white with a strong rainbow
 * across the facets, which is the right reward for balance and costs
 * nothing new — the material already carries an iridescence field.
 */
export function wishTint(tally: WishGiftTally): CrystalTint {
  const unit = (count: number): number =>
    clamp01(Math.max(0, Number.isFinite(count) ? count : 0) / WISH_CHANNEL_CAP);
  const first = unit(tally.forFirst);
  const shared = unit(tally.shared);
  const second = unit(tally.forSecond);

  const strongest = Math.max(first, shared, second);
  if (strongest <= 0) return WHITE;

  const weakest = Math.min(first, shared, second);
  const hue: readonly [number, number, number] = [
    first / strongest,
    shared / strongest,
    second / strongest,
  ];
  // Never all the way to the pure hue: a crystal is translucent stone, not
  // stained glass, and it has to keep reading as crystal at every tint.
  const pull = strongest * 0.75;

  return {
    rgb: [
      round6(1 - (1 - hue[0]) * pull),
      round6(1 - (1 - hue[1]) * pull),
      round6(1 - (1 - hue[2]) * pull),
    ],
    iridescence: round6((weakest / strongest) * strongest),
  };
}

// ── Sparkles from media ─────────────────────────────────────

/** Floor so the artifact always has a little life around it. */
const SPARKLE_FLOOR = 6;

/**
 * Crystal dust around the artifact, from films, series and books the
 * couple finished. Square root, because the difference between 20 and 40
 * watched should be visible while the difference between 400 and 800 is
 * not worth another twenty particles.
 */
export function mediaSparkleCount(finishedCount: number, cap: number): number {
  const finished = Number.isFinite(finishedCount) ? Math.max(0, finishedCount) : 0;
  const requested = SPARKLE_FLOOR + Math.round(Math.sqrt(finished) * 2.4);
  return Math.max(0, Math.min(Math.max(0, cap), requested));
}
