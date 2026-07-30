import { stableHash32 } from '../evolution';
import {
  TREE_PRODUCTION_ACCEPTANCE_RULES_VERSION,
  TREE_PRODUCTION_MOBILE_BUDGET,
  TREE_PRODUCTION_PIPELINE_PHASES,
} from './config';
import type {
  BuildTreeProductionAcceptanceInput,
  EvaluateTreeProductionRuntimeInput,
  TreeProductionAcceptanceState,
  TreeProductionMobileBudget,
  TreeProductionRuntimeAcceptanceResult,
} from './types';

function sameArray(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length
    && left.every((value, index) => value === right[index]);
}

function validCount(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

function validateBudget(budget: TreeProductionMobileBudget): void {
  const values = [
    budget.maxVertices,
    budget.maxTriangles,
    budget.maxBuildMs,
    budget.maxDrawCalls,
    budget.maxMaterials,
  ];
  if (values.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error('Tree Production mobile budget must contain finite non-negative limits.');
  }
}

function fingerprint(value: string): string {
  return stableHash32(value).toString(16).padStart(8, '0');
}

export function buildTreeProductionAcceptance(
  input: BuildTreeProductionAcceptanceInput,
): TreeProductionAcceptanceState {
  if (!input.coupleId.trim()) {
    throw new Error('Tree Production acceptance requires a non-empty coupleId.');
  }
  if (!Number.isInteger(input.artifactSeed) || input.artifactSeed < 0) {
    throw new Error('Tree Production acceptance requires a non-negative integer artifactSeed.');
  }
  if (!Number.isFinite(Date.parse(input.asOf))) {
    throw new Error('Tree Production acceptance requires a valid asOf timestamp.');
  }

  const budget = { ...(input.budget ?? TREE_PRODUCTION_MOBILE_BUDGET) };
  validateBudget(budget);

  const phaseOrderPreserved = input.phases.length === TREE_PRODUCTION_PIPELINE_PHASES.length
    && input.phases.every((phase, index) => phase.id === TREE_PRODUCTION_PIPELINE_PHASES[index]);
  const phaseFingerprintsPresent = input.phases.every((phase) => (
    phase.rulesVersion.trim().length > 0 && phase.fingerprint.trim().length > 0
  ));
  const phaseCheckpoints = input.phases.map((phase, sequence) => ({
    ...phase,
    rulesVersion: phase.rulesVersion.trim(),
    fingerprint: phase.fingerprint.trim(),
    sequence,
    status: phase.rulesVersion.trim() && phase.fingerprint.trim() ? 'pass' as const : 'fail' as const,
  }));

  const identities = input.identities;
  const sourceLeafIds = [...identities.sourceLeafIds];
  const leafIdentityChainPreserved = [
    identities.canopyDepthLeafIds,
    identities.canopyLightLeafIds,
    identities.phenologyLeafIds,
    identities.leafOrientationLeafIds,
    identities.crownSilhouetteLeafIds,
  ].every((ids) => sameArray(sourceLeafIds, ids));
  const lifeLeafPrefixPreserved = sameArray(
    sourceLeafIds.slice(0, identities.lifeLeafIds.length),
    identities.lifeLeafIds,
  );
  const identitySignature = fingerprint(sourceLeafIds.join('\u001f'));

  const budgets = input.budgets;
  const budgetValuesValid = [
    budgets.vertices,
    budgets.triangles,
    budgets.estimatedDrawCalls,
    budgets.materials,
    budgets.leafInstances,
    budgets.estimatedMatrixUpdatesPerFrame,
  ].every(validCount);

  const violations: string[] = [];
  if (!phaseOrderPreserved) violations.push('phase-order');
  if (!phaseFingerprintsPresent) violations.push('phase-fingerprint');
  if (!leafIdentityChainPreserved) violations.push('leaf-identity-chain');
  if (!lifeLeafPrefixPreserved) violations.push('life-leaf-prefix');
  if (!input.preservation.negativeSpaceAccepted) violations.push('negative-space');
  if (!input.preservation.groundAnchored) violations.push('ground-anchor');
  if (!input.preservation.terrainMergedIntoStaticGeometry) violations.push('terrain-merge');
  if (!input.preservation.soilTerrainTintPreserved) violations.push('soil-preservation');
  if (!input.preservation.barkGeometryPreserved) violations.push('bark-geometry');
  if (!input.preservation.groundDetailsAnchored) violations.push('ground-detail-anchor');
  if (!input.preservation.groundDetailPrefixPreserved) violations.push('ground-detail-prefix');
  if (!budgetValuesValid) violations.push('invalid-budget-metrics');
  if (budgets.vertices > budget.maxVertices) violations.push('vertices');
  if (budgets.triangles > budget.maxTriangles) violations.push('triangles');
  if (budgets.estimatedDrawCalls > budget.maxDrawCalls) violations.push('estimated-draw-calls');
  if (budgets.materials > budget.maxMaterials) violations.push('materials');
  if (budgets.estimatedMatrixUpdatesPerFrame > budgets.leafInstances) {
    violations.push('matrix-updates');
  }

  const signaturePayload = [
    TREE_PRODUCTION_ACCEPTANCE_RULES_VERSION,
    input.coupleId.trim(),
    input.artifactSeed,
    input.lod,
    input.asOf,
    input.asOfPolicy,
    phaseCheckpoints.map((phase) => `${phase.id}:${phase.rulesVersion}:${phase.fingerprint}`).join('|'),
    identitySignature,
    sourceLeafIds.length,
    Number(leafIdentityChainPreserved),
    Number(lifeLeafPrefixPreserved),
    Number(input.preservation.negativeSpaceAccepted),
    Number(input.preservation.groundAnchored),
    Number(input.preservation.terrainMergedIntoStaticGeometry),
    Number(input.preservation.soilTerrainTintPreserved),
    Number(input.preservation.barkGeometryPreserved),
    Number(input.preservation.groundDetailsAnchored),
    Number(input.preservation.groundDetailPrefixPreserved),
    budgets.vertices,
    budgets.triangles,
    budgets.estimatedDrawCalls,
    budgets.materials,
    budgets.leafInstances,
    budgets.estimatedMatrixUpdatesPerFrame,
    violations.join(','),
  ].join('\u001e');

  return {
    treeProductionAcceptanceVersion: 1,
    rulesVersion: TREE_PRODUCTION_ACCEPTANCE_RULES_VERSION,
    descriptor: {
      id: 'tree:production-acceptance:contract',
      pipelineId: 'tree:production-pipeline:v1',
      runtimeId: 'tree:production-runtime:mobile',
      identityId: 'tree:production-identity:leaf-chain',
    },
    coupleId: input.coupleId.trim(),
    artifactSeed: input.artifactSeed,
    lod: input.lod,
    asOf: input.asOf,
    asOfPolicy: input.asOfPolicy,
    signature: fingerprint(signaturePayload),
    phaseCheckpoints,
    identitySignature,
    staticStatus: violations.length === 0 ? 'pass' : 'fail',
    violations,
    diagnostics: {
      expectedPhaseCount: TREE_PRODUCTION_PIPELINE_PHASES.length,
      emittedPhaseCount: phaseCheckpoints.length,
      phaseOrderPreserved,
      phaseFingerprintsPresent,
      sourceLeafCount: sourceLeafIds.length,
      leafIdentityChainPreserved,
      lifeLeafPrefixPreserved,
      negativeSpaceAccepted: input.preservation.negativeSpaceAccepted,
      groundAnchored: input.preservation.groundAnchored,
      terrainMergedIntoStaticGeometry: input.preservation.terrainMergedIntoStaticGeometry,
      soilTerrainTintPreserved: input.preservation.soilTerrainTintPreserved,
      barkGeometryPreserved: input.preservation.barkGeometryPreserved,
      groundDetailsAnchored: input.preservation.groundDetailsAnchored,
      groundDetailPrefixPreserved: input.preservation.groundDetailPrefixPreserved,
      vertices: budgets.vertices,
      triangles: budgets.triangles,
      estimatedDrawCalls: budgets.estimatedDrawCalls,
      materials: budgets.materials,
      leafInstances: budgets.leafInstances,
      estimatedMatrixUpdatesPerFrame: budgets.estimatedMatrixUpdatesPerFrame,
      mobileBudget: budget,
    },
  };
}

export function evaluateTreeProductionRuntimeAcceptance({
  contract,
  buildMs,
  drawCalls,
}: EvaluateTreeProductionRuntimeInput): TreeProductionRuntimeAcceptanceResult {
  const violations = [...contract.violations];
  const budget = contract.diagnostics.mobileBudget;

  if (!Number.isFinite(buildMs) || buildMs < 0 || buildMs > budget.maxBuildMs) {
    violations.push('build-ms');
  }
  if (drawCalls !== null && (
    !Number.isInteger(drawCalls)
    || drawCalls < 0
    || drawCalls > budget.maxDrawCalls
  )) {
    violations.push('draw-calls');
  }

  if (contract.staticStatus === 'fail') {
    return { status: 'fail', violations };
  }
  if (drawCalls === null) {
    return { status: 'warming', violations };
  }
  return { status: violations.length === 0 ? 'pass' : 'fail', violations };
}
