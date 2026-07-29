import type { GrowthEngineConfig } from './types';

export const DEFAULT_GROWTH_ENGINE_CONFIG: GrowthEngineConfig = {
  rulesVersion: '1.0.0',
  candidateCount: 12,
  minAngularSeparationRad: 0.42,
  collisionPadding: 0.035,
  maxBodies: 220,
};
