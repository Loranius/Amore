import { describe, expect, it } from 'vitest';
import { buildArtifactBlueprint, type EvolutionEventInput } from '@/engine/evolution';
import { buildReefPreviewFromArtifact } from './buildReefPreview';
import { buildReefLivingCanopyPlan } from './reefLivingCanopy';
import { buildReefColonyHabitatPlan } from './reefColonyHabitats';
import {
  buildReefColonyMaturityPlan,
  REEF_COLONY_MATURITY_VERSION,
} from './reefColonyMaturity';
import { REEF_CORAL_MAX_COVERAGE_RATIO } from './reefCoralCoverage';

const EVENTS: EvolutionEventInput[] = [
  ...Array.from({ length: 6 }, (_value, index): EvolutionEventInput => ({
    id: `wish:maturity:${index}`,
    occurredAt: `2024-${String(2 + index).padStart(2, '0')}-12`,
    source: 'wishlist@1',
    evidence: 'verified',
    channels: { achievement: 0.58, significance: 0.42, remembrance: 0.12 },
    portalActivity: 0.24,
  })),
  ...Array.from({ length: 5 }, (_value, index): EvolutionEventInput => ({
    id: `memory:maturity:${index}`,
    occurredAt: `2025-${String(2 + index).padStart(2, '0')}-18`,
    source: 'memories@1',
    evidence: 'verified',
    channels: { remembrance: 0.76, significance: 0.22 },
    portalActivity: 0.18,
  })),
  {
    id: 'media:maturity:1',
    occurredAt: '2025-08-20',
    source: 'media@1',
    evidence: 'verified',
    channels: { significance: 0.4, remembrance: 0.24 },
    portalActivity: 0.22,
  },
];

function artifact() {
  return buildArtifactBlueprint({
    coupleId: 'amore:reef-colony-maturity-test',
    config: {
      engineVersion: '1.0.0',
      relationshipStartedAt: '2024-01-01',
      timeZone: 'Europe/Kyiv',
      leapDayPolicy: 'feb-28',
    },
    events: EVENTS,
  });
}

function maturityPlan(asOf: string) {
  const build = buildReefPreviewFromArtifact({ artifact: artifact(), asOf });
  const canopy = buildReefLivingCanopyPlan(build);
  const habitats = buildReefColonyHabitatPlan(canopy, build);
  return {
    build,
    habitats,
    maturity: buildReefColonyMaturityPlan(habitats, build),
  };
}

describe('reef colony maturity lifecycle', () => {
  it('keeps visible colony identity and source ordering while enforcing the habitat budget', () => {
    const { habitats, maturity } = maturityPlan('2026-07-31');
    const sourceIds = habitats.plan.colonies.map((colony) => colony.sourceColonyId);
    const sourceIdSet = new Set(sourceIds);
    const visibleIds = maturity.plan.colonies.map((colony) => colony.sourceColonyId);
    const visibleIdSet = new Set(visibleIds);

    expect(maturity.version).toBe(REEF_COLONY_MATURITY_VERSION);
    expect(visibleIds.every((id) => sourceIdSet.has(id))).toBe(true);
    expect(visibleIds).toEqual(sourceIds.filter((id) => visibleIdSet.has(id)));
    expect(maturity.plan.requests.map((request) => request.id))
      .toEqual(maturity.plan.colonies.map((colony) => colony.request.id));
    expect(
      maturity.stageCounts.young
        + maturity.stageCounts.growing
        + maturity.stageCounts.mature,
    ).toBe(maturity.states.length);
    expect(maturity.coverage.sourceColonyCount).toBe(sourceIds.length);
    expect(maturity.coverage.visibleColonyCount).toBe(visibleIds.length);
    expect(maturity.coverage.maxCoverageRatio).toBe(REEF_CORAL_MAX_COVERAGE_RATIO);

    for (const habitat of maturity.coverage.habitats) {
      expect(habitat.coverageRatio)
        .toBeLessThanOrEqual(REEF_CORAL_MAX_COVERAGE_RATIO + 1e-6);
    }

    for (const colony of maturity.plan.colonies) {
      expect(colony.maturity).toBeGreaterThanOrEqual(0);
      expect(colony.maturity).toBeLessThanOrEqual(1);
      expect(colony.request.footprintRadius).toBe(colony.footprintRadius);
      expect(colony.footprintRadius).toBeGreaterThan(0);
      expect(colony.targetHeight).toBeGreaterThan(0);
    }
  });

  it('lets the same habitats mature over time instead of reshuffling them', () => {
    const young = maturityPlan('2026-07-31');
    const old = maturityPlan('2036-07-31');
    const oldStateById = new Map(
      old.maturity.states.map((state) => [state.habitatId, state] as const),
    );
    let compared = 0;

    for (const state of young.maturity.states) {
      const later = oldStateById.get(state.habitatId);
      if (!later) continue;
      compared += 1;
      expect(later.maturityScore + 1e-6).toBeGreaterThanOrEqual(state.maturityScore);
      expect(later.coverageScale + 1e-6).toBeGreaterThanOrEqual(state.coverageScale);
      expect(later.heightScale + 1e-6).toBeGreaterThanOrEqual(state.heightScale);
      expect(later.recruitmentReadiness + 1e-6)
        .toBeGreaterThanOrEqual(state.recruitmentReadiness);
    }

    expect(compared).toBeGreaterThan(0);
  });

  it('keeps young frontier recruits visually behind the established core', () => {
    const { build } = maturityPlan('2026-07-31');
    const base = buildReefLivingCanopyPlan(build);
    const template = base.colonies[0];
    if (!template) throw new Error('Expected a canopy colony.');
    const layoutTemplate = build.layout.colonies.find(
      (colony) => colony.id === template.sourceColonyId,
    );
    if (!layoutTemplate) throw new Error('Expected a matching layout colony.');

    const members = Array.from({ length: 5 }, (_value, index) => {
      const source = index === 0
        ? template
        : {
            ...template,
            id: `${template.id}:maturity-recruit:${index}`,
            sourceColonyId: `${template.sourceColonyId}:maturity-recruit:${index}`,
            seed: (template.seed + index * 7_123) >>> 0,
            request: {
              ...template.request,
              id: `${template.request.id}:maturity-recruit:${index}`,
              sequence: template.request.sequence + index,
            },
          };
      return {
        ...source,
        footprintRadius: 0.055,
        request: {
          ...source.request,
          footprintRadius: 0.055,
        },
      };
    });
    const syntheticLayout = members.slice(1).map((member) => ({
      ...layoutTemplate,
      id: member.sourceColonyId,
      seed: member.seed,
    }));
    const syntheticBuild = {
      ...build,
      layout: {
        ...build.layout,
        colonies: [...build.layout.colonies, ...syntheticLayout],
      },
    };
    const sourcePlan = {
      ...base,
      colonies: members,
      requests: members.map((member) => member.request),
    };
    const habitats = buildReefColonyHabitatPlan(sourcePlan, syntheticBuild);
    const maturity = buildReefColonyMaturityPlan(habitats, syntheticBuild);
    const habitat = maturity.habitats[0];
    if (!habitat) throw new Error('Expected a synthetic habitat.');
    const byId = new Map(
      maturity.plan.colonies.map((colony) => [colony.sourceColonyId, colony] as const),
    );
    const core = byId.get(habitat.growth[0]!.colonyId);
    const frontier = byId.get(habitat.growth.at(-1)!.colonyId);

    expect(habitat.growth[0]?.stage).toBe('core');
    expect(habitat.growth.at(-1)?.stage).toBe('frontier');
    expect(core).toBeDefined();
    expect(frontier).toBeDefined();
    expect((core?.maturity ?? 0) + 1e-6).toBeGreaterThan(frontier?.maturity ?? 0);
  });
});
