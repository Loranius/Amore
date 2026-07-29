import { describe, expect, it } from 'vitest';
import { evaluateTreeLabAcceptance, TREE_LAB_MOBILE_BUDGET } from './acceptance';

describe('Tree Lab mobile acceptance', () => {
  it('waits for renderer metrics before passing', () => {
    expect(evaluateTreeLabAcceptance({
      vertices: 2_000,
      triangles: 4_000,
      buildMs: 10,
      drawCalls: null,
    })).toEqual({ status: 'warming', violations: [] });
  });

  it('passes a preview inside every published limit', () => {
    expect(evaluateTreeLabAcceptance({
      vertices: TREE_LAB_MOBILE_BUDGET.maxVertices,
      triangles: TREE_LAB_MOBILE_BUDGET.maxTriangles,
      buildMs: TREE_LAB_MOBILE_BUDGET.maxBuildMs,
      drawCalls: TREE_LAB_MOBILE_BUDGET.maxDrawCalls,
    })).toEqual({ status: 'pass', violations: [] });
  });

  it('reports every exceeded budget independently', () => {
    expect(evaluateTreeLabAcceptance({
      vertices: TREE_LAB_MOBILE_BUDGET.maxVertices + 1,
      triangles: TREE_LAB_MOBILE_BUDGET.maxTriangles + 1,
      buildMs: TREE_LAB_MOBILE_BUDGET.maxBuildMs + 1,
      drawCalls: TREE_LAB_MOBILE_BUDGET.maxDrawCalls + 1,
    })).toEqual({
      status: 'fail',
      violations: ['vertices', 'triangles', 'build-ms', 'draw-calls'],
    });
  });
});
