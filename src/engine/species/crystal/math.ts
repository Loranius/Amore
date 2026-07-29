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
