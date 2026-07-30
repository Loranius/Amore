import { describe, expect, it } from 'vitest';
import {
  TREE_PRODUCTION_MOBILE_BUDGET,
  TREE_PRODUCTION_PIPELINE_PHASES,
} from './config';
import { resolveTreeProductionAsOf } from './asOf';
import {
  buildTreeProductionAcceptance,
  evaluateTreeProductionRuntimeAcceptance,
} from './treeProductionAcceptance';
import type { BuildTreeProductionAcceptanceInput } from './types';

function input(): BuildTreeProductionAcceptanceInput {
  const leafIds = ['leaf:0', 'leaf:1', 'leaf:2'];
  return {
    coupleId: 'amore:test-couple',
    artifactSeed: 42,
    lod: 'medium',
    asOf: '2026-07-30T12:00:00.000Z',
    asOfPolicy: 'couple-day',
    phases: TREE_PRODUCTION_PIPELINE_PHASES.map((id) => ({
      id,
      rulesVersion: `${id}-v1`,
      fingerprint: `${id}-fingerprint`,
    })),
    identities: {
      sourceLeafIds: leafIds,
      canopyDepthLeafIds: leafIds,
      canopyLightLeafIds: leafIds,
      phenologyLeafIds: leafIds,
      leafOrientationLeafIds: leafIds,
      crownSilhouetteLeafIds: leafIds,
      lifeLeafIds: leafIds.slice(0, 2),
    },
    preservation: {
      negativeSpaceAccepted: true,
      groundAnchored: true,
      terrainMergedIntoStaticGeometry: true,
      soilTerrainTintPreserved: true,
      barkGeometryPreserved: true,
      groundDetailsAnchored: true,
      groundDetailPrefixPreserved: true,
    },
    budgets: {
      vertices: 8_000,
      triangles: 12_000,
      estimatedDrawCalls: 4,
      materials: 3,
      leafInstances: leafIds.length,
      estimatedMatrixUpdatesPerFrame: 2,
    },
  };
}

describe('Tree Production Acceptance', () => {
  it('publishes one deterministic passing contract for the complete phase order', () => {
    const first = buildTreeProductionAcceptance(input());
    const second = buildTreeProductionAcceptance(input());

    expect(second).toEqual(first);
    expect(first.staticStatus).toBe('pass');
    expect(first.violations).toEqual([]);
    expect(first.phaseCheckpoints).toHaveLength(TREE_PRODUCTION_PIPELINE_PHASES.length);
    expect(first.diagnostics.phaseOrderPreserved).toBe(true);
    expect(first.diagnostics.phaseFingerprintsPresent).toBe(true);
    expect(first.diagnostics.leafIdentityChainPreserved).toBe(true);
    expect(first.diagnostics.lifeLeafPrefixPreserved).toBe(true);
    expect(first.descriptor.id).toBe('tree:production-acceptance:contract');
  });

  it('rejects reordered phases and a broken accepted leaf chain without throwing away diagnostics', () => {
    const broken = input();
    broken.phases = [...broken.phases].reverse();
    broken.identities = {
      ...broken.identities,
      crownSilhouetteLeafIds: ['leaf:1', 'leaf:0', 'leaf:2'],
      lifeLeafIds: ['leaf:1'],
    };

    const state = buildTreeProductionAcceptance(broken);
    expect(state.staticStatus).toBe('fail');
    expect(state.violations).toEqual(expect.arrayContaining([
      'phase-order',
      'leaf-identity-chain',
      'life-leaf-prefix',
    ]));
  });

  it('combines static acceptance with runtime build and draw-call metrics', () => {
    const contract = buildTreeProductionAcceptance(input());

    expect(evaluateTreeProductionRuntimeAcceptance({
      contract,
      buildMs: 20,
      drawCalls: null,
    })).toEqual({ status: 'warming', violations: [] });

    expect(evaluateTreeProductionRuntimeAcceptance({
      contract,
      buildMs: TREE_PRODUCTION_MOBILE_BUDGET.maxBuildMs,
      drawCalls: TREE_PRODUCTION_MOBILE_BUDGET.maxDrawCalls,
    })).toEqual({ status: 'pass', violations: [] });

    expect(evaluateTreeProductionRuntimeAcceptance({
      contract,
      buildMs: TREE_PRODUCTION_MOBILE_BUDGET.maxBuildMs + 1,
      drawCalls: TREE_PRODUCTION_MOBILE_BUDGET.maxDrawCalls + 1,
    })).toEqual({ status: 'fail', violations: ['build-ms', 'draw-calls'] });
  });

  it('pins every instant of one Kyiv day to the same reload-stable asOf', () => {
    expect(resolveTreeProductionAsOf('2026-07-30T00:30:00.000Z')).toBe(
      '2026-07-30T12:00:00.000Z',
    );
    expect(resolveTreeProductionAsOf('2026-07-30T20:30:00.000Z')).toBe(
      '2026-07-30T12:00:00.000Z',
    );
    expect(resolveTreeProductionAsOf('2026-07-30T22:30:00.000Z')).toBe(
      '2026-07-31T12:00:00.000Z',
    );
  });
});
