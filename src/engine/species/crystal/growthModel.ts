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
import { GROUND_LEAN_SCALE } from '../../growth';
import { clamp01, round6, seededUnit } from './math';

const DAYS_PER_YEAR = 365;

// ── Monarch ─────────────────────────────────────────────────

/**
 * The relationship's full term, in years.
 *
 * Thirty is the owner's number and it is a real decision, not a clamp: past it
 * the monarch stops getting taller and the couple's history goes into girth and
 * facets instead (`veteranGirth`, `monarchFacetCount`). A crystal that grows
 * without bound eventually cannot be framed, and one that keeps climbing for
 * fifty years tells a couple at three that they have almost nothing yet.
 */
export const MONARCH_FULL_TERM_YEARS = 30;

/**
 * Height on the first day, and at the full term, in engine units.
 *
 * The full height matches `REFERENCE_HEIGHT` in the renderer's fit, so a
 * thirty-year monarch is exactly the crystal that fills the frame and every
 * younger one is proportionally smaller. The seed is small but not a speck: a
 * couple on day one has a crystal, not a promise of one.
 */
const MONARCH_SEED_HEIGHT = 0.26;
const MONARCH_FULL_HEIGHT = 1.4;

/**
 * How the height is distributed across the term.
 *
 * Below one, so the early years are worth more than the late ones — but only
 * mildly. A strongly decelerating curve is what the previous one was, and it is
 * what the owner rejected: `0.42 + 0.3·ln(1 + years)` put a couple at **30% of
 * full height on their first day** and **60% at three years**, so the artifact
 * was nearly grown before the relationship was, and the next twenty-seven years
 * had two fifths of the range left to say anything with.
 *
 *   day one   0.26   (19% of full)      10 years  0.78   (56%)
 *   1 year    0.36   (26%)              20 years  1.11   (79%)
 *   3 years   0.48   (34%)              30 years  1.40   (100%)
 *
 * Day one to three years is still an 83% gain, so the years that matter most to
 * a young couple are the ones where the crystal changes fastest.
 */
const MONARCH_GROWTH_EXPONENT = 0.72;

/**
 * Height of the monarch from days spent together.
 *
 * Flat past the full term by construction rather than by a clamp bolted on: the
 * progress term saturates at one, so thirty years and fifty years are the same
 * height and the difference between them shows up as girth and facets.
 */
export function monarchAxialScale(daysTogether: number): number {
  const days = Number.isFinite(daysTogether) ? Math.max(0, daysTogether) : 0;
  const progress = clamp01(days / DAYS_PER_YEAR / MONARCH_FULL_TERM_YEARS);
  return round6(
    MONARCH_SEED_HEIGHT
    + (MONARCH_FULL_HEIGHT - MONARCH_SEED_HEIGHT) * Math.pow(progress, MONARCH_GROWTH_EXPONENT),
  );
}

/**
 * How much wider a crystal grows once it has stopped growing taller.
 *
 * Past the full term the couple's history has to keep showing somewhere, and
 * the owner named the two places: width, and new faces. This is the width.
 *
 * Saturating rather than linear, so a fifty-year relationship is visibly
 * stouter than a thirty-year one without a seventy-year one becoming a boulder.
 * It only ever grows, so it can never take back girth the couple already had.
 *
 *   30 years  1.00    45 years  1.13    70 years  1.22
 *   35 years  1.06    50 years  1.16    ∞         1.35
 */
export function veteranGirth(daysTogether: number): number {
  const days = Number.isFinite(daysTogether) ? Math.max(0, daysTogether) : 0;
  const beyond = Math.max(0, days / DAYS_PER_YEAR - MONARCH_FULL_TERM_YEARS);
  return round6(1 + 0.35 * (beyond / (beyond + 25)));
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
 * Past the full term, time itself starts adding faces. That is the second half
 * of the owner's rule for a veteran relationship — the first is `veteranGirth`
 * — and it is what keeps a fortieth year from looking exactly like a thirtieth
 * when the height can no longer say anything. One face every five years, which
 * over the whole remaining range to the twenty-four-face ceiling is a slow,
 * legible drift rather than a second growth curve.
 *
 * It can only add, so ADR-0004's hardest guarantee survives intact: a facet
 * earned is never lost to the passage of time.
 *
 * @param photoYears completed relationship years at each photo's date.
 * @param daysTogether days the couple has been together, for the veteran term.
 */
export function monarchFacetCount(
  photoYears: readonly number[],
  daysTogether = 0,
): number {
  let earned = 0;
  for (const years of photoYears) {
    if (!Number.isFinite(years)) continue;
    earned += 1 / facetThresholdForYears(Math.max(0, Math.floor(years)));
  }
  const days = Number.isFinite(daysTogether) ? Math.max(0, daysTogether) : 0;
  const beyondTerm = Math.max(0, days / DAYS_PER_YEAR - MONARCH_FULL_TERM_YEARS);
  return Math.min(
    MONARCH_MAX_FACETS,
    MONARCH_MIN_FACETS + Math.floor(round6(earned)) + Math.floor(beyondTerm / 5),
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
/**
 * Engine units of air that must remain between a child and the monarch.
 *
 * 0.1 → 0.055 → 0.012, and the last step is the one that made the druse a
 * druse. Measured on four couples at 0.055: the air between the monarch's
 * surface and a child's was **0.080 at the anchors and 0.095 mesh to mesh**,
 * against a child's own diameter of 0.040. Every child stood more than two of
 * its own widths off the monarch, which is why the colony kept reading as
 * separate crystals arranged around a spire however tight the ring looked in
 * plan.
 *
 * The number still exists, and it still makes contact arithmetically
 * impossible — that is the whole reason it is a floor and not a target. What
 * changed is that it is now the *only* term between the two surfaces, and it is
 * small enough that the vein's capsules merge into one node under the monarch
 * rather than reaching out to each child down its own branch (ADR-0003 builds
 * the substrate as a union of capsules, so bases this close share one).
 *
 * It only has to hold at the *base*: a leaning child diverges from the monarch
 * all the way up, so the gap at the ground is the smallest gap there is.
 */
export const CHILD_MIN_CLEARANCE = 0.012;

/**
 * Extra clearance proportional to the two radii, for the corners a stated
 * radius does not describe.
 *
 * `radialScale` is the distance to a *face*, and a crystal is a polygon: its
 * corners stand `1/cos(π/n)` further out, which is about 4% at eleven facets
 * and more on the smaller counts a child carries. That excess scales with the
 * body, so an absolute clearance that is comfortable on a young couple is not
 * on an old one — measured with a flat 0.012, the closest child hull stood
 * 0.0035 outside the monarch at four years and **0.0010** at twenty-five,
 * heading the wrong way.
 *
 * Twelve per cent of the two radii covers both bodies' corner excess about
 * three times over, and it costs a fifth of what the old flat standoff did.
 */
const CHILD_CORNER_ALLOWANCE = 0.12;
/** Years per ring before a new, wider ring opens. */
export const CHILD_RING_CAPACITY = 8;
/**
 * How much further out each successive ring sits, and how far a year with no
 * important events stands back.
 *
 * Deliberately tight. A looser ring made the druse far wider than tall, and on
 * a portrait phone that is not a tuning problem but a geometric one: an object
 * wider than the screen is wide can never fill the screen's height, whatever
 * the camera does. Keeping the footprint no wider than the artifact is tall is
 * what lets the crystal read large on a phone.
 *
 * It was pulled in again once the children started leaning outward. A standing
 * child keeps the same distance from the monarch all the way up, so the ring
 * had to be wide enough to look uncrowded at the tips. A leaning one diverges
 * as it rises: its tightest point is its base, and the extra standoff was
 * buying separation that the lean now provides for free — at the cost of a
 * druse that spread wider than it stood tall.
 *
 * Only the *ring* step survives. The other constant that used to live here was
 * `CHILD_EVENT_REACH`: an extra standoff that a year's important events could
 * close, so a busy year drew its crystal toward the monarch while the clearance
 * floor guaranteed it could never reach her. The owner asked for one common
 * vein and named that mechanism as the thing in the way — a crystal reaching
 * for the monarch it can never join. It is gone, and no term now stands between
 * a child's base and the monarch's but the floor.
 */
const CHILD_RING_STEP = 0.2;

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
 * The sum of both radii plus a fixed clearance, and nothing else — so every
 * child in a ring stands as close to the monarch as the geometry permits, and
 * contact stays arithmetically impossible.
 *
 * A year's activity used to move this. It no longer does, and that is the
 * point: distance from the mother is not something a couple earns, it is what
 * makes the colony one body. What a year did with itself shows in the crystal's
 * size, facets and fill, all of which are things the year *is* rather than
 * where it stands.
 */
export function childDistance(input: {
  monarchRadialScale: number;
  childRadialScale: number;
  ringIndex: number;
}): number {
  return round6(
    input.monarchRadialScale
    + input.childRadialScale
    + childClearance(input.monarchRadialScale, input.childRadialScale)
    + input.ringIndex * CHILD_RING_STEP,
  );
}

/** The floor between two bodies' stated radii; see the two constants above. */
export function childClearance(monarchRadialScale: number, childRadialScale: number): number {
  const monarch = Number.isFinite(monarchRadialScale) ? Math.max(0, monarchRadialScale) : 0;
  const child = Number.isFinite(childRadialScale) ? Math.max(0, childRadialScale) : 0;
  return round6(CHILD_MIN_CLEARANCE + CHILD_CORNER_ALLOWANCE * (monarch + child));
}

/**
 * Engine units between the year ring's outer edge and the skirt.
 *
 * The skirt used to sit at a fixed 0.24 from the axis while the year ring was
 * derived from the monarch's own girth, and the two crossed: at four years the
 * plans stood 0.08 outside the years, and at twenty-five the *years* had grown
 * past them, so the marks of finished plans ended up scattered among and behind
 * the crystals they were meant to sit in front of. Deriving both from the same
 * radii is what keeps the order fixed at every age.
 */
const SKIRT_CLEARANCE = 0.02;

/**
 * Distance from the monarch's axis to a plan crystal's axis.
 *
 * Just outside the widest a year crystal can be, so the skirt reads as a hem
 * around the colony rather than as gravel dropped between its members. Uses the
 * widest possible year rather than the years this couple actually has, so a
 * couple who fills in an empty year later does not find their plan crystals
 * suddenly overlapped by it.
 */
export function skirtDistance(input: {
  monarchRadialScale: number;
  widestChildRadialScale: number;
  skirtRadialScale: number;
}): number {
  return round6(
    input.monarchRadialScale
    + input.widestChildRadialScale * 2
    + childClearance(input.monarchRadialScale, input.widestChildRadialScale)
    + input.skirtRadialScale
    + SKIRT_CLEARANCE,
  );
}

/**
 * How far a year's crystal leans away **from the monarch's axis**, in degrees.
 *
 * Measured off the monarch, not off the platform. The two differ by exactly the
 * complement and the first pass used the platform, which put the children at
 * 35–45° off the monarch — a visibly gentler splay than the crown the owner
 * asked for. The monarch is the thing the ring is arranged around, so she is
 * what the angle should be stated against.
 *
 * Every child used to stand straight up, which made the druse read as a row of
 * pins around a post rather than as a colony: quartz siblings growing out of
 * one seam fan away from it. Leaning them also separates their tips as they
 * rise, so the gaps between them are visible from the portal's camera angle
 * instead of closing up behind the monarch.
 *
 * Away from the axis, never toward it — the lean and the placement share one
 * azimuth — so a lean can only ever increase the clearance `childDistance`
 * already guarantees.
 *
 * **The band, and why it widened.** 45–55° was ten degrees across, and measured
 * on three couples every child in every colony landed in it: 45.2–54.9,
 * 45.5–54.8, 45.3–54.9. A colony whose members all lean by the same amount is a
 * starburst, and a starburst is arranged rather than grown — Pass 1's
 * "placement feels positioned, not grown", of which this was the last piece
 * still flat after radius and size had opened up.
 *
 * A vug of quartz does not do this. Some crystals in one seam stand nearly
 * upright, others lie well over, and the spread is the first thing that says
 * "these grew where they happened to nucleate".
 *
 * Both ends are safe, and not by luck. Leaning further only carries the tip
 * further out, and `CHILD_MIN_UPWARD` is derived from the maximum below rather
 * than hand-set, so `ensureUpward` follows the band instead of quietly
 * standing the steepest children back up. Standing straighter keeps the tip
 * over its own base, and `childDistance` already puts that base clear of the
 * monarch's surface by both radii plus `CHILD_MIN_CLEARANCE` — a floor no
 * amount of activity may eat into, and one the lean is not part of.
 *
 * The maximum stops at 58° rather than going further because the engine holds a
 * separate invariant: a body standing in the ground grows upward rather than
 * out of the side, so its steepest permitted direction must still rise more
 * than it reaches. 58° off the monarch is 32° above the platform, and
 * sin 32° = 0.530. At 64° it was 0.438 and the invariant broke.
 */
export const CHILD_TILT_MIN_DEG = 30;
export const CHILD_TILT_MAX_DEG = 58;

/** The same angles as the engine states them: above the platform plane. */
function tiltAbovePlatform(offMonarchDegrees: number): number {
  return 90 - offMonarchDegrees;
}

/**
 * The lean, expressed the way Volume III takes it.
 *
 * The engine mixes straight-up with straight-out as `up·(1−lean) + out·lean`
 * and caps `lean` at `GROUND_LEAN_SCALE·radialBias`, so an angle θ above the
 * platform needs `lean = 1/(1+tan θ)`. Inverting it here rather than
 * hand-tuning a bias keeps the published number and the requirement in the same
 * place: change the degrees and the geometry follows.
 */
export function childRadialBias(seed: number): number {
  const offMonarch = CHILD_TILT_MIN_DEG
    + seededUnit(seed, 'tilt') * (CHILD_TILT_MAX_DEG - CHILD_TILT_MIN_DEG);
  const above = (tiltAbovePlatform(offMonarch) * Math.PI) / 180;
  const lean = 1 / (1 + Math.tan(above));
  return round6(clamp01(lean / GROUND_LEAN_SCALE));
}

/**
 * The upward component a child at the steepest permitted lean still has.
 *
 * This is the floor `ensureUpward` measures against, so it has to sit at or
 * below the *most* leaning child, not the least — set it to the shallow end and
 * the engine quietly stands the strongly leaning ones back up.
 */
export const CHILD_MIN_UPWARD = round6(
  Math.sin((tiltAbovePlatform(CHILD_TILT_MAX_DEG) * Math.PI) / 180),
);

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

// ── Consistency ─────────────────────────────────────────────

/** Months of habit the measure looks back over. */
export const CONSISTENCY_WINDOW_MONTHS = 12;

/**
 * How regularly the couple shows up, from 0 to 1.
 *
 * A different question from how much they log, and the more interesting one:
 * a couple who adds something most months is tending the thing, while forty
 * photos dumped in one weekend and silence either side is not the same
 * relationship with the portal, however large the volume.
 *
 * Bounded to a rolling window so it stays answerable — over a whole
 * relationship it would only ever fall, which would turn into exactly the
 * kind of decay this artifact refuses to have.
 */
export function consistency(monthsTouched: number, monthsLived: number): number {
  const touched = Number.isFinite(monthsTouched) ? Math.max(0, monthsTouched) : 0;
  const lived = Number.isFinite(monthsLived) ? Math.max(0, monthsLived) : 0;
  const window = Math.min(CONSISTENCY_WINDOW_MONTHS, lived);
  if (window <= 0) return 0;
  return round6(clamp01(Math.min(touched, window) / window));
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

/** Wishes in one channel beyond which it stops pulling the hue any further. */
export const WISH_CHANNEL_CAP = 10;

/** Wishes granted in total beyond which the colour stops deepening. */
export const WISH_TOTAL_CAP = 14;

/**
 * The colour each channel points at.
 *
 * The mapping used to be the identity — `forFirst` drove red, `shared` green,
 * `forSecond` blue — and that is what made an even split render **white**:
 * three equal RGB channels are grey by definition, and grey over white is
 * white. So the couple who gave each other the most, and gave most evenly, got
 * a crystal with no colour in it.
 *
 * Pointing each channel at a *mineral* colour removes the coincidence. An even
 * split lands on the blend of the three — `[0.66, 0.50, 0.85]`, amethyst — which
 * is a colour, and at full depth the strongest one the crystal can reach rather
 * than the palest.
 *
 * The chroma is in the anchors rather than in a normalisation step. A first
 * attempt used paler anchors and rescaled the blend, and it came out weaker
 * than the mapping it replaced: dividing by the largest channel drives that
 * channel to white and can only darken the others, so a pale anchor set has
 * nothing left to give. These three carry their own separation — 0.35 between
 * the darkest and lightest channel — and the depth term does the rest.
 *
 * Chosen to stay inside one stone: rose quartz, amethyst and aquamarine are all
 * pale silicates, so any mix of them still reads as quartz rather than as dye.
 */
const WISH_HUE_FOR_FIRST: readonly [number, number, number] = [1, 0.35, 0.55];
const WISH_HUE_SHARED: readonly [number, number, number] = [0.62, 0.35, 1];
const WISH_HUE_FOR_SECOND: readonly [number, number, number] = [0.35, 0.8, 1];

/**
 * Never all the way to the pure hue: a crystal is translucent stone, not
 * stained glass, and it has to keep reading as crystal at every tint.
 */
const WISH_MAX_PULL = 0.75;

export interface CrystalTint {
  /** Linear RGB in 0..1; pure white only when nothing was granted at all. */
  rgb: readonly [number, number, number];
  /** 0..1 rainbow strength on the facets. */
  iridescence: number;
}

const WHITE: CrystalTint = { rgb: [1, 1, 1], iridescence: 0 };

/**
 * Colour of the crystal from the wishes the couple granted each other.
 *
 * Not a literal RGB triple. Mapping counts straight onto channels would make a
 * couple with no gifts *black*, contradicting the white crystal every body is
 * born as.
 *
 * **Direction and depth are separate, and that is the fix.** They used not to
 * be: the hue was the three counts normalised by the largest of them, and the
 * pull was that largest count. Two consequences, both wrong, both measured on
 * real data:
 *
 * - **Equal counts cancelled.** Normalising three equal numbers gives
 *   `[1, 1, 1]`, and over white that is white. The live couple's fourth year
 *   granted 2 / 2 / 2 and published a tint of exactly `[1, 1, 1]` —
 *   indistinguishable from a couple who had granted nothing. The note this
 *   replaces called that the reward for balance, paid in iridescence. On screen
 *   it is the absence of colour, and the owner asked for it to be healed.
 * - **Depth read one channel only.** 3/3/3 and 3/0/0 pulled equally, so giving
 *   three times as much bought nothing.
 *
 * Now the **total** decides how far from white the crystal moves, so more
 * giving is always more colour; the **mix** decides which way, by blending
 * three mineral hues rather than three raw channels, so an even split lands on
 * the blend instead of on grey. Iridescence still rewards balance — now as a
 * second signal on top of a real colour rather than as a substitute for one.
 */
export function wishTint(tally: WishGiftTally): CrystalTint {
  const count = (value: number): number => Math.max(0, Number.isFinite(value) ? value : 0);
  const unit = (value: number): number => clamp01(count(value) / WISH_CHANNEL_CAP);
  const first = unit(tally.forFirst);
  const shared = unit(tally.shared);
  const second = unit(tally.forSecond);

  const spread = first + shared + second;
  if (spread <= 0) return WHITE;

  // How far from white: everything they granted, saturating.
  const depth = clamp01(
    (count(tally.forFirst) + count(tally.shared) + count(tally.forSecond)) / WISH_TOTAL_CAP,
  );
  // Which way: the three mineral hues in the proportion the couple gave them.
  const hue = (channel: number): number => (
    (WISH_HUE_FOR_FIRST[channel]! * first
      + WISH_HUE_SHARED[channel]! * shared
      + WISH_HUE_FOR_SECOND[channel]! * second) / spread
  );
  const pull = depth * WISH_MAX_PULL;

  const strongest = Math.max(first, shared, second);
  const weakest = Math.min(first, shared, second);

  return {
    rgb: [
      round6(1 - (1 - hue(0)) * pull),
      round6(1 - (1 - hue(1)) * pull),
      round6(1 - (1 - hue(2)) * pull),
    ],
    // Balance, scaled by how much there was to balance: one wish each is even,
    // but it is not yet a rainbow.
    iridescence: round6((weakest / strongest) * depth),
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
