import type { CrystalLifeConfig } from './types';

export const DEFAULT_CRYSTAL_LIFE_CONFIG: CrystalLifeConfig = {
  // 1.2.0 dropped `rotationSpeed`/`rotationY`: the artifact no longer turns
  // itself, so a published life state from 1.1.0 describes a motion this
  // version does not have.
  rulesVersion: '1.2.0',
  reducedMotion: false,
  quality: 'balanced',
  maxSparkles: 42,
  mediaFinishedCount: 0,
};
