import type { CrystalMaterialQuality } from '../material';

export interface CrystalRendererCapabilities {
  webgl: boolean;
  webgl2: boolean;
  deviceMemoryGb: number | null;
  hardwareConcurrency: number | null;
  devicePixelRatio: number;
}

/**
 * How much work the device can do per pixel.
 *
 * Memory and cores describe the device. Pixel ratio does not: it describes how
 * many pixels the screen asks for, and the answer to "too many pixels" is to
 * render fewer of them, not to take the iridescence off the crystal.
 *
 * That distinction used to be missing — `dpr >= 3` alone forced the lowest
 * optical tier, so a current flagship phone (eight cores, eight gigabytes,
 * ratio 3) was handed the same crystal as a four-year-old budget handset:
 * iridescence off, reflection at half strength. The couple with the best phone
 * saw the plainest artifact.
 *
 * Density still counts, but as a multiplier on the work the device has to do
 * rather than as a veto. The render scale in `crystalRenderScale` is where a
 * dense screen is actually paid for.
 */
export function resolveCrystalRendererQuality(
  capabilities: CrystalRendererCapabilities,
): CrystalMaterialQuality {
  if (!capabilities.webgl) return 'fallback';

  const memory = capabilities.deviceMemoryGb;
  const cores = capabilities.hardwareConcurrency;
  const dpr = Number.isFinite(capabilities.devicePixelRatio)
    ? Math.max(1, capabilities.devicePixelRatio)
    : 2;

  // Unknown hardware is never upgraded. Safari reports neither memory nor
  // cores, and guessing high there would hand a weak device the full pipeline.
  if (memory === null && cores === null) return 'low';
  if ((memory !== null && memory <= 4) || (cores !== null && cores <= 4)) return 'low';

  const strong = capabilities.webgl2
    && memory !== null
    && memory >= 8
    && cores !== null
    && cores >= 8;

  // A dense screen costs roughly dpr² fragments. A strong device absorbs a
  // ratio of 3 at reduced render scale and keeps its optics; past that the
  // fragment cost outruns any device we can detect.
  if (strong) return dpr > 3.5 ? 'balanced' : 'high';
  return 'balanced';
}

/**
 * Fraction of the device pixel ratio actually rendered.
 *
 * This is where a dense screen is paid for. Dropping render scale costs
 * sharpness, which a 3x screen has to spare; dropping the quality tier costs
 * iridescence and reflection, which is the crystal itself.
 */
export function crystalRenderScale(
  quality: CrystalMaterialQuality,
  devicePixelRatio: number,
): number {
  const dpr = Number.isFinite(devicePixelRatio) ? Math.max(1, devicePixelRatio) : 2;
  const ceiling = quality === 'high'
    ? 2
    : quality === 'balanced'
      ? 1.75
      : quality === 'low'
        ? 1.4
        : 1;
  return Math.min(dpr, ceiling);
}
