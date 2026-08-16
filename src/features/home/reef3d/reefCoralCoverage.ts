import type { ReefColonyMorphotype } from '@/engine/species/reef';
import type { ReefLivingCanopyColony, ReefLivingCanopyPlan } from './reefLivingCanopy';
import type { ReefColonyHabitatSummary } from './reefColonyHabitats';

export const REEF_CORAL_COVERAGE_VERSION = 'reef-coral-coverage-v1';
export const REEF_CORAL_MAX_COVERAGE_RATIO = 0.62;

export interface ReefCoralHabitatCoverage {
  habitatId: string;
  usableArea: number;
  occupiedArea: number;
  coverageRatio: number;
  visibleMemberCount: number;
  suppressedMemberCount: number;
  scaledMemberCount: number;
}

export interface ReefCoralCoverageSummary {
  version: typeof REEF_CORAL_COVERAGE_VERSION;
  maxCoverageRatio: number;
  sourceColonyCount: number;
  visibleColonyCount: number;
  suppressedColonyCount: number;
  scaledColonyCount: number;
  estimatedCoverageRatio: number;
  habitats: ReefCoralHabitatCoverage[];
}

export interface ReefCoralCoveragePlan {
  plan: ReefLivingCanopyPlan;
  habitats: ReefColonyHabitatSummary[];
  summary: ReefCoralCoverageSummary;
}

function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function emptyMorphotypeCounts(): Record<ReefColonyMorphotype, number> {
  return {
    branching: 0,
    massive: 0,
    plating: 0,
    encrusting: 0,
    'soft-coral': 0,
    'sea-fan': 0,
  };
}

function footprintArea(radius: number): number {
  const safeRadius = Math.max(0, radius);
  return Math.PI * safeRadius * safeRadius;
}

function withFootprint(
  colony: ReefLivingCanopyColony,
  footprintRadius: number,
): ReefLivingCanopyColony {
  const radius = round6(footprintRadius);
  return {
    ...colony,
    footprintRadius: radius,
    request: {
      ...colony.request,
      footprintRadius: radius,
    },
  };
}

export function applyReefCoralCoverage({
  plan,
  habitats,
}: {
  plan: ReefLivingCanopyPlan;
  habitats: readonly ReefColonyHabitatSummary[];
}): ReefCoralCoveragePlan {
  const colonyById = new Map(
    plan.colonies.map((colony) => [colony.sourceColonyId, colony] as const),
  );
  const visibleById = new Map<string, ReefLivingCanopyColony>();
  const habitatCoverage: ReefCoralHabitatCoverage[] = [];
  const visibleHabitats: ReefColonyHabitatSummary[] = [];
  let totalUsableArea = 0;
  let totalOccupiedArea = 0;
  let scaledColonyCount = 0;

  for (const habitat of habitats) {
    const members = habitat.memberColonyIds
      .map((id) => colonyById.get(id))
      .filter((colony): colony is ReefLivingCanopyColony => Boolean(colony))
      .sort((left, right) => (
        left.request.sequence - right.request.sequence
        || left.sourceColonyId.localeCompare(right.sourceColonyId)
      ));
    if (members.length === 0) continue;

    const firstRadius = Math.max(0.045, members[0]!.footprintRadius);
    const usableRadius = Math.max(
      habitat.spreadRadius,
      firstRadius / Math.sqrt(REEF_CORAL_MAX_COVERAGE_RATIO),
    );
    const usableArea = footprintArea(usableRadius);
    const areaBudget = usableArea * REEF_CORAL_MAX_COVERAGE_RATIO;
    const visibleIds: string[] = [];
    let occupiedArea = 0;
    let scaledMemberCount = 0;

    for (const colony of members) {
      const remainingArea = Math.max(0, areaBudget - occupiedArea);
      const originalRadius = Math.max(0.045, colony.footprintRadius);
      const originalArea = footprintArea(originalRadius);
      const minimumRadius = Math.max(0.045, originalRadius * 0.58);
      const minimumArea = footprintArea(minimumRadius);

      if (visibleIds.length > 0 && remainingArea + 1e-9 < minimumArea) continue;

      const fittedRadius = originalArea <= remainingArea + 1e-9
        ? originalRadius
        : Math.sqrt(Math.max(0, remainingArea) / Math.PI);
      const acceptedRadius = Math.max(0.045, Math.min(originalRadius, fittedRadius));
      const accepted = withFootprint(colony, acceptedRadius);
      const acceptedArea = footprintArea(accepted.footprintRadius);
      visibleById.set(colony.sourceColonyId, accepted);
      visibleIds.push(colony.sourceColonyId);
      occupiedArea += acceptedArea;
      if (accepted.footprintRadius + 1e-6 < colony.footprintRadius) {
        scaledMemberCount += 1;
        scaledColonyCount += 1;
      }
    }

    const visibleIdSet = new Set(visibleIds);
    const visibleGrowth = habitat.growth.filter((growth) => visibleIdSet.has(growth.colonyId));
    const activeRadius = visibleGrowth.reduce(
      (maximum, growth) => Math.max(maximum, growth.distanceFromCenter),
      0,
    );
    visibleHabitats.push({
      ...habitat,
      activeRadius: round6(activeRadius),
      memberColonyIds: visibleIds,
      growth: visibleGrowth,
    });

    totalUsableArea += usableArea;
    totalOccupiedArea += occupiedArea;
    habitatCoverage.push({
      habitatId: habitat.id,
      usableArea: round6(usableArea),
      occupiedArea: round6(occupiedArea),
      coverageRatio: round6(usableArea <= 1e-9 ? 0 : occupiedArea / usableArea),
      visibleMemberCount: visibleIds.length,
      suppressedMemberCount: members.length - visibleIds.length,
      scaledMemberCount,
    });
  }

  for (const colony of plan.colonies) {
    if (visibleById.has(colony.sourceColonyId)) continue;
    const belongsToHabitat = habitats.some((habitat) => habitat.memberColonyIds.includes(colony.sourceColonyId));
    if (!belongsToHabitat) visibleById.set(colony.sourceColonyId, colony);
  }

  const colonies = plan.colonies
    .map((colony) => visibleById.get(colony.sourceColonyId))
    .filter((colony): colony is ReefLivingCanopyColony => Boolean(colony));
  const morphotypeCounts = emptyMorphotypeCounts();
  for (const colony of colonies) morphotypeCounts[colony.morphotype] += 1;

  const sourceColonyCount = plan.colonies.length;
  const visibleColonyCount = colonies.length;
  const suppressedColonyCount = Math.max(0, sourceColonyCount - visibleColonyCount);

  return {
    plan: {
      ...plan,
      colonies,
      requests: colonies.map((colony) => colony.request),
      morphotypeCounts,
    },
    habitats: visibleHabitats,
    summary: {
      version: REEF_CORAL_COVERAGE_VERSION,
      maxCoverageRatio: REEF_CORAL_MAX_COVERAGE_RATIO,
      sourceColonyCount,
      visibleColonyCount,
      suppressedColonyCount,
      scaledColonyCount,
      estimatedCoverageRatio: round6(
        totalUsableArea <= 1e-9 ? 0 : totalOccupiedArea / totalUsableArea,
      ),
      habitats: habitatCoverage,
    },
  };
}
