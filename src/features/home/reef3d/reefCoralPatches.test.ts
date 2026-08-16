import { describe, expect, it } from 'vitest';
import { buildArtifactBlueprint, type EvolutionEventInput } from '@/engine/evolution';
import { buildReefPreviewFromArtifact } from './buildReefPreview';
import { buildReefColonyHabitatPlan } from './reefColonyHabitats';
import { buildReefLivingCanopyPlan } from './reefLivingCanopy';
import {
  buildReefCoralPatchPlan,
  REEF_CORAL_PATCH_VERSION,
} from './reefCoralPatches';

const EVENTS: EvolutionEventInput[] = Array.from({ length: 24 }, (_value, index) => ({
  id: `reef:patch:event:${index}`,
  occurredAt: `2025-${String(1 + (index % 12)).padStart(2, '0')}-${String(1 + (index % 24)).padStart(2, '0')}`,
  source: index % 2 === 0 ? 'wishlist@1' : 'memories@1',
  evidence: 'verified',
  channels: index % 2 === 0
    ? { achievement: 0.62, significance: 0.32, remembrance: 0.12 }
    : { remembrance: 0.72, significance: 0.26 },
  portalActivity: 0.2,
}));

function buildFixture() {
  const artifact = buildArtifactBlueprint({
    coupleId: 'amore:reef-coral-patch-test',
    config: {
      engineVersion: '1.0.0',
      relationshipStartedAt: '2022-12-26',
      timeZone: 'Europe/Kyiv',
      leapDayPolicy: 'feb-28',
    },
    events: EVENTS,
  });
  const build = buildReefPreviewFromArtifact({ artifact, asOf: '2026-08-16' });
  const canopy = buildReefLivingCanopyPlan(build);
  const habitats = buildReefColonyHabitatPlan(canopy, build);
  return { build, habitats };
}

describe('reef coral patches', () => {
  it('collapses event-level habitats into readable same-species patches', () => {
    const { build, habitats } = buildFixture();
    const result = buildReefCoralPatchPlan(habitats, build);
    const colonyById = new Map(
      result.plan.colonies.map((colony) => [colony.sourceColonyId, colony] as const),
    );

    expect(result.patchVersion).toBe(REEF_CORAL_PATCH_VERSION);
    expect(result.habitats.length).toBeLessThanOrEqual(habitats.habitats.length);

    for (const patch of result.habitats) {
      const morphotypes = new Set(
        patch.memberColonyIds.map((id) => colonyById.get(id)?.morphotype),
      );
      expect(morphotypes.size).toBe(1);
      expect(morphotypes.has(patch.dominantMorphotype)).toBe(true);
      expect(patch.memberColonyIds.length).toBeGreaterThan(0);
      expect(patch.memberColonyIds.length).toBeLessThanOrEqual(10);
    }
  });

  it('keeps established patch members fixed when a later recruit is appended', () => {
    const { build, habitats } = buildFixture();
    const baseline = buildReefCoralPatchPlan(habitats, build);
    const templatePatch = baseline.habitats.find((patch) => patch.memberColonyIds.length < 10);
    expect(templatePatch).toBeDefined();
    if (!templatePatch) return;

    const templateId = templatePatch.memberColonyIds[0];
    expect(templateId).toBeDefined();
    if (!templateId) return;

    const template = habitats.plan.colonies.find((colony) => colony.sourceColonyId === templateId);
    expect(template).toBeDefined();
    if (!template) return;

    const sourceHabitat = habitats.habitats.find((habitat) => habitat.memberColonyIds.includes(templateId));
    expect(sourceHabitat).toBeDefined();
    if (!sourceHabitat) return;

    const maximumSequence = Math.max(...habitats.plan.colonies.map((colony) => colony.request.sequence));
    const recruitId = `${template.sourceColonyId}:late-recruit`;
    const recruit = {
      ...template,
      id: `${template.id}:late-recruit`,
      sourceColonyId: recruitId,
      seed: (template.seed + 104_729) >>> 0,
      request: {
        ...template.request,
        id: `${template.request.id}:late-recruit`,
        sequence: maximumSequence + 1,
      },
    };
    const extendedColonies = [...habitats.plan.colonies, recruit];
    const extended = buildReefCoralPatchPlan({
      ...habitats,
      plan: {
        ...habitats.plan,
        colonies: extendedColonies,
        requests: extendedColonies.map((colony) => colony.request),
      },
      habitats: [
        ...habitats.habitats,
        {
          ...sourceHabitat,
          id: `${sourceHabitat.id}:late-recruit`,
          sourceInstructionId: `${sourceHabitat.sourceInstructionId}:late-recruit`,
          memberColonyIds: [recruitId],
          growth: [{
            colonyId: recruitId,
            sequence: maximumSequence + 1,
            stage: 'core',
            distanceFromCenter: 0,
            distanceRatio: 0,
          }],
        },
      ],
    }, build);

    const baselineById = new Map(
      baseline.plan.colonies.map((colony) => [colony.sourceColonyId, colony] as const),
    );
    const extendedById = new Map(
      extended.plan.colonies.map((colony) => [colony.sourceColonyId, colony] as const),
    );

    for (const [id, colony] of baselineById) {
      expect(extendedById.get(id)?.request.preferred).toEqual(colony.request.preferred);
      expect(extendedById.get(id)?.facingRad).toBe(colony.facingRad);
    }
    expect(extendedById.get(recruitId)).toBeDefined();
  });
});
