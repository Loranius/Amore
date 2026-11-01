import { clamp01, daysBetweenExplicit, round6 } from '../shared/math';

// Спільне для всіх видів — `species/shared/math.ts`; тут лише своє.
export {
  channelEvenness,
  clamp01,
  daysBetweenExplicit,
  dominantChannel,
  maturityAt,
  normalizedShares,
  round6,
  saturate,
  seededUnit,
  stableSeed,
} from '../shared/math';

/**
 * How long the relationship has to run before the monarch crystal is
 * essentially full-grown. Deliberately measured in years, not months.
 */
const RELATIONSHIP_GROWTH_HORIZON_DAYS = 1600;

/**
 * Maturity of the relationship itself, used for the monarch crystal's size.
 *
 * This is a different quantity from `maturityAt`, and it needs a different
 * curve. An *event's* influence is supposed to settle quickly and then hold,
 * so its half-life is measured in weeks — that is why `maturityAt` saturates
 * fast, and that stays correct for events.
 *
 * The monarch's size instead has to keep answering "how long have we been
 * together?" across the entire plausible range of couples, from a few weeks
 * to a few decades. Reusing the event curve at a 180-day half-life failed
 * that badly: a 3-year relationship already rendered ~96% of the size of a
 * 10-year one (and a 6-month one ~77%), so essentially every couple saw the
 * same fully-grown crystal regardless of their actual history.
 *
 * `1 - exp(-days / horizon)` keeps real separation over that range
 * (≈0.20 at 1 year, ≈0.50 at 3 years, ≈0.90 at 10 years) while still
 * saturating, so a very long relationship approaches a limit instead of
 * growing without bound.
 */
export function relationshipMaturityAt(startedAt: string, asOf: string): number {
  const ageDays = daysBetweenExplicit(startedAt, asOf);
  if (ageDays === null || ageDays <= 0) return 0;
  return round6(clamp01(1 - Math.exp(-ageDays / RELATIONSHIP_GROWTH_HORIZON_DAYS)));
}
