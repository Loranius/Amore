import {
  TREE_PRODUCTION_MOBILE_BUDGET,
  type TreeProductionMobileBudget,
} from '@/engine/productionAcceptance';

export type TreeLabAcceptanceBudget = Pick<
  TreeProductionMobileBudget,
  'maxVertices' | 'maxTriangles' | 'maxBuildMs' | 'maxDrawCalls'
>;

export interface TreeLabAcceptanceInput {
  vertices: number;
  triangles: number;
  buildMs: number;
  drawCalls: number | null;
}

export interface TreeLabAcceptanceResult {
  status: 'warming' | 'pass' | 'fail';
  violations: string[];
}

/** @deprecated Production code uses TREE_PRODUCTION_MOBILE_BUDGET. */
export const TREE_LAB_MOBILE_BUDGET: TreeLabAcceptanceBudget = TREE_PRODUCTION_MOBILE_BUDGET;

/**
 * Compatibility wrapper for older phase tests. Production rendering now uses
 * evaluateTreeProductionRuntimeAcceptance with the published static contract.
 */
export function evaluateTreeLabAcceptance(
  input: TreeLabAcceptanceInput,
  budget: TreeLabAcceptanceBudget = TREE_LAB_MOBILE_BUDGET,
): TreeLabAcceptanceResult {
  const violations: string[] = [];
  if (input.vertices > budget.maxVertices) violations.push('vertices');
  if (input.triangles > budget.maxTriangles) violations.push('triangles');
  if (input.buildMs > budget.maxBuildMs) violations.push('build-ms');
  if (input.drawCalls !== null && input.drawCalls > budget.maxDrawCalls) {
    violations.push('draw-calls');
  }

  if (input.drawCalls === null) return { status: 'warming', violations };
  return { status: violations.length === 0 ? 'pass' : 'fail', violations };
}
