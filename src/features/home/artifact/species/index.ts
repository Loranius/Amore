// ============================================================
// Species Layer (Volume II) — публічна поверхня SDK. Новий вид додається
// одним файлом поруч (treeSpecies.ts, eggSpecies.ts, coralSpecies.ts…),
// що реалізує інтерфейс Species; Growth Engine споживає лише
// GrowthInstruction і не знає, що вирощує.
// ============================================================
export type { GrowthInstruction, Species } from './speciesTypes';
export { crystalSpecies } from './crystalSpecies';
export type { CrystalConstraints, CrystalInstruction, CrystalState } from './crystalSpecies';
