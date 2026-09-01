// ============================================================
// Роки стосунків із їхньою наповненістю — те, що пара бачить під час
// заповнення історії.
// ------------------------------------------------------------
// НАВІЩО. Пара, яка разом одинадцять років і щойно прийшла на портал,
// отримує одинадцять ОДНАКОВИХ порожніх років: `yearFill` дає рівно
// 0.3 кожному, бо жоден модуль їх не торкнувся. Їхнє справжнє життя
// читається пустішим за один активний місяць на порталі.
//
// Заповнення історії має показувати не «крок 3 з 7», а саме це: скільки
// років порожні й наскільки кожна відповідь їх піднімає. Тому смуга
// років рахується ТИМИ САМИМИ числами, якими росте артефакт, а не
// власним наближенням — інакше екран обіцяв би одне, а дерево виросло б
// інше.
//
// ЧОМУ ЧЕРЕЗ ВИД, А НЕ ЧЕРЕЗ СПІЛЬНИЙ ШАР. `yearFill` і `yearActivity`
// живуть у `species/shared` і від виду не залежать — але ЗБІР фактів
// року (які події потрапили в рік, скількох модулів вони торкнулись)
// лежить у кожного виду свій: `tree/instructions.ts` і
// `reef/reefAssembly.ts` мають по власній копії цього циклу.
//
// Писати тут третю копію означало б повторити рівно ту ваду, проти якої
// заведено `species/shared`. Тому береться готовий блупринт дерева: його
// `growth[].fill` — це і є спільна величина, порахована спільними
// функціями. Дерево тут не вид артефакта, а найкоротший шлях до чесного
// числа.
//
// Правильний кінець цієї історії — винести збір фактів у
// `species/shared` і забрати обидві копії. Це чіпає два опублікованих
// шляхи з детермінізмом і золотими хешами, тож зроблено буде окремо, а
// не заразом із онбордингом.
// ============================================================
import { buildArtifactFromSnapshot } from '@/engine/evolution/adapters';
import { relationshipYears } from '@/engine/species/shared/relationshipYear';
import { buildTreeSpeciesBlueprint } from '@/engine/species/tree';
import { COUPLE_TIME_ZONE, ENGINE_VERSION } from '@/features/world/coupleEngine';
import type { PortalSources } from '@/features/world/portalSources';

/** Скільки наповненості має рік, якого не торкнувся жоден модуль. */
export const EMPTY_YEAR_FILL = 0.3;

export interface RelationshipYearFill {
  /** Номер року стосунків, від 1. */
  index: number;
  /** Календарний рік, у якому цей рік стосунків почався — підпис під смугою. */
  label: number;
  startsAt: string;
  endsAt: string;
  /** Чи рік уже завершився річницею. */
  complete: boolean;
  /** 0..1 — те саме число, яким росте артефакт. */
  fill: number;
}

export interface HistoryFillSummary {
  years: RelationshipYearFill[];
  /** Роки, які не піднялись над порожньою стелею. */
  emptyCount: number;
  /** Середня наповненість — одне число, яким видно рух після відповіді. */
  averageFill: number;
}

const TREE_RULES_VERSION = 'tree-species-onboarding-v1.0.0';

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * Роки пари з їхньою наповненістю.
 *
 * `coupleId` тут потрібен рушію лише як частина насіння; на самі роки він
 * не впливає, і саме тому смуга не змінюється від того, хто дивиться.
 */
export function relationshipYearFills(
  sources: PortalSources,
  asOf: string,
  coupleId: string,
): HistoryFillSummary {
  const startedAt = sources.relationshipStartedAt.trim();
  if (startedAt === '') return { years: [], emptyCount: 0, averageFill: 0 };

  const artifact = buildArtifactFromSnapshot({
    coupleId,
    asOf,
    snapshot: sources.snapshot,
    engineConfig: {
      engineVersion: ENGINE_VERSION,
      relationshipStartedAt: startedAt,
      timeZone: COUPLE_TIME_ZONE,
      leapDayPolicy: 'feb-28',
    },
  }).blueprint;

  const species = buildTreeSpeciesBlueprint({
    artifact,
    config: { asOf, rulesVersion: TREE_RULES_VERSION },
  });
  const fillByIndex = new Map<number, number>();
  for (const instruction of species.growth) {
    fillByIndex.set(instruction.epochIndex, instruction.fill);
  }

  /*
   * `epochIndex` рахується З ОДИНИЦІ — це номер року стосунків, а не
   * позиція в масиві. Перша редакція шукала за позицією й тихо давала
   * перший рік нулем, а решту зсунутими: не помилка рушія, а моя, і
   * видно її було тільки числом.
   */
  const bounds = relationshipYears(startedAt, asOf.slice(0, 10), artifact.leapDayPolicy);
  const years = bounds.map((year, position): RelationshipYearFill => ({
    index: position + 1,
    label: Number(year.startsAt.slice(0, 4)),
    startsAt: year.startsAt,
    endsAt: year.endsAt,
    complete: year.complete,
    fill: round3(fillByIndex.get(position + 1) ?? 0),
  }));

  /*
   * «Порожній» — це не нуль. Рік без жодної події все одно дістає 0.3
   * (`EMPTY_YEAR_FLOOR`), і саме ця стеля робить одинадцять порожніх років
   * однаковими. Тому рахуються ті, що не піднялись НАД нею, а не ті, що
   * дорівнюють нулю: нулю не дорівнює жоден завершений рік.
   */
  const emptyCount = years.filter(
    (year) => year.complete && year.fill <= EMPTY_YEAR_FILL + 1e-6,
  ).length;
  const total = years.reduce((sum, year) => sum + year.fill, 0);

  return {
    years,
    emptyCount,
    averageFill: years.length === 0 ? 0 : round3(total / years.length),
  };
}
