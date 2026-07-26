const MIN_FOREGROUND_RATIO = 0.06;
const MAX_FOREGROUND_RATIO = 0.92;
const MIN_STRONG_FOREGROUND_RATIO = 0.018;

export function portraitMaskLooksUsable(values: Float32Array): boolean {
  if (values.length === 0) return false;

  let foreground = 0;
  let strongForeground = 0;
  for (const value of values) {
    if (value >= 0.34) foreground += 1;
    if (value >= 0.72) strongForeground += 1;
  }

  const foregroundRatio = foreground / values.length;
  const strongRatio = strongForeground / values.length;
  return foregroundRatio >= MIN_FOREGROUND_RATIO
    && foregroundRatio <= MAX_FOREGROUND_RATIO
    && strongRatio >= MIN_STRONG_FOREGROUND_RATIO;
}
