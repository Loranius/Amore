import type { EvolutionChannel, EvolutionPressureVector } from '../evolution';
import type { CrystalRgb } from './types';

/**
 * What each pressure channel colours the stone.
 *
 * **All six live on one rose-to-amethyst arc, and that is the requirement
 * rather than a preference.** The set this replaces spanned the wheel — amber
 * for achievement, cyan for exploration, green for stability — and the palette
 * mixes the dominant channel into the shell, so a couple who travel a lot got a
 * *cyan* crystal and a steady one got a green stone. The brief forbids exactly
 * that: one family from any angle, and no hue drift between couples or between
 * faces.
 *
 * The channels still separate, they separate *within* the family: warm rose at
 * one end, violet at the other. Green is the lowest channel in every one of
 * them, which is what keeps a face from ever reading as yellow — yellow needs
 * green high, and nothing here has it.
 */
const CHANNEL_COLORS: Record<EvolutionChannel, CrystalRgb> = {
  achievement: { r: 0.98, g: 0.52, b: 0.66 },
  remembrance: { r: 0.96, g: 0.47, b: 0.7 },
  exploration: { r: 0.72, g: 0.55, b: 0.95 },
  culture: { r: 0.68, g: 0.48, b: 0.94 },
  stability: { r: 0.84, g: 0.55, b: 0.86 },
  significance: { r: 0.94, g: 0.38, b: 0.72 },
};

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function rgb(r: number, g: number, b: number): CrystalRgb {
  return { r: round6(clamp01(r)), g: round6(clamp01(g)), b: round6(clamp01(b)) };
}

export function mixRgb(left: CrystalRgb, right: CrystalRgb, amount: number): CrystalRgb {
  const t = clamp01(amount);
  return rgb(
    left.r * (1 - t) + right.r * t,
    left.g * (1 - t) + right.g * t,
    left.b * (1 - t) + right.b * t,
  );
}

export function scaleRgb(color: CrystalRgb, factor: number): CrystalRgb {
  return rgb(color.r * factor, color.g * factor, color.b * factor);
}

export function weightedChannelColor(shares: EvolutionPressureVector): CrystalRgb {
  const channels = Object.keys(CHANNEL_COLORS) as EvolutionChannel[];
  const total = channels.reduce((sum, channel) => sum + Math.max(0, shares[channel]), 0);
  if (total <= 1e-9) return { r: 0.93, g: 0.49, b: 0.66 };

  let r = 0;
  let g = 0;
  let b = 0;
  for (const channel of channels) {
    const weight = Math.max(0, shares[channel]) / total;
    const color = CHANNEL_COLORS[channel];
    r += color.r * weight;
    g += color.g * weight;
    b += color.b * weight;
  }
  return rgb(r, g, b);
}

export function crystalChannelColor(channel: EvolutionChannel | null): CrystalRgb {
  return channel === null ? { r: 0.93, g: 0.49, b: 0.66 } : CHANNEL_COLORS[channel];
}

export function rgbSignature(color: CrystalRgb): string {
  return `${color.r.toFixed(6)},${color.g.toFixed(6)},${color.b.toFixed(6)}`;
}
