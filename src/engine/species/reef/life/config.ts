import type { ReefLifeConfig } from './types';

export const DEFAULT_REEF_LIFE_CONFIG: ReefLifeConfig = {
  rulesVersion: 'reef-life-v1.0.0',
  maximumMotionBindings: 512,
  baseCurrentStrength: 0.42,
  currentTurbulence: 0.18,
  minimumCurrentCycleSeconds: 8,
  maximumCurrentCycleSeconds: 14,
  maximumSwayRadians: 0.18,
  maximumPolypPulseAmplitude: 0.12,
};
