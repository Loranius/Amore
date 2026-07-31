import { stableHash32 } from '../evolution';
import {
  REEF_PRODUCTION_ACCEPTANCE_RULES_VERSION,
  REEF_PRODUCTION_MOBILE_BUDGET,
  REEF_PRODUCTION_PIPELINE_PHASES,
} from './reefConfig';
import type {
  BuildReefProductionAcceptanceInput,
  EvaluateReefProductionRuntimeInput,
  ReefProductionAcceptanceState,
  ReefProductionMobileBudget,
  ReefProductionPhaseCheckpoint,
  ReefProductionRuntimeAcceptanceResult,
} from './reefTypes';

const RENDERER_RULES_VERSION = 'reef-three-renderer-v1.0.0';

function fingerprint(value: string): string {
  return stableHash32(value).toString(16).padStart(8, '0');
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function sameArray(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length
    && left.every((value, index) => value === right[index]);
}

function sameIdentitySet(left: readonly string[], right: readonly string[]): boolean {
  return sameArray(uniqueSorted(left), uniqueSorted(right));
}

function hasUniqueIdentity(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

function validCount(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

function validateBudget(budget: ReefProductionMobileBudget): void {
  const values = [
    budget.maxVertices,
    budget.maxTriangles,
    budget.maxBuildMs,
    budget.maxDrawCalls,
    budget.maxMaterials,
  ];
  if (values.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error('Reef Production mobile budget must contain finite non-negative limits.');
  }
}

function checkpoint(
  id: ReefProductionPhaseCheckpoint['id'],
  sequence: number,
  rulesVersion: string,
  payload: string,
): ReefProductionPhaseCheckpoint {
  const normalizedRulesVersion = rulesVersion.trim();
  const phaseFingerprint = payload.trim() ? fingerprint(payload) : '';
  return {
    id,
    sequence,
    rulesVersion: normalizedRulesVersion,
    fingerprint: phaseFingerprint,
    status: normalizedRulesVersion && phaseFingerprint ? 'pass' : 'fail',
  };
}

export function buildReefProductionAcceptance(
  input: BuildReefProductionAcceptanceInput,
): ReefProductionAcceptanceState {
  if (!input.coupleId.trim()) {
    throw new Error('Reef Production acceptance requires a non-empty coupleId.');
  }
  if (!Number.isInteger(input.artifactSeed) || input.artifactSeed < 0) {
    throw new Error('Reef Production acceptance requires a non-negative integer artifactSeed.');
  }
  if (!Number.isFinite(Date.parse(input.asOf))) {
    throw new Error('Reef Production acceptance requires a valid asOf timestamp.');
  }

  const budget = { ...(input.budget ?? REEF_PRODUCTION_MOBILE_BUDGET) };
  validateBudget(budget);

  const {
    species,
    layout,
    foundation,
    skeletons,
    meshes,
    materials,
    life,
    renderer,
  } = input;

  const layoutColonyIds = layout.colonies.map((colony) => colony.id);
  const foundationAttachmentColonyIds = foundation.attachments.map((attachment) => attachment.colonyId);
  const skeletonColonyIds = skeletons.skeletons.map((skeleton) => skeleton.colonyId);
  const ranges = meshes.batches.flatMap((batch) => batch.ranges);
  const meshRangeIds = ranges.map((range) => range.id);
  const meshRangeColonyIds = ranges.map((range) => range.colonyId);
  const materialBindings = materials.colonies.flatMap((assignment) => assignment.bindings);
  const materialBindingIds = materialBindings.map((binding) => binding.id);
  const materialRangeIds = materialBindings.map((binding) => binding.sourceRangeId);
  const materialBindingColonyIds = materialBindings.map((binding) => binding.colonyId);
  const lifeRangeIds = life.bindings.map((binding) => binding.sourceRangeId);
  const lifeMaterialBindingIds = life.bindings.map((binding) => binding.sourceMaterialBindingId);
  const lifeBindingColonyIds = life.bindings.map((binding) => binding.colonyId);
  const activeBatches = meshes.batches.filter((batch) => batch.index.length > 0);
  const activeBatchIds = activeBatches.map((batch) => batch.id);

  const actualVertices = foundation.vertices.length + meshes.batches.reduce(
    (total, batch) => total + batch.vertices.length,
    0,
  );
  const actualTriangles = foundation.triangles.length + meshes.batches.reduce(
    (total, batch) => total + batch.triangles.length,
    0,
  );
  const actualDrawCalls = 1 + activeBatches.length;
  const actualMaterials = 1 + materials.colonies.length;

  const phaseCheckpoints = [
    checkpoint(
      'reef-species',
      0,
      species.rulesVersion,
      [
        species.speciesBlueprintVersion,
        species.artifactSeed,
        species.asOf,
        species.state.stage,
        ...species.growth.map((instruction) => instruction.id),
      ].join('|'),
    ),
    checkpoint(
      'colony-layout',
      1,
      layout.rulesVersion,
      [layout.reefColonyLayoutVersion, ...layout.cells.map((cell) => cell.id), ...layoutColonyIds].join('|'),
    ),
    checkpoint(
      'foundation-mesh',
      2,
      foundation.rulesVersion,
      [
        foundation.reefFoundationMeshVersion,
        ...foundation.vertices.map((vertex) => vertex.id),
        ...foundation.triangles.map((triangle) => triangle.id),
        ...foundation.attachments.map((attachment) => attachment.id),
      ].join('|'),
    ),
    checkpoint(
      'morphotype-skeletons',
      3,
      skeletons.rulesVersion,
      [skeletons.reefColonySkeletonVersion, ...skeletons.skeletons.map((skeleton) => skeleton.id)].join('|'),
    ),
    checkpoint(
      'colony-meshes',
      4,
      meshes.rulesVersion,
      [meshes.reefColonyMeshVersion, ...meshes.batches.map((batch) => batch.id), ...meshRangeIds].join('|'),
    ),
    checkpoint(
      'reef-materials',
      5,
      materials.rulesVersion,
      [
        materials.reefMaterialVersion,
        materials.foundation.id,
        ...materials.colonies.map((assignment) => assignment.id),
        ...materialBindingIds,
      ].join('|'),
    ),
    checkpoint(
      'reef-life',
      6,
      life.rulesVersion,
      [life.reefLifeVersion, life.current.id, ...life.bindings.map((binding) => binding.id)].join('|'),
    ),
    checkpoint(
      'three-renderer',
      7,
      RENDERER_RULES_VERSION,
      [
        ...renderer.batchIds,
        renderer.vertices,
        renderer.triangles,
        renderer.estimatedDrawCalls,
        renderer.materials,
      ].join('|'),
    ),
  ];

  const phaseOrderPreserved = phaseCheckpoints.length === REEF_PRODUCTION_PIPELINE_PHASES.length
    && phaseCheckpoints.every((phase, index) => phase.id === REEF_PRODUCTION_PIPELINE_PHASES[index]);
  const phaseFingerprintsPresent = phaseCheckpoints.every((phase) => (
    phase.rulesVersion.length > 0 && phase.fingerprint.length > 0
  ));

  const phaseProvenancePreserved = [
    layout.sourceSpeciesRulesVersion === species.rulesVersion,
    foundation.sourceSpeciesRulesVersion === species.rulesVersion,
    foundation.sourceColonyLayoutRulesVersion === layout.rulesVersion,
    skeletons.sourceSpeciesRulesVersion === species.rulesVersion,
    skeletons.sourceColonyLayoutRulesVersion === layout.rulesVersion,
    skeletons.sourceFoundationRulesVersion === foundation.rulesVersion,
    meshes.sourceSpeciesRulesVersion === species.rulesVersion,
    meshes.sourceColonyLayoutRulesVersion === layout.rulesVersion,
    meshes.sourceFoundationRulesVersion === foundation.rulesVersion,
    meshes.sourceColonySkeletonRulesVersion === skeletons.rulesVersion,
    materials.sourceSpeciesRulesVersion === species.rulesVersion,
    materials.sourceColonyLayoutRulesVersion === layout.rulesVersion,
    materials.sourceFoundationRulesVersion === foundation.rulesVersion,
    materials.sourceColonySkeletonRulesVersion === skeletons.rulesVersion,
    materials.sourceColonyMeshRulesVersion === meshes.rulesVersion,
    life.sourceSpeciesRulesVersion === species.rulesVersion,
    life.sourceColonyLayoutRulesVersion === layout.rulesVersion,
    life.sourceFoundationRulesVersion === foundation.rulesVersion,
    life.sourceColonySkeletonRulesVersion === skeletons.rulesVersion,
    life.sourceColonyMeshRulesVersion === meshes.rulesVersion,
    life.sourceMaterialRulesVersion === materials.rulesVersion,
  ].every(Boolean);

  const temporalIdentityPreserved = [
    species.artifactSeed,
    layout.artifactSeed,
    foundation.artifactSeed,
    skeletons.artifactSeed,
    meshes.artifactSeed,
    materials.artifactSeed,
    life.artifactSeed,
  ].every((seed) => seed === input.artifactSeed)
    && [
      species.asOf,
      layout.asOf,
      foundation.asOf,
      skeletons.asOf,
      meshes.asOf,
      materials.asOf,
      life.asOf,
    ].every((asOf) => asOf === input.asOf)
    && species.coupleId === input.coupleId.trim();

  const foundationAttachmentCoveragePreserved = sameIdentitySet(
    layoutColonyIds,
    foundationAttachmentColonyIds,
  );
  const colonyIdentityChainPreserved = [
    foundationAttachmentColonyIds,
    skeletonColonyIds,
    meshRangeColonyIds,
    materialBindingColonyIds,
    lifeBindingColonyIds,
  ].every((ids) => sameIdentitySet(layoutColonyIds, ids));
  const uniqueColonyIdentityPreserved = [
    layoutColonyIds,
    foundationAttachmentColonyIds,
    skeletonColonyIds,
    meshRangeColonyIds,
    materialBindingColonyIds,
    lifeBindingColonyIds,
  ].every(hasUniqueIdentity);
  const rangeBindingChainPreserved = sameIdentitySet(meshRangeIds, materialRangeIds)
    && sameIdentitySet(meshRangeIds, lifeRangeIds)
    && sameIdentitySet(materialBindingIds, lifeMaterialBindingIds);
  const reducedMotionStatic = life.bindings.every((binding) => (
    binding.reducedMotion.mode === 'static'
    && binding.reducedMotion.swayAmplitudeRadians === 0
    && binding.reducedMotion.polypPulseAmplitude === 0
    && binding.reducedMotion.timeScale === 0
  ));
  const rendererBatchingPreserved = sameIdentitySet(renderer.batchIds, activeBatchIds)
    && renderer.vertices === actualVertices
    && renderer.triangles === actualTriangles
    && renderer.estimatedDrawCalls === actualDrawCalls
    && renderer.materials === actualMaterials
    && materials.colonies.length === activeBatches.length;

  const metricValuesValid = [
    renderer.vertices,
    renderer.triangles,
    renderer.estimatedDrawCalls,
    renderer.materials,
  ].every(validCount);

  const violations: string[] = [];
  if (!phaseOrderPreserved) violations.push('phase-order');
  if (!phaseFingerprintsPresent) violations.push('phase-fingerprint');
  if (!phaseProvenancePreserved) violations.push('phase-provenance');
  if (!temporalIdentityPreserved) violations.push('temporal-identity');
  if (!foundation.diagnostics.closedShell) violations.push('foundation-open-shell');
  if (!foundationAttachmentCoveragePreserved) violations.push('foundation-attachment-coverage');
  if (!colonyIdentityChainPreserved) violations.push('colony-identity-chain');
  if (!uniqueColonyIdentityPreserved) violations.push('duplicate-colony-identity');
  if (!rangeBindingChainPreserved) violations.push('range-binding-chain');
  if (!reducedMotionStatic) violations.push('reduced-motion-profile');
  if (!rendererBatchingPreserved) violations.push('renderer-batching');
  if (foundation.diagnostics.geometryBudgetExceeded) violations.push('foundation-geometry-budget');
  if (skeletons.diagnostics.logicalBudgetExceeded) violations.push('skeleton-logical-budget');
  if (meshes.diagnostics.geometryBudgetExceeded) violations.push('colony-geometry-budget');
  if (materials.diagnostics.materialBudgetExceeded) violations.push('material-binding-budget');
  if (life.diagnostics.motionBindingBudgetExceeded) violations.push('motion-binding-budget');
  if (!metricValuesValid) violations.push('invalid-budget-metrics');
  if (renderer.vertices > budget.maxVertices) violations.push('vertices');
  if (renderer.triangles > budget.maxTriangles) violations.push('triangles');
  if (renderer.estimatedDrawCalls > budget.maxDrawCalls) violations.push('estimated-draw-calls');
  if (renderer.materials > budget.maxMaterials) violations.push('materials');

  const identitySignature = fingerprint(uniqueSorted(layoutColonyIds).join('\u001f'));
  const signaturePayload = [
    REEF_PRODUCTION_ACCEPTANCE_RULES_VERSION,
    input.coupleId.trim(),
    input.artifactSeed,
    input.asOf,
    phaseCheckpoints.map((phase) => `${phase.id}:${phase.rulesVersion}:${phase.fingerprint}`).join('|'),
    identitySignature,
    Number(phaseProvenancePreserved),
    Number(temporalIdentityPreserved),
    Number(colonyIdentityChainPreserved),
    Number(rangeBindingChainPreserved),
    Number(foundation.diagnostics.closedShell),
    Number(reducedMotionStatic),
    Number(rendererBatchingPreserved),
    renderer.vertices,
    renderer.triangles,
    renderer.estimatedDrawCalls,
    renderer.materials,
    violations.join(','),
  ].join('\u001e');

  return {
    reefProductionAcceptanceVersion: 1,
    rulesVersion: REEF_PRODUCTION_ACCEPTANCE_RULES_VERSION,
    descriptor: {
      id: 'reef:production-acceptance:contract',
      pipelineId: 'reef:production-pipeline:v1',
      runtimeId: 'reef:production-runtime:mobile',
      identityId: 'reef:production-identity:colony-chain',
    },
    coupleId: input.coupleId.trim(),
    artifactSeed: input.artifactSeed,
    asOf: input.asOf,
    signature: fingerprint(signaturePayload),
    identitySignature,
    phaseCheckpoints,
    staticStatus: violations.length === 0 ? 'pass' : 'fail',
    violations,
    diagnostics: {
      expectedPhaseCount: REEF_PRODUCTION_PIPELINE_PHASES.length,
      emittedPhaseCount: phaseCheckpoints.length,
      phaseOrderPreserved,
      phaseFingerprintsPresent,
      phaseProvenancePreserved,
      temporalIdentityPreserved,
      colonyIdentityChainPreserved,
      uniqueColonyIdentityPreserved,
      rangeBindingChainPreserved,
      foundationClosedShell: foundation.diagnostics.closedShell,
      foundationAttachmentCoveragePreserved,
      reducedMotionStatic,
      rendererBatchingPreserved,
      layoutColonyCount: layoutColonyIds.length,
      foundationAttachmentCount: foundationAttachmentColonyIds.length,
      skeletonCount: skeletonColonyIds.length,
      meshRangeCount: meshRangeIds.length,
      materialBindingCount: materialBindingIds.length,
      motionBindingCount: life.bindings.length,
      vertices: renderer.vertices,
      triangles: renderer.triangles,
      estimatedDrawCalls: renderer.estimatedDrawCalls,
      materials: renderer.materials,
      mobileBudget: budget,
    },
  };
}

export function evaluateReefProductionRuntimeAcceptance({
  contract,
  buildMs,
  drawCalls,
  triangles,
}: EvaluateReefProductionRuntimeInput): ReefProductionRuntimeAcceptanceResult {
  const violations = new Set(contract.violations);
  const budget = contract.diagnostics.mobileBudget;

  if (!Number.isFinite(buildMs) || buildMs < 0 || buildMs > budget.maxBuildMs) {
    violations.add('build-ms');
  }
  if (drawCalls !== null && (
    !Number.isInteger(drawCalls)
    || drawCalls < 0
    || drawCalls > budget.maxDrawCalls
  )) {
    violations.add('draw-calls');
  }
  if (triangles !== null && (
    !Number.isInteger(triangles)
    || triangles < 0
    || triangles > budget.maxTriangles
  )) {
    violations.add('runtime-triangles');
  }

  const runtimeViolations = [...violations];
  if (contract.staticStatus === 'fail') {
    return { status: 'fail', violations: runtimeViolations };
  }
  if (drawCalls === null || triangles === null) {
    return { status: 'warming', violations: runtimeViolations };
  }
  return {
    status: runtimeViolations.length === 0 ? 'pass' : 'fail',
    violations: runtimeViolations,
  };
}
