import type { CrystalLifeConfig } from './types';

export const DEFAULT_CRYSTAL_LIFE_CONFIG: CrystalLifeConfig = {
  // 1.2.0 dropped `rotationSpeed`/`rotationY`: the artifact no longer turns
  // itself, so a published life state from 1.1.0 describes a motion this
  // version does not have.
  //
  // 1.3.0: `seededUnit` ділить хеш на 2³², а не на `0xffffffff`, тож більше
  // не повертає рівно 1 (ADR-0257). Ті самі входи дають ті самі стани з
  // точністю до шостого знака, але не всі: на 480 станах змінились 24
  // числа з 115 200, кожне на 1e-6. Стан 1.2.0 — інші числа, тож і версія інша.
  rulesVersion: '1.3.0',
  reducedMotion: false,
  quality: 'balanced',
  maxSparkles: 42,
  mediaFinishedCount: 0,
};
