import {
  EVOLUTION_CHANNELS,
  type ArtifactBlueprint,
  type EvolutionChannel,
  type EvolutionPressureVector,
} from '../../evolution';
import { parseCalendarDate } from '../../evolution/calendar';
import type { LeapDayPolicy } from '../../evolution/types';
import {
  portalModuleOf,
  relationshipYears,
  yearActivity,
  yearFill,
  type RelationshipYear,
} from '../shared/relationshipYear';
import {
  clamp01,
  round6,
  seededUnit,
  stableSeed,
} from './math';
import type {
  TreeGrowthInstruction,
  TreeSpeciesDiagnostics,
  TreeStructureInstruction,
} from './types';

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function anniversaryEpoch(artifact: ArtifactBlueprint, epochIndex: number): number {
  const start = parseCalendarDate(artifact.relationshipStartedAt, artifact.timeZone);
  if (!start) throw new Error('Tree Species could not resolve relationship start date.');
  const year = start.year + epochIndex;
  let month = start.month;
  let day = start.day;
  if (month === 2 && day === 29 && !isLeapYear(year)) {
    if (artifact.leapDayPolicy === 'feb-28') day = 28;
    else {
      month = 3;
      day = 1;
    }
  }
  return Date.UTC(year, month - 1, day);
}

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

function directionRange(channel: EvolutionChannel): {
  minElevation: number;
  elevationSpan: number;
  minRadial: number;
  radialSpan: number;
} {
  if (channel === 'achievement') {
    return { minElevation: 0.67, elevationSpan: 0.26, minRadial: 0.34, radialSpan: 0.34 };
  }
  if (channel === 'remembrance') {
    return { minElevation: 0.43, elevationSpan: 0.28, minRadial: 0.3, radialSpan: 0.34 };
  }
  if (channel === 'exploration') {
    return { minElevation: 0.48, elevationSpan: 0.31, minRadial: 0.68, radialSpan: 0.28 };
  }
  if (channel === 'culture') {
    return { minElevation: 0.5, elevationSpan: 0.3, minRadial: 0.54, radialSpan: 0.34 };
  }
  if (channel === 'stability') {
    return { minElevation: 0.32, elevationSpan: 0.25, minRadial: 0.2, radialSpan: 0.3 };
  }
  return { minElevation: 0.7, elevationSpan: 0.25, minRadial: 0.38, radialSpan: 0.34 };
}

export function buildTreeStructure(artifactSeed: number): TreeStructureInstruction {
  const seed = stableSeed(artifactSeed, 'tree:structure');
  return {
    id: 'tree:structure',
    seed,
    trunkHeight: round6(2.72 + seededUnit(seed, 'trunk-height') * 0.26),
    trunkStep: round6(0.33 + seededUnit(seed, 'trunk-step') * 0.035),
    branchStep: round6(0.225 + seededUnit(seed, 'branch-step') * 0.035),
    crownRadius: round6(2.02 + seededUnit(seed, 'crown-radius') * 0.34),
    crownHeight: round6(2.32 + seededUnit(seed, 'crown-height') * 0.34),
    baseRadius: round6(0.265 + seededUnit(seed, 'base-radius') * 0.035),
    radiusDecay: round6(0.7 + seededUnit(seed, 'radius-decay') * 0.045),
    upwardBias: round6(0.16 + seededUnit(seed, 'upward-bias') * 0.055),
    directionMemory: round6(0.31 + seededUnit(seed, 'direction-memory') * 0.07),
    lateralJitter: round6(0.09 + seededUnit(seed, 'lateral-jitter') * 0.045),
  };
}

/**
 * Скільки листяних згустків несе гілка найбіднішого й найповнішого року.
 *
 * Це та ручка, якою наповненість стає ВИДИМОЮ, не додаючи тіл. Кристал
 * дійшов до неї першим: «модулі змінюють розмір, грані, колір і
 * блиск — замість того щоб додавати тіла» (ADR-0004). Дерево цього
 * уроку не отримало й далі вирощувало по гілці на кожен рядок порталу.
 */
const YEAR_ATTRACTORS_MIN = 2;
const YEAR_ATTRACTORS_MAX = 9;

/** Наповненість, вище за яку рік читається сильним і гілка виділяється. */
const STRONG_YEAR = 0.62;

/** Що рік мав робити, щоб гілка отримала його характер. */
interface TreeYearFacts {
  /** Наповненість року, 0..1 — спільна модель, та сама, що в кристала. */
  fill: number;
  /** Канал, який того року важив найбільше, або `null` для порожнього. */
  channel: EvolutionChannel | null;
  /** 1 для закритого року, частка — для того, що триває. */
  progress: number;
}

/**
 * Гілка одного року стосунків.
 *
 * ЩО ЗМІНИЛОСЬ І ЧОМУ. Раніше річна гілка була однаковою в кожного
 * року — вага 0.42–0.58 від насіння, один згусток листя, жодного
 * характеру, — а всю історію показували гілки, вирощені ПО ОДНІЙ НА
 * ПОДІЮ. На історії з 120 подій це давало 117 гілок від подій проти
 * трьох річних: дерево коштувало 38 576 трикутників, удвічі більше за
 * риф, і росло без стелі.
 *
 * Це рівно той закон, який ADR-0004 прибрав із кристала. Тепер рік — і
 * тільки рік — дає гілку, а те, чим той рік був прожитий, іде в її
 * товщину, крону й напрям.
 */
function buildAnnualInstruction(
  artifact: ArtifactBlueprint,
  epochIndex: number,
  facts: TreeYearFacts,
): TreeGrowthInstruction {
  const id = `tree:annual:${epochIndex}`;
  const seed = stableSeed(artifact.deterministicSeed, id);
  const fill = clamp01(facts.fill);
  const emphasized = fill >= STRONG_YEAR;

  /*
   * Напрям гілки бере характер року: рік подорожей тягнеться вбік і
   * нижче, рік спогадів — угору. Діапазони ті самі, що були в гілок
   * від подій, тож форма крони не втратила словника — вона просто
   * перестала множити тіла.
   */
  const range = directionRange(facts.channel ?? 'remembrance');
  const preferredElevation = round6(
    range.minElevation + seededUnit(seed, 'elevation') * range.elevationSpan,
  );

  return {
    id,
    sourceEventId: null,
    sourceEpisodeId: null,
    epochIndex,
    sequence: anniversaryEpoch(artifact, epochIndex) * 10,
    channel: facts.channel,
    kind: 'annual-bough',
    tier: emphasized ? 'family' : fill >= 0.4 ? 'companion' : 'support',
    emphasized,
    // Товщина — від наповненості, а не від насіння. Насіння лишає
    // тремтіння, щоб два однакові роки не виходили близнюками.
    weight: round6(clamp01(
      0.3 + 0.55 * fill + (seededUnit(seed, 'weight') - 0.5) * 0.08,
    )),
    // Рік, що триває, ще не дорослий: його гілка коротша й молодша.
    maturity: round6(clamp01(facts.progress)),
    preferredAzimuthRad: round6(
      (epochIndex * GOLDEN_ANGLE + seededUnit(seed, 'azimuth') * 0.38) % (Math.PI * 2),
    ),
    preferredElevation,
    radialBias: round6(
      range.minRadial + seededUnit(seed, 'radial') * range.radialSpan,
    ),
    crownLayer: round6(clamp01((preferredElevation - 0.28) / 0.7)),
    fill: round6(fill),
    /*
     * ОСЬ ДЕ ПОДІЛИСЬ СТО СІМНАДЦЯТЬ ГІЛОК. Замість тіла на подію рік
     * несе стільки листя, скільки його прожили: від двох згустків у
     * порожньому році до дев'яти в повному.
     */
    attractorCount: Math.round(
      YEAR_ATTRACTORS_MIN + (YEAR_ATTRACTORS_MAX - YEAR_ATTRACTORS_MIN) * fill,
    ),
    seed,
  };
}

/**
 * Факти року: чим він був прожитий.
 *
 * Наповненість береться СПІЛЬНОЮ моделлю (`species/shared`), тією
 * самою, що в кристала й рифа. Доти дерево мало третій власний закон
 * року — і саме такі три копії одного правила спільний шар і збирає.
 */
function yearFactsOf(
  artifact: ArtifactBlueprint,
  year: RelationshipYear,
  asOfEpoch: number,
): TreeYearFacts {
  const within = artifact.events.filter((event) => (
    event.occurredAtEpochMs <= asOfEpoch
    && event.occurredAt >= year.startsAt
    && event.occurredAt < year.endsAt
  ));

  const modules = new Set<string>();
  const channelTotals = new Map<EvolutionChannel, number>();
  for (const event of within) {
    const module = portalModuleOf(event.source);
    if (module !== null) modules.add(module);
    for (const channel of EVOLUTION_CHANNELS) {
      const value = event.channels[channel];
      if (value > 0) channelTotals.set(channel, (channelTotals.get(channel) ?? 0) + value);
    }
  }

  let channel: EvolutionChannel | null = null;
  let best = 0;
  // Порядок сталий: `EVOLUTION_CHANNELS`, а не порядок мапи — інакше
  // рівні канали давали б різний результат між запусками.
  for (const candidate of EVOLUTION_CHANNELS) {
    const total = channelTotals.get(candidate) ?? 0;
    if (total > best) { best = total; channel = candidate; }
  }

  const progress = year.complete ? 1 : yearProgress(year, asOfEpoch);
  return {
    fill: yearFill(progress, yearActivity(modules.size, within.length)),
    channel,
    progress,
  };
}

/** Скільки року минуло, коли він ще триває. */
function yearProgress(year: RelationshipYear, asOfEpoch: number): number {
  const opened = Date.parse(`${year.startsAt}T00:00:00.000Z`);
  const closes = Date.parse(`${year.endsAt}T00:00:00.000Z`);
  if (!Number.isFinite(opened) || !Number.isFinite(closes) || closes <= opened) return 0;
  return clamp01((asOfEpoch - opened) / (closes - opened));
}

/**
 * Гілки дерева: по одній на кожен рік стосунків, і жодної на подію.
 *
 * ЩО ЦЕ ЗАМІЩУЄ. Раніше кожна подія порталу давала власну гілку. На
 * історії зі 120 подій виходило 117 гілок від подій проти трьох
 * річних — закон «один рядок = одне тіло», який ADR-0004 прибрав із
 * кристала ще тоді, коли справжня пара дійшла до 104 подій. Дерево
 * лишалось останнім видом, який ним ріс, і платило за це подвійним
 * бюджетом трикутників.
 *
 * Події нікуди не поділись: вони тепер вирішують, ЯКОЮ буде гілка свого
 * року — товщиною, кроною, напрямом, — а не скільки гілок буде.
 */
export function buildTreeGrowthInstructions(
  artifact: ArtifactBlueprint,
  asOf: string,
  leapDayPolicy: LeapDayPolicy,
): { growth: TreeGrowthInstruction[]; diagnostics: TreeSpeciesDiagnostics } {
  const asOfEpoch = Date.parse(asOf);
  if (!Number.isFinite(asOfEpoch)) throw new Error(`Invalid Tree Species asOf: "${asOf}".`);

  const asOfDay = asOf.slice(0, 10);
  const years = relationshipYears(artifact.relationshipStartedAt, asOfDay, leapDayPolicy);

  const futureEventIds: string[] = [];
  const zeroPressureEventIds: string[] = [];
  for (const event of artifact.events) {
    if (event.occurredAtEpochMs > asOfEpoch) futureEventIds.push(event.id);
    else if (eventDominantChannel(event.channels) === null) zeroPressureEventIds.push(event.id);
  }

  const growth = years.map((year) => buildAnnualInstruction(
    artifact,
    year.index + 1,
    yearFactsOf(artifact, year, asOfEpoch),
  )).sort((left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id));

  return {
    growth,
    diagnostics: {
      emptyHistory: artifact.events.length === 0,
      zeroPressureEventIds: zeroPressureEventIds.sort(),
      futureEventIds: futureEventIds.sort(),
      annualInstructionCount: growth.length,
      /*
       * Подій, які того дійшли до дерева. Не «скільки з них стали
       * гілками» — гілками вони більше не стають, і лишити стару назву
       * зі старим змістом означало б брехати діагностикою.
       */
      eventInstructionCount: 0,
    },
  };
}
