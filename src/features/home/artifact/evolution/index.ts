// ============================================================
// Evolution Engine (Volume I) — публічна поверхня шару. Вихід рушія (§15):
// Timeline, Events, Memory (ageDays), Forces, Historical State. Жодної
// геометрії, матеріалів чи форми — це територія шарів нижче.
// ============================================================
export type {
  EvolutionHistoryCounts,
  EvolutionTimeline,
} from './evolutionTypes';
export { buildEvolutionTimeline } from './evolutionEvents';
export { historyAt, solveForces, categoryShares, evenness } from './pressureSolver';
