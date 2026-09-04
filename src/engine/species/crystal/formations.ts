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
  childRadialBias,
  childRingIndex,
  groundSpread,
  monarchAxialScale,
  monarchFacetCount,
  monarchRadialScale,
  veteranGirth,
  relationshipYears,
  coupleTint,
  yearActivity,
  yearFill,
  yearTogetherness,
} from './growthModel';
import { coupleCrystalHabit } from './habit';
import type {
  CrystalArchetype,
  CrystalColonyBlueprint,
  CrystalGrowthInstruction,
  CrystalSpeciesDiagnostics,
} from './types';

/**
 * The one body every colony has, whatever else it grew.
 *
 * Exported because the string had spread: the profile builder tests for it, the
 * seed is salted with it, and the renderer now has to find her bounds to hang
 * the lights inside her. A literal repeated across four volumes is a rename
 * waiting to break three of them silently.
 */
export const CRYSTAL_MONARCH_BODY_ID = 'crystal:mother';

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

/**
 * Modules that record something the couple decided to do, as opposed to
 * something they kept or bought.
 *
 * The monarch's girth used to count every event, which on real data made it
 * almost entirely a photo count — 56 of 104 — and photos already earn her
 * facets. One module was deciding two of her three dimensions while the rest
 * were noise. Counting deliberate acts instead makes the three genuinely
 * independent: height is time, girth is what they did, facets are what they
 * kept.
 *
 * Photos and finished media are both out for the same reason: keeping a
 * photograph and finishing a series are things that happened *to* the couple's
 * shared life rather than decisions about it. Photos already earn facets, and
 * media already carries the year's breadth and its cultural pressure.
 */
const DELIBERATE_MODULES: ReadonlySet<string> = new Set([
  'plans',
  'wishlist',
  'map',
  'calendar',
]);

function deliberateActCount(events: readonly NormalizedEvolutionEvent[]): number {
  return events.filter((event) => DELIBERATE_MODULES.has(eventModule(event.source))).length;
}

export function buildMotherInstruction(
  artifact: ArtifactBlueprint,
  asOf: string,
): CrystalGrowthInstruction {
  const seed = stableSeed(artifact.deterministicSeed, CRYSTAL_MONARCH_BODY_ID);

  /*
   * ФОРМА МОНАРХА — ВІД ДАТИ, як і колір.
   *
   * Тут стояв вибір із трьох архетипів за насінням артефакту — і він
   * нічого не важив: `buildCrystalProfile` перезаписувала його рядком
   * `mother ? 'prismatic' : sourceArchetype`. Тобто в кожної пари світу
   * монарх мав рівно одну форму, і саме та річ, на яку дивляться,
   * єдина не різнилась.
   *
   * Тепер габітус береться з дати початку тим самим розкладом, що й
   * колір, але іншим малюнком (`coupleTraitStep`). Дата — єдина подія,
   * якої пара не обирає щодня, і саме тому вона годиться для риси, що
   * не змінюється ніколи.
   */
  const habit = coupleCrystalHabit(artifact.relationshipStartedAt);

  // Three dimensions, three independent sources (ADR-0004). Height answers
  // "how long have we been together", girth "how much have we put in", facets
  // "how much have we kept". No single module can run away with the monarch
  // because no single module drives more than one of them.
  const daysTogether = daysBetweenExplicit(artifact.relationshipStartedAt, asOf) ?? 0;
  const occurred = occurredEvents(artifact, asOf);
  const colonyTint = coupleTint(artifact.relationshipStartedAt);
  const axialScale = monarchAxialScale(daysTogether);
  // Past the full term the height stops and the couple's history goes into
  // width instead — the owner's rule, and the reason the height curve can stop
  // at all without the artifact going still.
  const radialScale = round6(
    monarchRadialScale(axialScale, deliberateActCount(occurred)) * veteranGirth(daysTogether),
  );

  return {
    id: CRYSTAL_MONARCH_BODY_ID,
    sourceEventId: null,
    sourceEpisodeId: null,
    epochIndex: 0,
    channel: null,
    kind: 'mother',
    tier: 'king',
    archetype: habit,
    emphasized: false,
    weight: 1,
    // Size now comes from the curves above, so maturity no longer scales the
    // monarch. It stays published because downstream volumes read it for
    // optical and life decisions.
    maturity: relationshipMaturityAt(artifact.relationshipStartedAt, asOf),
    axialScale,
    radialScale,
    facetCount: monarchFacetCount(photoYearsOf(occurred), daysTogether),
    azimuthRad: round6(seededUnit(seed, 'azimuth') * Math.PI * 2),
    elevation: 1,
    radialBias: 0,
    attachmentDepth: 0.34,
    // The monarch stands on the axis; nothing to offset her by.
    ringDistance: 0,
    /*
     * Колір усієї друзи — з дати, коли все почалось.
     *
     * Монарх публікує ОДИН тон на колонію, і Volume VI фарбує ним
     * оболонку кожного тіла (`bodyColor`). Раніше тут стояв колір від
     * подарованих бажань, а в кожної дитини — свій, за її рік. Обидва
     * пішли: власник назвав колір ідентичністю пари, а ідентичність не
     * може бути різною в різних частинах одного кристала.
     *
     * Це й друга половина «цільності». Тіло стало одне після того, як
     * пішла спідниця (ADR-0058); тепер і колір один.
     */
    tintRgb: colonyTint.rgb,
    iridescence: colonyTint.iridescence,
    // Where the couple has been is the ground they grow from.
    groundSpread: groundSpread(
      occurred.filter((event) => eventModule(event.source) === 'map').length,
    ),
    seed,
  };
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

/**
 * Everything the colony needs beyond the artifact itself.
 *
 * An object rather than three more positional arguments: the list grows every
 * time a module outside the event ledger earns a say, and a call site with four
 * unlabelled trailing values is one transposition away from a silent defect.
 */
export interface CrystalColonyContext {
  /** `YYYY-MM-DD` days both partners had off. See `CrystalSpeciesConfig`. */
  sharedDaysOff: readonly string[];
}

export const EMPTY_COLONY_CONTEXT: CrystalColonyContext = {
  sharedDaysOff: [],
};

/** `YYYY-MM-DD` prefixes, so bucketing by year needs no date parsing. */
function withinYear(value: string, startsAt: string, endsAt: string): boolean {
  return value >= startsAt.slice(0, value.length) && value < endsAt.slice(0, value.length);
}

/**
 * Wishes granted during one year, split into the three colour channels.
 *
 * A wish counts for a partner's channel only when the *other* one granted it:
 * the colour is about what they gave each other, so fulfilling your own wish
 * leaves the crystal exactly as white as it was.
 */

export function buildAnnualFormations(
  artifact: ArtifactBlueprint,
  asOf: string,
  context: CrystalColonyContext = EMPTY_COLONY_CONTEXT,
): CrystalGrowthInstruction[] {
  const asOfEpoch = parseEvolutionInstant(asOf);
  if (asOfEpoch === null) return [];
  const monarchNow = monarchAxialScale(
    daysBetweenExplicit(artifact.relationshipStartedAt, asOf) ?? 0,
  );
  // Один тон на всю колонію — див. монарха.
  const colonyTint = coupleTint(artifact.relationshipStartedAt);
  /*
   * Габітус монарха потрібен тут не для форми, а для ПОСАДКИ: наскільки
   * він ширший за свій оголошений радіус, залежить від габітусу, і кільце
   * років обходить саме справжню ширину (`monarchFootWidth`).
   */
  const monarchHabit = coupleCrystalHabit(artifact.relationshipStartedAt);
  const monarchRadialNow = monarchRadialScale(
    monarchNow,
    occurredEvents(artifact, asOf).length,
  );
  // The ring step follows the widest a year crystal could be, not the widest
  // this couple happens to have: a backfilled year may not shift the ring the
  // years around it already stand on.
  const years = relationshipYears(
    artifact.relationshipStartedAt, asOf, artifact.leapDayPolicy,
  );
  // How many bodies each ring actually seats. A ring is a circle, so this is
  // half of what decides its radius — see `ringSeatingRadius`.
  const ringOccupancy = new Map<number, number>();
  for (const year of years) {
    const ring = childRingIndex(year.index);
    ringOccupancy.set(ring, (ringOccupancy.get(ring) ?? 0) + 1);
  }
  const widestChildRadialScale = childDimensions(monarchNow, 1, years.length, 0).radialScale;

  return years
    .map((year) => {
      const id = `crystal:year:${year.index + 1}`;
      const seed = stableSeed(artifact.deterministicSeed, id);
      const yearEvents = eventsWithin(artifact, year.startsAt, year.endsAt, asOfEpoch);
      // How lived-in the year was: mostly how many parts of the portal it
      // touched, and only partly how much. See `yearActivity`.
      const modules = new Set(yearEvents.map((event) => eventModule(event.source)));
      const activity = yearActivity(modules.size, yearEvents.length);

      /*
       * Дитина застигає У СВОЄМУ РОЦІ.
       * ------------------------------------------------------------
       * Тут стояло протилежне: кожен рік мірявся об монарха, ЯКИМ ВІН Є
       * СЬОГОДНІ, «щоб кільце лишалось пропорційним до неї». Наслідок —
       * усі діти росли разом із монархом вічно, і кільце показувало не
       * історію, а одну й ту саму пропорцію в кожному віці пари.
       *
       * Власник назвав інше правило: висота дитини — це висота монарха
       * НА КІНЕЦЬ ЇЇ РОКУ, і більше вона не змінюється ніколи. З цього
       * виходить дві речі одразу.
       *
       * Перша: «дочірні ніколи не наздоганяють монарха» виконується ЗА
       * ПОБУДОВОЮ, а не перевіркою після. Монарх лише росте, дитина
       * зафіксована на частці минулого значення — наздогнати нічим.
       *
       * Друга, і заради неї це й робилось: кільце стає літописом. Видно,
       * який рік був сильніший, бо різні роки більше не однакові за
       * визначенням.
       *
       * Рік, який ще триває, міряється сьогоднішнім монархом — інакше
       * поточна дитина не росла б разом із парою до самої річниці.
       */
      const monarchAtYearEnd = year.complete
        ? monarchAxialScale(
          daysBetweenExplicit(artifact.relationshipStartedAt, year.endsAt) ?? 0,
        )
        : monarchNow;
      const progress = childGrowthProgress(year, asOf);
      // Time the two of them actually had together, from the work schedule.
      // Bucketed here rather than by the app so the engine keeps its own clock
      // discipline: these are plain date prefixes compared as strings.
      const togetherness = yearTogetherness(
        context.sharedDaysOff.filter((day) => withinYear(day, year.startsAt, year.endsAt)).length,
      );
      const fill = yearFill(progress, activity, togetherness);
      /*
       * Розмір колонії — теж станом на рік дитини: на кінець року `k`
       * тіл було `k + 1`. Число, яке після річниці вже ніколи не
       * зміниться, тож і дитина не зміниться. Рік, який ще триває,
       * бачить колонію такою, яка вона зараз.
       */
      const colonyAtYearEnd = year.complete ? year.index + 1 : years.length;
      const size = childDimensions(monarchAtYearEnd, fill, colonyAtYearEnd, seed);
      const ringIndex = childRingIndex(year.index);


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
        // Leaning away from the monarch, 45–55° above the platform. See
        // `childRadialBias`: the lean shares this crystal's own azimuth, so the
        // tip travels radially outward and the clearance only ever grows.
        radialBias: childRadialBias(seed),
        attachmentDepth: 0.2,
        ringDistance: childDistance({
          monarchRadialScale: monarchRadialNow,
          monarchArchetype: monarchHabit,
          childArchetype: chooseArchetype('remembrance', seed, id),
          childRadialScale: size.radialScale,
          widestChildRadialScale,
          ringIndex,
          ringOccupancy: ringOccupancy.get(ringIndex) ?? 1,
        }),
        // A year with no gifts stays the white every crystal is born as.
        // Той самий колір, що й у монарха: він належить парі, а не року.
        tintRgb: colonyTint.rgb,
        iridescence: colonyTint.iridescence,
        // Only the monarch speaks for the ground.
        groundSpread: 1,
        seed,
      };
    });
}

/**
 * Усе, що росте біля монарха, — і це рівно роки.
 * ------------------------------------------------------------
 * Тут була ще «спідниця»: до двадцяти чотирьох дрібних кристалів, по
 * одному на кожен виконаний план, які стояли БІЛЯ монарха й не кріпились
 * до неї. Саме вони робили з артефакта купу окремих тіл — власник
 * сформулював вимогу прямо: «кристал у нас має бути цільним».
 *
 * Ідея спідниці була не безглузда — виконаний план справді варто чимось
 * позначити. Але позначка коштувала єдиного, заради чого об'єкт існує:
 * замість одного кристала, який росте, пара бачила двадцять п'ять
 * дрібних, серед яких головний просто найбільший.
 *
 * Виконані плани не зникли з моделі: вони й далі рахуються як події
 * свого модуля й через `yearActivity` роблять свій рік повнішим — тобто
 * впливають на те, як виглядає рік, а не додають нове тіло в кадр.
 */
export function buildCrystalFormations(
  artifact: ArtifactBlueprint,
  asOf: string,
  context: CrystalColonyContext = EMPTY_COLONY_CONTEXT,
): { formations: CrystalGrowthInstruction[]; diagnostics: CrystalSpeciesDiagnostics } {
  const asOfEpoch = parseEvolutionInstant(asOf);
  if (asOfEpoch === null) throw new Error(`Invalid Crystal Species asOf: "${asOf}".`);

  const formations = [...buildAnnualFormations(artifact, asOf, context)];

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
