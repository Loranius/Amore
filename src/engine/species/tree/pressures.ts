import type { ArtifactBlueprint } from '../../evolution';
import { parseCalendarDate, relationshipEpochIndex } from '../../evolution/calendar';
import {
  channelEvenness,
  clamp01,
  daysBetweenExplicit,
  dominantChannel,
  normalizedShares,
  round6,
  saturate,
} from './math';
import type {
  TreeLifeStage,
  TreeSpeciesPressures,
  TreeSpeciesState,
} from './types';

function stageFor(ageDays: number): TreeLifeStage {
  if (ageDays < 365) return 'sapling';
  if (ageDays < 365 * 3) return 'young';
  if (ageDays < 365 * 7) return 'established';
  if (ageDays < 365 * 15) return 'mature';
  return 'ancient';
}

export function relationshipAgeDays(artifact: ArtifactBlueprint, asOf: string): number {
  const ageDays = daysBetweenExplicit(artifact.relationshipStartedAt, asOf);
  if (ageDays === null) {
    throw new Error(
      `Could not calculate relationship age from "${artifact.relationshipStartedAt}" to "${asOf}".`,
    );
  }
  return ageDays;
}

export function completedRelationshipYears(
  artifact: ArtifactBlueprint,
  asOf: string,
): number {
  const relationshipStart = parseCalendarDate(
    artifact.relationshipStartedAt,
    artifact.timeZone,
  );
  const currentDate = parseCalendarDate(asOf, artifact.timeZone);
  if (!relationshipStart || !currentDate) {
    throw new Error('Tree Species could not resolve relationship calendar dates.');
  }
  return relationshipEpochIndex(relationshipStart, currentDate, artifact.leapDayPolicy);
}

export function buildTreePressures(artifact: ArtifactBlueprint): TreeSpeciesPressures {
  const vector = artifact.pressureLedger.channels;
  const shares = normalizedShares(vector);
  const dominant = dominantChannel(vector);
  const portalActivity = artifact.pressureLedger.portalActivity;

  return {
    trunkExpansion: saturate(
      vector.stability * 1.2 + vector.significance * 0.5 + portalActivity * 0.22,
      1.1,
    ),
    branchEnergy: saturate(
      vector.achievement + vector.exploration * 0.9 + vector.significance * 0.7
        + portalActivity * 0.35,
      1.35,
    ),
    crownSpread: saturate(
      vector.exploration * 1.15 + vector.culture * 0.7 + vector.achievement * 0.3,
      1.05,
    ),
    foliagePotential: saturate(
      vector.remembrance * 0.85 + vector.culture * 0.55 + vector.achievement * 0.4
        + portalActivity * 0.55,
      1.25,
    ),
    rootStability: saturate(
      vector.stability * 1.35 + vector.remembrance * 0.25 + vector.significance * 0.2,
      0.9,
    ),
    asymmetry: round6(clamp01(
      0.18 + dominant.share * 0.52 + shares.exploration * 0.18 + shares.culture * 0.12
        - channelEvenness(vector) * 0.2,
    )),
    memoryDensity: saturate(
      vector.remembrance * 1.3 + vector.significance * 0.28,
      0.95,
    ),
    dominantChannel: dominant.channel,
    dominance: dominant.share,
    channelShare: shares,
  };
}

export function buildTreeState(
  artifact: ArtifactBlueprint,
  asOf: string,
  pressures: TreeSpeciesPressures,
): TreeSpeciesState {
  const ageDays = relationshipAgeDays(artifact, asOf);
  const completedYears = completedRelationshipYears(artifact, asOf);
  const eventCount = artifact.events.length;

  return {
    ageDays,
    completedYears,
    epochCount: completedYears + 1,
    eventCount,
    stage: stageFor(ageDays),
    trunkMaturity: saturate(ageDays, 720),
    canopyMaturity: saturate(ageDays + eventCount * 75, 1_050),
    foliageMaturity: round6(clamp01(
      saturate(ageDays + eventCount * 45, 760) * (0.58 + pressures.foliagePotential * 0.42),
    )),
  };
}
