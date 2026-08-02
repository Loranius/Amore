import {
  type ArtifactBlueprint,
  type EvolutionChannel,
  type NormalizedEvolutionEvent,
} from '../../evolution';
import { parseEvolutionInstant } from '../../evolution/calendar';
import {
  daysBetweenExplicit,
  relationshipMaturityAt,
  round6,
  saturate,
  seededUnit,
  stableSeed,
} from './math';
import {
  childAzimuthRad,
  childDimensions,
  childDistance,
  childGrowthProgress,
  childRingIndex,
  monarchAxialScale,
  monarchFacetCount,
  monarchRadialScale,
  relationshipYears,
  wishTint,
  yearActivity,
  yearFill,
  type WishGiftTally,
} from './growthModel';
import type {
  CrystalArchetype,
  CrystalColonyBlueprint,
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

/** Which portal module an event came from, e.g. `memories@1.0.0` -> `memories`. */
export function eventModule(source: string): string {
  const at = source.indexOf('@');
  return at === -1 ? source : source.slice(0, at);
}

/**
 * Completed relationship years at each photo's date.
 *
 * `epochIndex` is already exactly that — the Evolution volume computes it as
 * the number of anniversaries passed when the event occurred — so the facet
 * accumulator needs no date arithmetic of its own.
 */
function photoYearsOf(events: readonly NormalizedEvolutionEvent[]): number[] {
  return events
    .filter((event) => eventModule(event.source) === 'memories')
    .map((event) => event.epochIndex);
}

/** Facts that had already happened at `at`. A later record may not reach back. */
function occurredEvents(
  artifact: ArtifactBlueprint,
  at: string,
): NormalizedEvolutionEvent[] {
  const epoch = parseEvolutionInstant(at);
  if (epoch === null) return [];
  return artifact.events.filter((event) => event.occurredAtEpochMs <= epoch);
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

  // Three dimensions, three independent sources (ADR-0004). Height answers
  // "how long have we been together", girth "how much have we put in", facets
  // "how much have we kept". No single module can run away with the monarch
  // because no single module drives more than one of them.
  const daysTogether = daysBetweenExplicit(artifact.relationshipStartedAt, asOf) ?? 0;
  const occurred = occurredEvents(artifact, asOf);
  const axialScale = monarchAxialScale(daysTogether);
  const radialScale = monarchRadialScale(axialScale, occurred.length);

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
    // Size now comes from the curves above, so maturity no longer scales the
    // monarch. It stays published because downstream volumes read it for
    // optical and life decisions.
    maturity: relationshipMaturityAt(artifact.relationshipStartedAt, asOf),
    axialScale,
    radialScale,
    facetCount: monarchFacetCount(photoYearsOf(occurred)),
    azimuthRad: round6(seededUnit(seed, 'azimuth') * Math.PI * 2),
    elevation: 1,
    radialBias: 0,
    attachmentDepth: 0.34,
    // The monarch stands on the axis; nothing to offset her by.
    ringDistance: 0,
    tintRgb: [1, 1, 1] as const,
    iridescence: 0,
    seed,
  };
}

/**
 * Events that count as important enough to pull a year's crystal closer to
 * the monarch, and to feed its size.
 *
 * Anniversaries and milestones only, by the owner's choice. Note this is a
 * deliberately sparse signal — a real couple logged six such records across
 * three and a half years — which is why one event is worth a quarter of the
 * distance rather than a nudge.
 */
function isImportantEvent(event: NormalizedEvolutionEvent): boolean {
  return eventModule(event.source) === 'calendar';
}

/**
 * Every event inside `[startsAt, endsAt)` that has actually happened.
 *
 * The `asOf` bound is not redundant with the year window: the year in
 * progress ends in the future, so without it a plan dated next month would
 * already be feeding this year's crystal. A fact may only ever affect the
 * artifact once it has occurred.
 */
function eventsWithin(
  artifact: ArtifactBlueprint,
  startsAt: string,
  endsAt: string,
  asOfEpoch: number,
): NormalizedEvolutionEvent[] {
  const from = parseEvolutionInstant(startsAt);
  const to = parseEvolutionInstant(endsAt);
  if (from === null || to === null) return [];
  return artifact.events.filter(
    (event) => event.occurredAtEpochMs >= from
      && event.occurredAtEpochMs < to
      && event.occurredAtEpochMs <= asOfEpoch,
  );
}

/**
 * One crystal per relationship year (ADR-0004).
 *
 * Born on the anniversary, grown in twelve monthly steps, frozen at the next
 * anniversary. Because a frozen year keeps half of the monarch *as she was
 * then*, and she keeps growing afterwards, the finished ring reads as a
 * growth history on its own.
 */
/** Which partner each colour channel belongs to; see `CrystalSpeciesConfig`. */
export type CrystalColorPartners = { first: number | null; second: number | null } | null;

/**
 * Wishes granted during one year, split into the three colour channels.
 *
 * A wish counts for a partner's channel only when the *other* one granted it:
 * the colour is about what they gave each other, so fulfilling your own wish
 * leaves the crystal exactly as white as it was.
 */
function wishTallyForYear(
  yearEvents: readonly NormalizedEvolutionEvent[],
  partners: CrystalColorPartners,
): WishGiftTally {
  const tally: WishGiftTally = { forFirst: 0, shared: 0, forSecond: 0 };
  if (partners === null) return tally;

  for (const event of yearEvents) {
    if (eventModule(event.source) !== 'wishlist') continue;
    const attribution = event.attribution;
    if (attribution === undefined) continue;

    if (attribution.shared) {
      tally.shared += 1;
      continue;
    }
    const { subjectId, actorId } = attribution;
    if (subjectId === null || actorId === null || subjectId === actorId) continue;
    if (subjectId === partners.first && actorId === partners.second) tally.forFirst += 1;
    else if (subjectId === partners.second && actorId === partners.first) tally.forSecond += 1;
  }

  return tally;
}

export function buildAnnualFormations(
  artifact: ArtifactBlueprint,
  asOf: string,
  partners: CrystalColorPartners = null,
): CrystalGrowthInstruction[] {
  const asOfEpoch = parseEvolutionInstant(asOf);
  if (asOfEpoch === null) return [];
  const monarchNow = monarchAxialScale(
    daysBetweenExplicit(artifact.relationshipStartedAt, asOf) ?? 0,
  );
  const monarchRadialNow = monarchRadialScale(
    monarchNow,
    occurredEvents(artifact, asOf).length,
  );

  return relationshipYears(artifact.relationshipStartedAt, asOf, artifact.leapDayPolicy)
    .map((year) => {
      const id = `crystal:year:${year.index + 1}`;
      const seed = stableSeed(artifact.deterministicSeed, id);
      const yearEvents = eventsWithin(artifact, year.startsAt, year.endsAt, asOfEpoch);
      const importantEventCount = yearEvents.filter(isImportantEvent).length;
      // How lived-in the year was: mostly how many parts of the portal it
      // touched, and only partly how much. See `yearActivity`.
      const modules = new Set(yearEvents.map((event) => eventModule(event.source)));
      const activity = yearActivity(modules.size, yearEvents.length);

      // Every year is measured against the monarch as she stands today, so
      // the ring stays proportional to her and a couple who filled in their
      // early years sees those crystals grow. What stops at the anniversary
      // is the year's *fill* — its share of the maximum — not its size in
      // absolute units.
      const progress = childGrowthProgress(year, asOf);
      const fill = yearFill(progress, activity);
      const size = childDimensions(monarchNow, fill);
      const ringIndex = childRingIndex(year.index);
      const tint = wishTint(wishTallyForYear(yearEvents, partners));

      return {
        id,
        sourceEventId: null,
        sourceEpisodeId: null,
        epochIndex: year.index,
        channel: null,
        kind: 'annual' as const,
        tier: year.complete ? ('support' as const) : ('family' as const),
        archetype: chooseArchetype('remembrance', seed, id),
        emphasized: year.complete,
        weight: fill,
        maturity: progress,
        axialScale: size.axialScale,
        radialScale: size.radialScale,
        // Years carry more facets the fuller they were, within the same range
        // the monarch uses so the ring never out-detail the centre.
        facetCount: 6 + Math.round(activity * 2),
        azimuthRad: childAzimuthRad(year.index),
        elevation: 1,
        radialBias: 0,
        attachmentDepth: 0.2,
        ringDistance: childDistance({
          monarchRadialScale: monarchRadialNow,
          childRadialScale: size.radialScale,
          ringIndex,
          importantEventCount,
        }),
        // A year with no gifts stays the white every crystal is born as.
        tintRgb: tint.rgb,
        iridescence: tint.iridescence,
        seed,
      };
    });
}

/** Distance from the axis for the skirt: just clear of the substrate mound. */
const SKIRT_RING_DISTANCE = 0.34;
/** Beyond this the skirt reads as gravel; further plans thicken it instead. */
const SKIRT_MAX_BODIES = 24;

/**
 * A small crystal for every completed plan (ADR-0004).
 *
 * These do not grow. A plan is something the couple finished, so its crystal
 * is a mark rather than an organism — it appears beside the monarch, never
 * attached to her, and stays the size it arrived at.
 */
export function buildSkirtFormations(
  artifact: ArtifactBlueprint,
  asOf: string,
): CrystalGrowthInstruction[] {
  const asOfEpoch = parseEvolutionInstant(asOf);
  if (asOfEpoch === null) return [];

  const completed = artifact.events
    .filter((event) => eventModule(event.source) === 'plans')
    .filter((event) => event.occurredAtEpochMs <= asOfEpoch)
    .slice(0, SKIRT_MAX_BODIES);

  return completed.map((event, index) => {
    const id = `crystal:plan:${event.id}`;
    const seed = stableSeed(artifact.deterministicSeed, id);
    // Enough size spread that the ring reads as pebbles of a real place
    // rather than a row of identical pins.
    const scale = 0.09 + seededUnit(seed, 'size') * 0.05;

    return {
      id,
      sourceEventId: event.id,
      sourceEpisodeId: event.episodeId,
      epochIndex: event.epochIndex,
      channel: null,
      kind: 'skirt' as const,
      tier: 'micro' as const,
      archetype: 'prismatic' as const,
      emphasized: false,
      weight: 0.2,
      maturity: 1,
      axialScale: round6(scale),
      radialScale: round6(scale * 0.3),
      facetCount: 5,
      azimuthRad: childAzimuthRad(index + 3),
      elevation: 1,
      radialBias: 0,
      attachmentDepth: 0.12,
      ringDistance: round6(SKIRT_RING_DISTANCE + seededUnit(seed, 'ring') * 0.07),
      tintRgb: [1, 1, 1] as const,
      iridescence: 0,
      seed,
    };
  });
}

/**
 * Everything the crystal grows besides the monarch, in a stable order:
 * years first, then the skirt.
 */
export function buildCrystalFormations(
  artifact: ArtifactBlueprint,
  asOf: string,
  partners: CrystalColorPartners = null,
): { formations: CrystalGrowthInstruction[]; diagnostics: CrystalSpeciesDiagnostics } {
  const asOfEpoch = parseEvolutionInstant(asOf);
  if (asOfEpoch === null) throw new Error(`Invalid Crystal Species asOf: "${asOf}".`);

  const formations = [
    ...buildAnnualFormations(artifact, asOf, partners),
    ...buildSkirtFormations(artifact, asOf),
  ];

  return {
    formations,
    diagnostics: {
      // A couple always has the year they are living in, so an empty history
      // now means the relationship start date itself is unusable.
      emptyHistory: formations.length === 0,
      zeroPressureEventIds: [],
      futureEventIds: artifact.events
        .filter((event) => event.occurredAtEpochMs > asOfEpoch)
        .map((event) => event.id)
        .sort(),
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
