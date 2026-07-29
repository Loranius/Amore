export interface TreeLabAcceptanceBudget {
  maxVertices: number;
  maxTriangles: number;
  maxBuildMs: number;
  maxDrawCalls: number;
}

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

export const TREE_LAB_MOBILE_BUDGET: TreeLabAcceptanceBudget = {
  maxVertices: 12_000,
  maxTriangles: 16_000,
  maxBuildMs: 80,
  maxDrawCalls: 2,
};

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
