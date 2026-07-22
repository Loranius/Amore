// ============================================================
// Growth Engine (Volume III) — публічна поверхня. Вхід: GrowthInstruction
// (Species Layer). Вихід: Growth State → Geometry Engine (crystal3d/).
// Спільні solver-модулі (Surface Map ../growthSurface, Stress/Density/
// Competition ../growthField) лишаються на рівні artifact/ як бібліотека,
// яку рушій оркеструє й на яку Species Layer замикає instruction.fieldAt.
// ============================================================
export type { GrowthState, GrowthBody } from './growthTypes';
export { runGrowth, depositMineralMass, depositMineralMassWithScore, makeNucleus } from './growthEngine';
