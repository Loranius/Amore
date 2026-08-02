import { EVOLUTION_CHANNELS, stableHash32, type EvolutionChannel, type EvolutionPressureVector } from '../../evolution';
import { parseEvolutionInstant } from '../../evolution/calendar';

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function saturate(value: number, halfSaturation: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return round6(value / (value + halfSaturation));
}

export function vectorTotal(vector: EvolutionPressureVector): number {
  return EVOLUTION_CHANNELS.reduce((total, channel) => total + vector[channel], 0);
}

export function normalizedShares(vector: EvolutionPressureVector): EvolutionPressureVector {
  const total = vectorTotal(vector);
  if (total <= 0) {
    return {
      achievement: 0,
      remembrance: 0,
      exploration: 0,
      culture: 0,
      stability: 0,
      significance: 0,
    };
  }

  return {
    achievement: round6(vector.achievement / total),
    remembrance: round6(vector.remembrance / total),
    exploration: round6(vector.exploration / total),
    culture: round6(vector.culture / total),
    stability: round6(vector.stability / total),
    significance: round6(vector.significance / total),
  };
}

export function dominantChannel(
  vector: EvolutionPressureVector,
): { channel: EvolutionChannel | null; share: number } {
  const shares = normalizedShares(vector);
  let channel: EvolutionChannel | null = null;
  let share = 0;

  for (const candidate of EVOLUTION_CHANNELS) {
    if (shares[candidate] > share) {
      channel = candidate;
      share = shares[candidate];
    }
  }

  return { channel, share: round6(share) };
}

/** 0 = one channel dominates completely, 1 = all six channels are even. */
export function channelEvenness(vector: EvolutionPressureVector): number {
  const shares = normalizedShares(vector);
  const entropy = EVOLUTION_CHANNELS.reduce((sum, channel) => {
    const value = shares[channel];
    return value > 0 ? sum - value * Math.log(value) : sum;
  }, 0);
  return round6(clamp01(entropy / Math.log(EVOLUTION_CHANNELS.length)));
}

/** Deterministic Mulberry32 sample in [0, 1). */
export function seededUnit(seed: number, salt: string): number {
  let state = stableHash32(`${seed}\u001f${salt}`) >>> 0;
  state = (state + 0x6d2b79f5) >>> 0;
  let value = state;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
}

export function stableSeed(seed: number, salt: string): number {
  return stableHash32(`${seed}\u001f${salt}`);
}

export function daysBetweenExplicit(earlier: string, later: string): number | null {
  const start = parseEvolutionInstant(earlier);
  const end = parseEvolutionInstant(later);
  if (start === null || end === null) return null;
  return Math.max(0, Math.floor((end - start) / 86_400_000));
}

export function maturityAt(occurredAt: string, asOf: string, halfLifeDays: number): number {
  const ageDays = daysBetweenExplicit(occurredAt, asOf);
  if (ageDays === null || ageDays <= 0) return 0;
  return round6(clamp01(ageDays / (ageDays + halfLifeDays)));
}

/**
 * How long the relationship has to run before the monarch crystal is
 * essentially full-grown. Deliberately measured in years, not months.
 */
export const RELATIONSHIP_GROWTH_HORIZON_DAYS = 1600;

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
