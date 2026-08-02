import type { ArtifactBlueprint } from '../../evolution';
import { parseEvolutionInstant } from '../../evolution/calendar';
import { CONSISTENCY_WINDOW_MONTHS, consistency } from './growthModel';
import {
  channelEvenness,
  clamp01,
  dominantChannel,
  normalizedShares,
  round6,
  saturate,
} from './math';
import type { CrystalLifeStage, CrystalSpeciesPressures, CrystalSpeciesState } from './types';

export function buildCrystalPressures(artifact: ArtifactBlueprint): CrystalSpeciesPressures {
  const channels = artifact.pressureLedger.channels;
  const harmony = channelEvenness(channels);
  const dominant = dominantChannel(channels);
  const portalActivity = artifact.pressureLedger.portalActivity;

  const expansion = saturate(
    channels.exploration + channels.achievement * 0.16,
    3.2,
  );
  const refinement = saturate(
    channels.remembrance * 0.72 + channels.significance * 0.24 + portalActivity * 0.06,
    4.2,
  );
  const luminosity = saturate(
    channels.remembrance + channels.significance * 0.62,
    3.4,
  );
  const warmth = saturate(
    channels.culture * 0.82 + channels.stability * 0.22,
    3.8,
  );
  const stability = saturate(
    channels.stability + channels.significance * 0.26,
    3.0,
  );
  const brilliance = saturate(
    channels.significance * 0.72 + channels.achievement * 0.42 + channels.culture * 0.2,
    3.1,
  );
  const surfaceComplexity = saturate(
    channels.exploration * 0.78 + channels.culture * 0.48 + channels.achievement * 0.24,
    3.8,
  );
  const branching = saturate(
    artifact.pressureLedger.eventCount * 0.18 + channels.exploration * 0.45 + channels.achievement * 0.38,
    4.5,
  );
  const mutation = saturate(
    channels.exploration * 0.3 + channels.culture * 0.34 + channels.significance * 0.18 + (1 - harmony) * 1.2,
    3.7,
  );
  const density = round6(1 + 0.3 * saturate(
    channels.stability + channels.achievement * 0.2 + channels.significance * 0.12,
    4.0,
  ));

  return {
    expansion,
    refinement,
    luminosity,
    warmth,
    stability,
    harmony,
    brilliance,
    surfaceComplexity,
    density,
    branching,
    mutation,
    dominantChannel: dominant.channel,
    dominance: dominant.share,
    channelShare: normalizedShares(channels),
  };
}

function lifeStage(
  ageDays: number,
  eventCount: number,
  pressures: CrystalSpeciesPressures,
): CrystalLifeStage {
  if (eventCount === 0 && ageDays < 30) return 'nucleation';
  if (ageDays < 180 || eventCount < 4) return 'growth';
  if (pressures.harmony < 0.56 && pressures.branching > 0.42) return 'competition';
  if (pressures.refinement > 0.58 && ageDays > 540) return 'polishing';
  if (ageDays > 1_000 && pressures.stability > 0.56) return 'stabilization';
  return 'growth';
}

/**
 * Distinct calendar months in which anything at all was logged, within the
 * consistency window ending at the artifact's clock.
 *
 * Months rather than days because a relationship is not a streak counter: the
 * question is "did this month have anything in it", not "how many days in a
 * row".
 */
function monthsTouchedWithinWindow(artifact: ArtifactBlueprint, asOf: string): number {
  const asOfEpoch = parseEvolutionInstant(asOf);
  if (asOfEpoch === null) return 0;

  const asOfDate = new Date(asOfEpoch);
  const asOfMonth = asOfDate.getUTCFullYear() * 12 + asOfDate.getUTCMonth();
  const months = new Set<number>();

  for (const event of artifact.events) {
    if (event.occurredAtEpochMs > asOfEpoch) continue;
    const date = new Date(event.occurredAtEpochMs);
    const month = date.getUTCFullYear() * 12 + date.getUTCMonth();
    if (asOfMonth - month >= CONSISTENCY_WINDOW_MONTHS || month > asOfMonth) continue;
    months.add(month);
  }

  return months.size;
}

export function buildCrystalState(
  artifact: ArtifactBlueprint,
  ageDays: number,
  pressures: CrystalSpeciesPressures,
  asOf: string,
): CrystalSpeciesState {
  const epochCount = artifact.pressureLedger.epochs.length;
  const eventCount = artifact.pressureLedger.eventCount;
  const stress = round6(clamp01((1 - pressures.harmony) * 0.72 + pressures.mutation * 0.28));
  const cohesion = round6(clamp01((pressures.stability + pressures.harmony) / 2));
  const purity = round6(clamp01(pressures.refinement * (0.64 + pressures.stability * 0.36)));
  const energy = round6(clamp01(
    pressures.expansion * 0.34
      + pressures.brilliance * 0.34
      + pressures.branching * 0.2
      + pressures.luminosity * 0.12,
  ));
  const fracture = round6(clamp01(
    stress * (1 - pressures.stability) * 0.82 + pressures.mutation * 0.18,
  ));

  return {
    ageDays,
    epochCount,
    eventCount,
    stage: lifeStage(ageDays, eventCount, pressures),
    stress,
    purity,
    cohesion,
    energy,
    fracture,
    consistency: consistency(
      monthsTouchedWithinWindow(artifact, asOf),
      Math.floor(ageDays / 30.44),
    ),
    density: round6(clamp01((pressures.density - 1) / 0.3)),
    luminosity: pressures.luminosity,
  };
}
