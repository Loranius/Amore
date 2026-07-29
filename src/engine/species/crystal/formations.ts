import {
  EVOLUTION_CHANNELS,
  type ArtifactBlueprint,
  type EvolutionChannel,
  type EvolutionPressureVector,
  type NormalizedEvolutionEvent,
} from '../../evolution';
import { parseEvolutionInstant } from '../../evolution/calendar';
import {
  clamp01,
  daysBetweenExplicit,
  maturityAt,
  round6,
  saturate,
  seededUnit,
  stableSeed,
  vectorTotal,
} from './math';
import type {
  CrystalArchetype,
  CrystalColonyBlueprint,
  CrystalFormationKind,
  CrystalFormationTier,
  CrystalGrowthInstruction,
  CrystalSpeciesDiagnostics,
} from './types';

const ARCHETYPES: Readonly<Record<EvolutionChannel, readonly CrystalArchetype[]>> = {
  achievement: ['twin', 'intergrown', 'prismatic'],
  remembrance: ['etched', 'tabular', 'prismatic'],
  exploration: ['needle', 'fan', 'split'],
  culture: ['blade', 'fan', 'tabular'],
  stability: ['massive', 'tabular', 'intergrown'],
  significance: ['prismatic', 'split', 'twin'],
};

function eventDominantChannel(vector: EvolutionPressureVector): EvolutionChannel | null {
  let channel: EvolutionChannel | null = null;
  let value = 0;
  for (const candidate of EVOLUTION_CHANNELS) {
    if (vector[candidate] > value) {
      channel = candidate;
      value = vector[candidate];
    }
  }
  return channel;
}

function chooseArchetype(
  channel: EvolutionChannel,
  seed: number,
  salt: string,
): CrystalArchetype {
  const candidates = ARCHETYPES[channel];
  const index = Math.min(
    candidates.length - 1,
    Math.floor(seededUnit(seed, `${salt}:archetype`) * candidates.length),
  );
  return candidates[index] ?? candidates[0]!;
}

function formationKind(
  channel: EvolutionChannel,
  emphasized: boolean,
): CrystalFormationKind {
  if (emphasized) return 'event-spire';
  if (channel === 'achievement' || channel === 'exploration' || channel === 'significance') {
    return 'satellite';
  }
  return 'inclusion';
}

function formationTier(weight: number, emphasized: boolean): CrystalFormationTier {
  if (emphasized) return 'support';
  if (weight >= 0.65) return 'family';
  if (weight >= 0.35) return 'companion';
  return 'micro';
}

function halfLifeFor(kind: CrystalFormationKind): number {
  if (kind === 'event-spire') return 120;
  if (kind === 'satellite') return 75;
  if (kind === 'inclusion') return 50;
  return 180;
}

function directionFor(
  seed: number,
  id: string,
  kind: CrystalFormationKind,
): Pick<CrystalGrowthInstruction, 'azimuthRad' | 'elevation' | 'radialBias'> {
  const azimuthRad = round6(seededUnit(seed, `${id}:azimuth`) * Math.PI * 2);
  const elevationUnit = seededUnit(seed, `${id}:elevation`);
  const radialUnit = seededUnit(seed, `${id}:radial`);

  if (kind === 'event-spire') {
    return {
      azimuthRad,
      elevation: round6(0.72 + elevationUnit * 0.24),
      radialBias: round6(0.18 + radialUnit * 0.37),
    };
  }
  if (kind === 'satellite') {
    return {
      azimuthRad,
      elevation: round6(0.48 + elevationUnit * 0.38),
      radialBias: round6(0.34 + radialUnit * 0.5),
    };
  }
  return {
    azimuthRad,
    elevation: round6(0.34 + elevationUnit * 0.31),
    radialBias: round6(0.12 + radialUnit * 0.27),
  };
}

export function buildMotherInstruction(
  artifact: ArtifactBlueprint,
  asOf: string,
): CrystalGrowthInstruction {
  const seed = stableSeed(artifact.deterministicSeed, 'crystal:mother');
  const motherArchetypes: readonly CrystalArchetype[] = ['prismatic', 'massive', 'intergrown'];
  const archetypeIndex = Math.min(
    motherArchetypes.length - 1,
    Math.floor(seededUnit(seed, 'archetype') * motherArchetypes.length),
  );

  return {
    id: 'crystal:mother',
    sourceEventId: null,
    sourceEpisodeId: null,
    epochIndex: 0,
    channel: null,
    kind: 'mother',
    tier: 'king',
    archetype: motherArchetypes[archetypeIndex] ?? 'prismatic',
    emphasized: false,
    weight: 1,
    maturity: maturityAt(artifact.relationshipStartedAt, asOf, 180),
    azimuthRad: round6(seededUnit(seed, 'azimuth') * Math.PI * 2),
    elevation: 1,
    radialBias: 0,
    attachmentDepth: 0.34,
    seed,
  };
}

function buildEventInstruction(
  artifactSeed: number,
  event: NormalizedEvolutionEvent,
  asOf: string,
): CrystalGrowthInstruction | null {
  const channel = eventDominantChannel(event.channels);
  if (channel === null) return null;

  const totalPressure = vectorTotal(event.channels);
  const weight = saturate(totalPressure + event.portalActivity * 0.16, 1.15);
  const emphasized = event.channels.significance >= 0.75
    || (event.channels.significance >= 0.55 && Math.max(...EVOLUTION_CHANNELS.map((key) => event.channels[key])) >= 0.85);
  const kind = formationKind(channel, emphasized);
  const id = `crystal:event:${event.id}`;
  const seed = stableSeed(artifactSeed, id);
  const direction = directionFor(seed, id, kind);

  return {
    id,
    sourceEventId: event.id,
    sourceEpisodeId: event.episodeId,
    epochIndex: event.epochIndex,
    channel,
    kind,
    tier: formationTier(weight, emphasized),
    archetype: chooseArchetype(channel, seed, id),
    emphasized,
    weight,
    maturity: maturityAt(event.occurredAt, asOf, halfLifeFor(kind)),
    ...direction,
    attachmentDepth: round6(clamp01(
      0.1 + event.channels.stability * 0.13 + event.channels.significance * 0.07,
    )),
    seed,
  };
}

export function buildEventFormations(
  artifact: ArtifactBlueprint,
  asOf: string,
): { formations: CrystalGrowthInstruction[]; diagnostics: CrystalSpeciesDiagnostics } {
  const asOfEpoch = parseEvolutionInstant(asOf);
  if (asOfEpoch === null) throw new Error(`Invalid Crystal Species asOf: "${asOf}".`);

  const formations: CrystalGrowthInstruction[] = [];
  const zeroPressureEventIds: string[] = [];
  const futureEventIds: string[] = [];

  for (const event of artifact.events) {
    if (event.occurredAtEpochMs > asOfEpoch) {
      futureEventIds.push(event.id);
      continue;
    }
    const instruction = buildEventInstruction(artifact.deterministicSeed, event, asOf);
    if (instruction === null) {
      zeroPressureEventIds.push(event.id);
      continue;
    }
    formations.push(instruction);
  }

  formations.sort((left, right) => {
    const leftEvent = artifact.events.find((event) => event.id === left.sourceEventId);
    const rightEvent = artifact.events.find((event) => event.id === right.sourceEventId);
    return (leftEvent?.occurredAtEpochMs ?? 0) - (rightEvent?.occurredAtEpochMs ?? 0)
      || left.id.localeCompare(right.id);
  });

  return {
    formations,
    diagnostics: {
      emptyHistory: formations.length === 0,
      zeroPressureEventIds: zeroPressureEventIds.sort(),
      futureEventIds: futureEventIds.sort(),
    },
  };
}

export function buildColonies(
  artifactSeed: number,
  formations: readonly CrystalGrowthInstruction[],
): CrystalColonyBlueprint[] {
  const grouped = new Map<string, CrystalGrowthInstruction[]>();
  for (const formation of formations) {
    if (formation.channel === null) continue;
    const key = `${formation.epochIndex}:${formation.channel}`;
    const group = grouped.get(key) ?? [];
    group.push(formation);
    grouped.set(key, group);
  }

  const colonies: CrystalColonyBlueprint[] = [];
  for (const [key, members] of grouped) {
    const [epochText, channelText] = key.split(':');
    const epochIndex = Number(epochText);
    const channel = channelText as EvolutionChannel;
    const id = `crystal:colony:${epochIndex}:${channel}`;
    const seed = stableSeed(artifactSeed, id);
    const instructionIds = members.map((member) => member.id).sort();
    const totalWeight = members.reduce((sum, member) => sum + member.weight, 0);

    colonies.push({
      id,
      epochIndex,
      channel,
      seed,
      azimuthRad: round6(seededUnit(seed, 'azimuth') * Math.PI * 2),
      elevation: round6(0.44 + seededUnit(seed, 'elevation') * 0.42),
      weight: saturate(totalWeight, 2.0),
      instructionIds,
    });
  }

  colonies.sort((left, right) => left.epochIndex - right.epochIndex || left.channel.localeCompare(right.channel));
  return colonies;
}

export function relationshipAgeDays(artifact: ArtifactBlueprint, asOf: string): number {
  const ageDays = daysBetweenExplicit(artifact.relationshipStartedAt, asOf);
  if (ageDays === null) {
    throw new Error(`Could not calculate relationship age from "${artifact.relationshipStartedAt}" to "${asOf}".`);
  }
  return ageDays;
}
