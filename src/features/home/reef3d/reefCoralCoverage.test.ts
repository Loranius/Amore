import { describe, expect, it } from 'vitest';
import { buildArtifactBlueprint, type EvolutionEventInput } from '@/engine/evolution';
import { buildReefPreviewFromArtifact } from './buildReefPreview';
import { buildReefLivingCanopyPlan } from './reefLivingCanopy';
import { buildReefColonyHabitatPlan } from './reefColonyHabitats';
import { buildReefCoralPatchPlan } from './reefCoralPatches';
import {
  applyReefCoralCoverage,
  REEF_CORAL_COVERAGE_VERSION,
  REEF_CORAL_MAX_COVERAGE_RATIO,
} from './reefCoralCoverage';

const EVENTS: EvolutionEventInput[] = [
  ...Array.from({ length: 30 }, (_value, index): EvolutionEventInput => ({
    id: `wish:coverage:${index}`,
    occurredAt: `2024-${String(1 + (index % 12)).padStart(2, '0')}-${String(1 + (index % 24)).padStart(2, '0')}`,
    source: 'wishlist@1',
    evidence: 'verified',
    channels: { achievement: 0.62, significance: 0.36, remembrance: 0.12 },
    portalActivity: 0.24,
  })),
  ...Array.from({ length: 20 }, (_value, index): EvolutionEventInput => ({
    id: `memory:coverage:${index}`,
    occurredAt: `2025-${String(1 + (index % 12)).padStart(2, '0')}-${String(2 + (index % 24)).padStart(2, '0')}`,
    source: 'memories@1',
    evidence: 'verified',
    channels: { remembrance: 0.78, significance: 0.26 },
    portalActivity: 0.18,
  })),
];

function fixture() {
  const artifact = buildArtifactBlueprint({
    coupleId: 'amore:reef-coral-coverage-test',
    config: {
      engineVersion: '1.0.0',
      relationshipStartedAt: '2024-01-01',
      timeZone: 'Europe/Kyiv',
      leapDayPolicy: 'feb-28',
    },
    events: EVENTS,
  });
  const build = buildReefPreviewFromArtifact({ artifact, asOf: '2026-07-31' });
  const canopy = buildReefLivingCanopyPlan(build);
  const habitats = buildReefColonyHabitatPlan(canopy, build);
  const patches = buildReefCoralPatchPlan(habitats, build);
  const inflatedRadius = Math.max(0.2, build.structures.visibleFoundationRadius * 0.075);
  const colonies = patches.plan.colonies.map((colony) => ({
    ...colony,
    footprintRadius: inflatedRadius,
    request: {
      ...colony.request,
      footprintRadius: inflatedRadius,
    },
  }));

  return {
    build,
    plan: {
      ...patches.plan,
      colonies,
      requests: colonies.map((colony) => colony.request),
    },
    habitats: patches.habitats,
  };
}

describe('reef coral coverage', () => {
  it('keeps every occupied habitat at or below the open-rock coverage cap', () => {
    const source = fixture();
    const result = applyReefCoralCoverage({
      plan: source.plan,
      habitats: source.habitats,
    });

    expect(result.summary.version).toBe(REEF_CORAL_COVERAGE_VERSION);
    expect(result.summary.maxCoverageRatio).toBe(REEF_CORAL_MAX_COVERAGE_RATIO);
    expect(result.summary.estimatedCoverageRatio)
      .toBeLessThanOrEqual(REEF_CORAL_MAX_COVERAGE_RATIO + 1e-6);
    expect(result.summary.suppressedColonyCount).toBeGreaterThan(0);

    for (const habitat of result.summary.habitats) {
      expect(habitat.visibleMemberCount).toBeGreaterThan(0);
      expect(habitat.coverageRatio)
        .toBeLessThanOrEqual(REEF_CORAL_MAX_COVERAGE_RATIO + 1e-6);
    }
  });

  it('preserves chronological order and does not move older members when a late recruit is removed', () => {
    const source = fixture();
    const full = applyReefCoralCoverage({
      plan: source.plan,
      habitats: source.habitats,
    });
    const sourceHabitat = source.habitats.find((habitat) => habitat.memberColonyIds.length > 1);
    expect(sourceHabitat).toBeDefined();
    if (!sourceHabitat) return;

    const removedId = sourceHabitat.memberColonyIds.at(-1);
    expect(removedId).toBeDefined();
    if (!removedId) return;

    const trimmedColonies = source.plan.colonies.filter(
      (colony) => colony.sourceColonyId !== removedId,
    );
    const trimmedHabitats = source.habitats.map((habitat) => ({
      ...habitat,
      memberColonyIds: habitat.memberColonyIds.filter((id) => id !== removedId),
      growth: habitat.growth.filter((growth) => growth.colonyId !== removedId),
    }));
    const trimmed = applyReefCoralCoverage({
      plan: {
        ...source.plan,
        colonies: trimmedColonies,
        requests: trimmedColonies.map((colony) => colony.request),
      },
      habitats: trimmedHabitats,
    });

    const sourceOrder = new Map(
      source.plan.colonies.map((colony, index) => [colony.sourceColonyId, index] as const),
    );
    const fullIds = full.plan.colonies.map((colony) => colony.sourceColonyId);
    expect(fullIds).toEqual(
      [...fullIds].sort((left, right) => (sourceOrder.get(left) ?? 0) - (sourceOrder.get(right) ?? 0)),
    );

    const fullById = new Map(
      full.plan.colonies.map((colony) => [colony.sourceColonyId, colony] as const),
    );
    for (const colony of trimmed.plan.colonies) {
      const before = fullById.get(colony.sourceColonyId);
      if (!before) continue;
      expect(colony.request.preferred).toEqual(before.request.preferred);
      expect(colony.footprintRadius).toBe(before.footprintRadius);
    }
  });
});
