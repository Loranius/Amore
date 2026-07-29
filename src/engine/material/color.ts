import type { EvolutionChannel, EvolutionPressureVector } from '../evolution';
import type { CrystalRgb } from './types';

const CHANNEL_COLORS: Record<EvolutionChannel, CrystalRgb> = {
  achievement: { r: 0.96, g: 0.64, b: 0.28 },
  remembrance: { r: 0.96, g: 0.47, b: 0.66 },
  exploration: { r: 0.35, g: 0.78, b: 0.89 },
  culture: { r: 0.64, g: 0.5, b: 0.92 },
  stability: { r: 0.42, g: 0.78, b: 0.58 },
  significance: { r: 0.94, g: 0.34, b: 0.54 },
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
