import { describe, expect, it } from 'vitest';
import { buildArtifactBlueprint, type EvolutionEventInput } from '../evolution';
import {
  buildReefColonyLayout,
  buildReefColonyMeshes,
  buildReefColonySkeletons,
  buildReefFoundationMesh,
  buildReefLife,
  buildReefMaterials,
  buildReefSpeciesBlueprint,
} from '../species/reef';
import { REEF_PRODUCTION_PIPELINE_PHASES } from './reefConfig';
import {
  buildReefProductionAcceptance,
  evaluateReefProductionRuntimeAcceptance,
} from './reefProductionAcceptance';
import type { BuildReefProductionAcceptanceInput } from './reefTypes';

const EVENTS: EvolutionEventInput[] = [
  {
    id: 'reef:stability',
    occurredAt: '2024-02-12',
    source: 'plans@1',
    evidence: 'verified',
    channels: { stability: 0.9 },
    portalActivity: 0.2,
  },
  {
    id: 'reef:memory',
    occurredAt: '2024-06-18',
    source: 'memories@1',
    evidence: 'verified',
    channels: { remembrance: 0.92, culture: 0.18 },
    portalActivity: 0.26,
  },
  {
    id: 'reef:exploration',
    occurredAt: '2025-04-20',
    source: 'map@1',
    evidence: 'verified',
    channels: { exploration: 0.95, significance: 0.3 },
    portalActivity: 0.32,
  },
];

function buildInput(): BuildReefProductionAcceptanceInput {
  const artifact = buildArtifactBlueprint({
    coupleId: 'amore:reef-production-acceptance',
    config: {
      engineVersion: '1.0.0',
      relationshipStartedAt: '2024-01-01',
      timeZone: 'Europe/Kyiv',
      leapDayPolicy: 'feb-28',
    },
    events: EVENTS,
  });
  const asOf = '2026-07-31';
  const species = buildReefSpeciesBlueprint({
    artifact,
    config: { asOf, rulesVersion: 'reef-species-production-v1.0.0' },
  });
  const layout = buildReefColonyLayout({ species });
  const foundation = buildReefFoundationMesh({ species, layout });
  const skeletons = buildReefColonySkeletons({ species, layout, foundation });
  const meshes = buildReefColonyMeshes({ species, layout, foundation, skeletons });
  const materials = buildReefMaterials({ species, layout, foundation, skeletons, meshes });
  const life = buildReefLife({ species, layout, foundation, skeletons, meshes, materials });
  const activeBatches = meshes.batches.filter((batch) => batch.index.length > 0);

  return {
    coupleId: species.coupleId,
    artifactSeed: species.artifactSeed,
    asOf,
    species,
    layout,
    foundation,
    skeletons,
    meshes,
    materials,
    life,
    renderer: {
      batchIds: activeBatches.map((batch) => batch.id),
      vertices: foundation.vertices.length + meshes.batches.reduce(
        (total, batch) => total + batch.vertices.length,
        0,
      ),
      triangles: foundation.triangles.length + meshes.batches.reduce(
        (total, batch) => total + batch.triangles.length,
        0,
      ),
      estimatedDrawCalls: 1 + activeBatches.length,
      materials: 1 + materials.colonies.length,
    },
  };
}

describe('Reef Phase 9 production acceptance', () => {
  it('consolidates the full deterministic Phase 1–8 pipeline', () => {
    const first = buildReefProductionAcceptance(buildInput());
    const second = buildReefProductionAcceptance(buildInput());

    expect(first.staticStatus).toBe('pass');
    expect(first.violations).toEqual([]);
    expect(first.signature).toBe(second.signature);
    expect(first.identitySignature).toBe(second.identitySignature);
    expect(first.phaseCheckpoints.map((phase) => phase.id)).toEqual(
      REEF_PRODUCTION_PIPELINE_PHASES,
    );
    expect(first.phaseCheckpoints).toHaveLength(8);
    expect(first.phaseCheckpoints.every((phase) => phase.status === 'pass')).toBe(true);
    expect(first.diagnostics.phaseProvenancePreserved).toBe(true);
    expect(first.diagnostics.temporalIdentityPreserved).toBe(true);
    expect(first.diagnostics.colonyIdentityChainPreserved).toBe(true);
    expect(first.diagnostics.rangeBindingChainPreserved).toBe(true);
    expect(first.diagnostics.reducedMotionStatic).toBe(true);
    expect(first.diagnostics.rendererBatchingPreserved).toBe(true);
  });

  it('fails when the accepted mesh/material/life binding chain is broken', () => {
    const input = buildInput();
    const broken = buildReefProductionAcceptance({
      ...input,
      life: {
        ...input.life,
        bindings: input.life.bindings.slice(1),
      },
    });

    expect(broken.staticStatus).toBe('fail');
    expect(broken.violations).toContain('colony-identity-chain');
    expect(broken.violations).toContain('range-binding-chain');
  });

  it('separates static acceptance from runtime warm-up and mobile limits', () => {
    const contract = buildReefProductionAcceptance(buildInput());

    expect(evaluateReefProductionRuntimeAcceptance({
      contract,
      buildMs: 30,
      drawCalls: null,
      triangles: null,
    })).toEqual({ status: 'warming', violations: [] });

    expect(evaluateReefProductionRuntimeAcceptance({
      contract,
      buildMs: 30,
      drawCalls: contract.diagnostics.estimatedDrawCalls,
      triangles: contract.diagnostics.triangles,
    })).toEqual({ status: 'pass', violations: [] });

    const failed = evaluateReefProductionRuntimeAcceptance({
      contract,
      buildMs: 221,
      drawCalls: 8,
      triangles: 36_513,
    });
    expect(failed.status).toBe('fail');
    expect(failed.violations).toEqual(expect.arrayContaining([
      'build-ms',
      'draw-calls',
      'runtime-triangles',
    ]));
  });
});
