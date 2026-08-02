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
 * The curve before this one, `1 - exp(-days/1600)`, saturates: past roughly
 * five years the crystal stops growing at all, and every long relationship
 * renders identically. A logarithm never stops but decelerates hard.
 *
 * The constants were then lowered on the owner's reading of a three-year
 * crystal — "too big already, and frightening to imagine at seven". So the
 * monarch starts modest and the next few years add very little: seven years
 * is under a fifth taller than three and a half, and forty is only a third
 * taller than ten. What the couple should read in her is patience, not
 * accumulation.
 *
 *   1 year  0.63    5 years  0.96    20 years  1.33
 *   3.6 yrs 0.88    7 years  1.04    40 years  1.53
 */
export function monarchAxialScale(daysTogether: number): number {
  const days = Number.isFinite(daysTogether) ? Math.max(0, daysTogether) : 0;
  return round6(0.42 + 0.3 * Math.log(1 + days / DAYS_PER_YEAR));
}

/**
 * Stoutest and slimmest silhouettes the monarch may take, as
 * height-to-width ratios. Below ~3.8:1 she reads as a block rather than a
 * spire; above ~6.2:1 as a needle. The shipped monarch the owner accepted
 * sat at about 4.6:1, which is where a typical couple lands here.
 */
const MONARCH_STOUTEST_ASPECT = 3.8;
const MONARCH_SLIMMEST_ASPECT = 6.2;

/**
 * Deliberate acts beyond which more of them stop thickening the monarch.
 *
 * Rescaled when girth stopped counting every event and started counting only
 * things the couple decided to do — plans, gifts, places, milestones. Those
 * are roughly 45% of a real couple's total, so the old ceiling of 400 would
 * have left the whole range unused and every crystal slender.
 */
const MONARCH_ACTIVITY_SATURATION = 150;

/**
 * Girth of the monarch from the deliberate acts behind her.
 *
 * `contributions` counts what the couple *did* — plans finished, wishes
 * granted, places visited, milestones marked — not everything they logged.
 * Counting everything made girth a photo count, and photos already earn her
 * facets, so one module quietly decided two of her three dimensions.
 *
 * Activity moves the *proportion*, not an absolute thickness. Expressing it
 * as an aspect ratio rather than a radius is what makes it legible: a quiet
 * couple gets a slender spire and a busy one a sturdy column at any age,
 * where an absolute girth term plus a clamp — the first thing tried here —
 * left the clamp doing all the work and activity visible nowhere.
 *
 * Activity thickens and never lengthens. That separation is what stops any
 * one module from running away with the artifact: a thousand photos cannot
 * make the monarch tall, and now they cannot make her thick either.
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
export const CHILD_MIN_CLEARANCE = 0.1;
/** Years per ring before a new, wider ring opens. */
export const CHILD_RING_CAPACITY = 8;
/**
 * How much further out each successive ring sits, and how far a year with no
 * important events stands back.
 *
 * Both are deliberately tight. A looser ring made the druse far wider than
 * tall, and on a portrait phone that is not a tuning problem but a geometric
 * one: an object wider than the screen is wide can never fill the screen's
 * height, whatever the camera does. Keeping the footprint no wider than the
 * artifact is tall is what lets the crystal read large on a phone.
 */
const CHILD_RING_STEP = 0.26;
const CHILD_EVENT_REACH = 0.14;
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
 * Portal modules a year can draw on: calendar, plans, wishlist, map,
 * memories, shopping.
 *
 * Kept here as a number rather than imported from the adapter layer, which
 * Volume II has no business reaching into. `growthModel.test.ts` checks it
 * against the real adapter source list so the two cannot drift.
 */
export const PORTAL_MODULE_COUNT = 6;

/** Events in a single module beyond which more of the same adds little. */
const YEAR_DEPTH_HALF_SATURATION = 12;

/**
 * How lived-in a year was, from 0 to 1.
 *
 * Weighted toward *breadth* — how many parts of the portal the year touched —
 * rather than volume. Counting events made the measure almost entirely a
 * photo count: in a real couple's fullest year, 48 of 80 events were photos,
 * and photos already drive the monarch's facets, so volume both double-counted
 * one module and drowned out the other five. Measured on that couple's four
 * years, counting gave 0.25 / 0.14 / 0.33 / 0.87 — ranking a year of nothing
 * but six photos *above* a year with a trip, an anniversary and a photo.
 *
 * This is the "module fill" the owner asked for from the start.
 */
export function yearActivity(moduleCount: number, eventCount: number): number {
  // `Math.max(0, NaN)` is NaN and `Infinity / (Infinity + 12)` is NaN, so a
  // count has to be proved finite before it is used, not merely floored.
  const count = (value: number): number => (Number.isFinite(value) ? Math.max(0, value) : 0);
  const breadth = clamp01(count(moduleCount) / PORTAL_MODULE_COUNT);
  const events = count(eventCount);
  const depth = events / (events + YEAR_DEPTH_HALF_SATURATION);
  return round6(0.6 * breadth + 0.4 * depth);
}

/**
 * How full a year is, from 0 to 1 — the fraction of the maximum a year's
 * crystal is entitled to.
 *
 * This is the quantity that stops at the anniversary. It is *not* the same
 * as the crystal being immutable: a couple who joined the portal in their
 * third year needs to be able to go back and fill in the first two, and
 * content dated inside a year belongs to that year whenever it is added.
 * What a closed year no longer does is grow with time or with anything
 * that happened outside it.
 *
 * The floor is what a year with nothing in it still gets. It was 0.55, which
 * compressed a real couple's three closed years into 0.66/0.61/0.70 — a nine
 * percent spread, invisible on screen, so three very different years looked
 * identical. A lower floor lets a well-filled year actually look like one.
 */
const EMPTY_YEAR_FLOOR = 0.3;

export function yearFill(progress: number, activity: number): number {
  return round6(
    clamp01(progress) * (EMPTY_YEAR_FLOOR + (1 - EMPTY_YEAR_FLOOR) * clamp01(activity)),
  );
}

/**
 * Size of a year's crystal, as a share of the monarch as she stands today.
 *
 * An earlier version measured against the monarch's height at the year's
 * *close*, which made a couple's first years permanently tiny however much
 * they later filled them in — the opposite of what backfilling is for. Tying
 * the ring to the current monarch keeps every year legible and keeps the
 * owner's original rule literally true: half of the monarch, never more.
 */
export function childDimensions(
  monarchAxialNow: number,
  fill: number,
): ChildDimensions {
  const axialScale = round6(monarchAxialNow * CHILD_MONARCH_SHARE * clamp01(fill));
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

// ── Ground ──────────────────────────────────────────────────

/** Places beyond which more travel stops widening the ground much. */
const GROUND_PLACES_HALF_SATURATION = 30;
/** Widest the ground may grow beyond the druse's own footprint. */
const GROUND_MAX_SPREAD = 0.45;

/**
 * How far the rock spreads beyond what the druse strictly needs, from the
 * places the couple has been.
 *
 * The map was the second-largest module in a real couple's history — 26
 * visited places — and drove nothing of its own: the substrate was derived
 * purely from the druse's own footprint, so it carried no meaning at all.
 * Where they have been is literally the ground they grow from.
 *
 * A multiplier rather than an absolute size, because the substrate still has
 * to cover every crystal's buried base (ADR-0003). Widening it can never
 * break that guarantee; narrowing it could, so this only ever grows.
 */
export function groundSpread(placesVisited: number): number {
  const places = Number.isFinite(placesVisited) ? Math.max(0, placesVisited) : 0;
  const reach = places / (places + GROUND_PLACES_HALF_SATURATION);
  return round6(1 + GROUND_MAX_SPREAD * reach);
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
