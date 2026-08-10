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
 * height-to-full-width ratios.
 *
 * **A cut gem, not a quartz rod.** The owner's reference measures 2.3 by
 * silhouette and the brief sets the target band at 1.80–2.10 with a typical
 * 1.92, against the 3.8–6.2 that stood here. That is not a tuning step, it is a
 * different body, and three other things fall into place with it rather than
 * needing their own numbers:
 *
 * - the crown. Its drop is `radius · tan(crown angle)`, so at 1.92 the lattice's
 *   own angle already spends **26–34%** of the height on the termination, which
 *   is the band the brief asks for. On a 5:1 rod the same angle spends 13%,
 *   which is the "small cap on a long prism" the reference is not;
 * - where the body is widest. The shaft flares upward and the crown starts at
 *   the shoulder, so the widest slice lands at `1 − crownShare` — **66–74%** of
 *   the height, against the brief's 58–72%;
 * - how much of the frame it fills. A wide artifact is width-bound on a phone,
 *   which is why the camera had to start solving its frame at the artifact's
 *   near side before this could land at all.
 *
 * Activity still moves the proportion inside the band, so a couple who put more
 * in still gets a stouter stone.
 *
 * **The numbers here are nominal, not the silhouette.** Three things stand
 * between this ratio and the one a ruler measures on the finished body: the
 * prism flare widens the shoulder by `1 + f/2`, the monarch's cross-section is
 * 6% wider in Z than round, and she is sunk a tenth of her length into the vein
 * so the mesh is taller than the visible crystal. Measured across four couples
 * and four ages, the finished aspect comes out at **0.84×** the number here —
 * so the band is set at 2.14–2.50 to land the silhouette on the brief's
 * 1.80–2.10. `__silhouette` measures the built mesh rather than trusting this.
 */
/**
 * **Halved on the owner's instruction (2026-08-10), looking at the portal.**
 *
 * > «Кристал монарх занадто широкий, зменш його діаметр трохи, десь в половину»
 *
 * Doubling the aspect halves the diameter, since `radius = axial / (2·aspect)`.
 * Measured on the built mesh, the finished silhouette moves from 1.89–2.16 to
 * 3.78–4.32, so this **supersedes the brief's §2 band of 1.80–2.10** rather
 * than sitting inside it. Recorded rather than reconciled: the owner is looking
 * at the rendered crystal, and the band was a number written before there was
 * one to look at.
 *
 * Two of the three things the paragraph below says fall out of the ratio move
 * with it, and both are consequences rather than surprises:
 *
 * - the crown's drop is `radius · tan(crown angle)`, so halving the radius
 *   halves the share of the height the termination spends — 26–34% becomes
 *   13–17%, which is the "small cap on a long prism" the gem pass moved away
 *   from. It is what a narrower body geometrically *is* at a fixed lattice
 *   angle; changing the angle to hold the old share would make the crystal
 *   stop obeying quartz;
 * - the widest slice stays where it was as a share of the height, because the
 *   flare and the shoulder are both fractions rather than distances.
 *
 * The root compensates separately: its own height is a multiple of the
 * monarch's radius, so without a change there it would have halved too and
 * dropped out of the brief's §4 band. See `VEIN_PROUD`.
 */
const MONARCH_STOUTEST_ASPECT = 4.28;
const MONARCH_SLIMMEST_ASPECT = 5;

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
 * How many years a colony seats before its members start giving up room.
 *
 * Up to this many, every child is the owner's original half of the monarch.
 * Past it they take a smaller share each — which is real mineralogy rather than
 * a framing trick: crystals nucleating on one crowded seam compete for the same
 * material, and a vug with thirty members has thirty small ones and a few
 * large, not thirty of the largest.
 */
const CHILD_SHARE_FREE_COLONY = 4;

/**
 * How fast the share falls once the colony is crowded, as a power of its size.
 *
 * **Bounded by an invariant, not chosen for looks.** A closed year's crystal may
 * never shrink, and each new year both adds a member and grows the monarch —
 * so the share may fall no faster than the monarch rises. The monarch is
 * `t^0.72` to the full term, and against the four-year colony the worst ratio
 * is at thirty years: `ln(1.4/0.527) / ln(30/4) = 0.486`. Anything at or under
 * that is safe; 0.35 leaves a third of the margin and still takes a
 * twenty-year colony's radius down by nearly half.
 */
const CHILD_SHARE_FALLOFF = 0.35;

/**
 * A child's share of the monarch, from how crowded the colony is.
 *
 * Was the flat `CHILD_MONARCH_SHARE`, and that held while a druse was small.
 * Measured once the ring was pulled in and the children thickened to the
 * reference's proportions: a twenty-year colony reached **2.23 scene units
 * wide against 2.36 tall** — a disc rather than a spire, and on a portrait
 * phone a disc that wide forces the camera so far back that the artifact
 * renders *smaller* than a four-year one. Twenty bodies of width `2r` need
 * `20·2r` of circumference whatever else is true, so the only lever that
 * answers is `r` itself.
 */
export function childMonarchShare(colonySize: number): number {
  const size = Number.isFinite(colonySize) ? Math.max(1, Math.floor(colonySize)) : 1;
  if (size <= CHILD_SHARE_FREE_COLONY) return CHILD_MONARCH_SHARE;
  return round6(
    CHILD_MONARCH_SHARE * Math.pow(size / CHILD_SHARE_FREE_COLONY, -CHILD_SHARE_FALLOFF),
  );
}
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
/**
 * Years per ring before a new, wider ring opens.
 *
 * Eight while nothing checked whether a ring could seat its members — which is
 * why two of a nine-year couple's first-ring crystals ended up inside each
 * other. Now that `ringSeatingRadius` guarantees the fit, a ring's capacity is
 * a question about *depth* rather than about crowding, and a second ring is
 * expensive: it costs a whole ring step of width on a portrait screen. Sixteen
 * keeps most couples to one ring and a very long one to two.
 */
export const CHILD_RING_CAPACITY = 16;
/**
 * The air between one ring of years and the next, beyond the bodies themselves.
 *
 * A constant `0.2` stood here, and it was a ring *step* rather than a gap —
 * which held only while a child was slim. Thickening the children to the
 * reference cluster's aspect (`childDimensions`) took a twenty-five-year
 * child's radius from 0.074 to 0.105, so two adjacent rings needed 0.21 and had
 * 0.20: the sweep put ring 2 **0.051 inside** ring 1. Deriving the step from the
 * widest body a ring can hold is what makes it survive the next change to their
 * proportions.
 *
 * Kept deliberately tight. A looser ring made the druse far wider than tall,
 * and on a portrait phone that is not a tuning problem but a geometric one: an
 * object wider than the screen is wide can never fill the screen's height,
 * whatever the camera does.
 *
 * The other constant that used to live here was `CHILD_EVENT_REACH`: an extra
 * standoff that a year's important events could close, so a busy year drew its
 * crystal toward the monarch while the clearance floor guaranteed it could
 * never reach her. The owner asked for one common vein and named that mechanism
 * as the thing in the way — a crystal reaching for the monarch it can never
 * join. It is gone, and no term now stands between a child's base and the
 * monarch's but the floor.
 */
const CHILD_RING_GAP = 0.03;

/** How much further out each successive ring of years sits. */
export function childRingStep(widestChildRadialScale: number): number {
  const widest = Number.isFinite(widestChildRadialScale)
    ? Math.max(0, widestChildRadialScale)
    : 0;
  return round6(widest * 2 + CHILD_RING_GAP);
}

/**
 * The smallest radius a ring can have and still seat everything standing in it.
 *
 * A ring is a circle, and `n` bodies of width `2r` with a gap between them need
 * `n·(2r + gap)` of circumference — so the radius has a floor of its own that
 * has nothing to do with the monarch. Leaving it out is what put two of a
 * nine-year couple's eight first-ring crystals **0.0014 into each other**: the
 * arithmetic floor said 0.158, the ring needed 0.233, and nothing in the
 * placement was asking the question.
 *
 * Measured against how many bodies the ring **actually holds**, not the
 * capacity it could hold. A young couple is the case the owner looks at, and
 * sizing their two-crystal ring for eight would push it out for no reason. The
 * cost is that a new year nudges its ring outward — which is honest: the colony
 * makes room.
 */
export function ringSeatingRadius(occupancy: number, bodyRadialScale: number): number {
  const seats = Number.isFinite(occupancy) ? Math.max(0, Math.floor(occupancy)) : 0;
  const radius = Number.isFinite(bodyRadialScale) ? Math.max(0, bodyRadialScale) : 0;
  if (seats <= 1) return 0;
  return round6((seats * (radius * 2 + CHILD_RING_GAP)) / (Math.PI * 2));
}

export function childRingIndex(yearIndex: number): number {
  return Math.max(0, Math.floor(yearIndex / CHILD_RING_CAPACITY));
}

export interface ChildDimensions {
  axialScale: number;
  radialScale: number;
}

/**
 * Portal modules a year can draw on: calendar, plans, wishlist, map,
 * memories, media.
 *
 * Shopping was here and is not any more, and media was not and now is
 * (ADR-0017). Both were the same defect from opposite ends: a convenience
 * module counted as a part of the relationship the year had touched, while a
 * year spent watching and reading together counted as nothing at all.
 *
 * Kept here as a number rather than imported from the adapter layer, which
 * Volume II has no business reaching into. `portalModules.test.ts` checks it
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

/**
 * Shared days off in a whole year that count as "as much time together as this
 * measure can see".
 *
 * Two people on shifts who land the same day off five times a month are living
 * a different relationship from two who manage it twice a year, and no module
 * in the portal was saying so. Sixty is a rate rather than a ceiling on the
 * couple: past it the year is simply full on this axis.
 */
export const SHARED_DAYS_OFF_FULL_YEAR = 60;

/**
 * How much of the gap between a year's activity and a full year time together
 * can close.
 *
 * **Additive, never subtractive, and that is the whole design.** The first
 * version blended the two — `0.65·activity + 0.35·togetherness` — and a test
 * caught what that means in practice: a couple who starts keeping the work
 * schedule and has a genuinely quiet year gets `togetherness = 0`, so their
 * already-published year crystal *shrinks*. Adopting a module may never cost a
 * couple anything they already had; that is the same rule ADR-0004 states for
 * facets, and it applies to every signal that arrives late.
 *
 * Half, so a year lived entirely together but recorded nowhere still reads as
 * less full than a year that was both.
 */
const TOGETHERNESS_LIFT = 0.5;

/**
 * How much of a year the two of them actually had off together, 0 to 1.
 *
 * Counted flat against a whole year rather than against the months the schedule
 * happens to cover, and the live data is what decided that. The first version
 * normalised by coverage — an honest-looking idea: two covered months at a good
 * rate should read as a good year. On the owner's own portal that turned 18
 * shared days off across two covered months into a *full* year on this axis,
 * because 18 days in two months extrapolates to 108 in twelve. One good stretch
 * of a newly adopted module was outvoting everything the couple had recorded.
 *
 * Flat counting says only what is known: eighteen days is eighteen days, worth
 * 30% of the lift, and the couple earns the rest by keeping the schedule. It
 * cannot punish thin coverage either, because the lift is additive — a year the
 * schedule says nothing about simply gets nothing, which is what it should get.
 */
export function yearTogetherness(sharedDaysOff: number): number {
  const days = Number.isFinite(sharedDaysOff) ? Math.max(0, sharedDaysOff) : 0;
  return round6(clamp01(days / SHARED_DAYS_OFF_FULL_YEAR));
}

/**
 * @param togetherness 0 when the work schedule says nothing about this year,
 * which leaves the fill exactly as activity alone would have set it.
 */
export function yearFill(
  progress: number,
  activity: number,
  togetherness = 0,
): number {
  const recorded = clamp01(activity);
  const lived = recorded + (1 - recorded) * TOGETHERNESS_LIFT * clamp01(togetherness);
  return round6(clamp01(progress) * (EMPTY_YEAR_FLOOR + (1 - EMPTY_YEAR_FLOOR) * lived));
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
/**
 * How tall a child may stand against the monarch, as a share of her height.
 *
 * The brief's band. The floor matters as much as the ceiling: a year with
 * almost nothing in it still has to read as a crystal in the ring rather than
 * as a chip, and `yearFill`'s own floor alone let one fall to 15%.
 */
const CHILD_HEIGHT_MIN_SHARE = 0.18;
const CHILD_HEIGHT_MAX_SHARE = 0.52;

/**
 * A child's own height-to-width ratio, seeded inside the brief's 2.5–3.2.
 *
 * Seeded rather than fixed because the reference cluster's daughters are not
 * one shape: measured on it, 2.1 to 3.7. A single divisor gave every child the
 * same silhouette at a different size, which is the "scaled monarch" Pass 9
 * removed from their habit and would have quietly reintroduced through their
 * proportions.
 *
 * Nominal, like the monarch's band: the archetype's anisotropy widens a child
 * by up to 1.18 and its own flare by another 1.05, so the finished silhouette
 * comes out at about **0.75×** this. 3.4–4.3 lands the measured aspect on the
 * brief's 2.5–3.2.
 */
const CHILD_ASPECT_MIN = 3.4;
const CHILD_ASPECT_MAX = 4.3;

export function childDimensions(
  monarchAxialNow: number,
  fill: number,
  colonySize = 1,
  seed = 0,
): ChildDimensions {
  // The fill is mapped **into** the band rather than clamped against it. A
  // clamp looked equivalent and was not: a quiet year sat exactly on the floor,
  // so adding content to it moved nothing at all — the growth engine's own
  // "a later event still grows the year in progress" test caught it, comparing
  // 0.080642 with 0.080642. Mapping keeps every year responsive across the
  // whole range while still landing inside the brief's 18–52%.
  const t = clamp01(childMonarchShare(colonySize) * clamp01(fill) / CHILD_MONARCH_SHARE);
  const axialScale = round6(monarchAxialNow * (
    CHILD_HEIGHT_MIN_SHARE + (CHILD_HEIGHT_MAX_SHARE - CHILD_HEIGHT_MIN_SHARE) * t
  ));
  // Slimmer than the monarch, and by a wide margin now that she is a gem: she
  // sits near 1.9 and they sit near 2.9, so she reads as the one body the ring
  // is arranged around rather than as the largest of seven similar ones.
  const aspect = CHILD_ASPECT_MIN
    + seededUnit(seed, 'child:aspect') * (CHILD_ASPECT_MAX - CHILD_ASPECT_MIN);
  return { axialScale, radialScale: round6(axialScale / (2 * aspect)) };
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
  widestChildRadialScale: number;
  ringIndex: number;
  ringOccupancy: number;
}): number {
  const againstMonarch = input.monarchRadialScale
    + input.childRadialScale
    + childClearance(input.monarchRadialScale, input.childRadialScale);
  const againstSiblings = ringSeatingRadius(input.ringOccupancy, input.widestChildRadialScale);
  return round6(
    Math.max(againstMonarch, againstSiblings)
    + input.ringIndex * childRingStep(input.widestChildRadialScale),
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
 * Outside **every** ring of years, so the skirt reads as a hem around the whole
 * colony rather than as gravel dropped between its members. Uses the widest a
 * year crystal could be rather than the years this couple actually filled, so a
 * couple who backfills an empty year later does not find their plan crystals
 * suddenly overlapped by it.
 *
 * `outermostRingIndex` is the one thing here that is not a proportion, and
 * leaving it out is what let a nine-year couple's ring 1 sit **0.032 inside**
 * its own skirt. A hem that only clears the first ring is not a hem.
 */
export function skirtDistance(input: {
  monarchRadialScale: number;
  widestChildRadialScale: number;
  skirtRadialScale: number;
  outermostRingIndex: number;
  outermostRingOccupancy: number;
  skirtCount: number;
}): number {
  const ring = Number.isFinite(input.outermostRingIndex)
    ? Math.max(0, Math.floor(input.outermostRingIndex))
    : 0;
  const outermostYearRing = Math.max(
    input.monarchRadialScale
      + childClearance(input.monarchRadialScale, input.widestChildRadialScale)
      + input.widestChildRadialScale,
    ringSeatingRadius(input.outermostRingOccupancy, input.widestChildRadialScale),
  ) + ring * childRingStep(input.widestChildRadialScale);

  return round6(Math.max(
    outermostYearRing
      + input.widestChildRadialScale
      + input.skirtRadialScale
      + SKIRT_CLEARANCE,
    // The hem is a circle too, and it holds up to twenty-four bodies.
    ringSeatingRadius(input.skirtCount, input.skirtRadialScale),
  ));
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
 * Away from the axis, never toward it — the lean and the placement share one
 * azimuth — so a lean can only ever increase the clearance `childDistance`
 * already guarantees.
 *
 * **45–55°, then 30–58°, now 7–26°, and the reference is what settled it.**
 * The owner supplied a low-poly quartz cluster and asked for the arrangement to
 * be adapted from it. Measured on its six crystals, by principal axis in each
 * body's own frame: **1.1°, 1.3°, 1.5°, 2.0°, 3.6°, 4.1° off vertical.** Every
 * one of them stands. A real vug does not fan; the crystals nucleate on one
 * seam and race the same way, and what varies between them is size, not
 * bearing.
 *
 * The wide band came from reading Pass 1's "placement feels positioned" as a
 * call for spread, and spread is what a starburst is. The band survives — a
 * colony whose members all lean identically is arranged rather than grown — but
 * around upright rather than around a crown, which is what turns the ring into
 * the skirt the owner asked for: bodies hugging the monarch's foot instead of
 * pointing away from it.
 *
 * The floor is not zero. At exactly 0° a child's axis is parallel to the
 * monarch's, so the clearance at the base is the clearance everywhere and a
 * body's whole length runs at the arithmetic minimum. Seven degrees over a
 * child four radii long carries its tip about half its own width further out,
 * which is what keeps the guarantee a margin rather than a knife edge.
 *
 * The old maximum stopped at 58° for a reason that no longer binds: a body
 * standing in the ground must rise more than it reaches, and 58° off the
 * monarch is 32° above the platform (sin 32° = 0.530). At 26° that is 64° above
 * the platform, sin = 0.899, with room to spare. `CHILD_MIN_UPWARD` is still
 * derived from the maximum rather than hand-set, so `ensureUpward` follows the
 * band instead of quietly standing the steepest children back up.
 */
export const CHILD_TILT_MIN_DEG = 5;
export const CHILD_TILT_MAX_DEG = 16;

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

// ── Lights inside the monarch, from media ───────────────────

/**
 * How many finished films, series and books saturate the couple's share.
 *
 * Square root all the way, because the difference between twenty watched and
 * forty should be visible while the difference between four hundred and eight
 * hundred is not worth another light.
 */
const MEDIA_SPARK_FULL = 120;

/**
 * The couple's media history as a 0–1 share, for whoever is placing lights.
 *
 * A **share, not a count**, and that is a correction. This returned a count
 * with a floor of six and a caller-supplied cap, which was right while it drove
 * a cloud of dust whose size was its only variable. The lights now live inside
 * the monarch inside a band per quality tier (brief §9), and folding a floored
 * count into a band clipped the signal away at the bottom: a couple with
 * twenty-five finished titles and a couple with none both came out at the
 * band's floor of twenty-four, so adding a whole shelf of books moved nothing.
 * Returning the share lets the caller map it across its own band instead, and
 * every part of the range does something.
 */
export function mediaSparkReach(finishedCount: number): number {
  const finished = Number.isFinite(finishedCount) ? Math.max(0, finishedCount) : 0;
  return round6(clamp01(Math.sqrt(finished) / Math.sqrt(MEDIA_SPARK_FULL)));
}
