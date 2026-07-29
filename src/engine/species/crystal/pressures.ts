import type { ArtifactBlueprint } from '../../evolution';
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

export function buildCrystalState(
  artifact: ArtifactBlueprint,
  ageDays: number,
  pressures: CrystalSpeciesPressures,
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
    density: round6(clamp01((pressures.density - 1) / 0.3)),
    luminosity: pressures.luminosity,
  };
}
