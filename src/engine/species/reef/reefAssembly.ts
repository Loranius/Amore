// ============================================================
// Складання рифа: історія пари → голова, палітра й річні колонії.
// ------------------------------------------------------------
// Це ЄДИНЕ місце, де закон росту зустрічається з даними. Усе нижче за
// нього — чиста арифметика (`colonyFormations`, `colonyBodies`), усе
// вище — сцена, яка вже нічого не вирішує, а лише малює віддане.
//
// ДЗЕРКАЛО КРИСТАЛА, І НАВМИСНО. `crystal/formations.ts` робить те саме
// в тому самому порядку: роки стосунків → наповненість кожного →
// заморожений розмір на кінець свого року. Власник назвав ті правила
// необговорюваними для кристала й попросив рифу ту саму логіку росту,
// тож розходитись їм нема з чого.
//
// ЩО ЗНАЧИТЬ «ЗАМОРОЖЕНИЙ» ТУТ. Колонія завершеного року міряється
// головою, ЯКОЮ ТА БУЛА НА КІНЕЦЬ ТОГО РОКУ, а не сьогоднішньою. З
// цього виходить правило 3 — річна колонія ніколи не наздоганяє голову
// — ЗА ПОБУДОВОЮ: голова відтоді лише росла, а колонія стоїть на частці
// минулого значення.
//
// Названа межа, та сама, що в кристала: «заморожений» стосується ЧАСУ, а
// не вмісту. Пара, яка прийшла на портал на третій рік, мусить мати
// змогу заповнити перші два, і спогад, датований усередині старого
// року, належить тому рокові, коли б його не додали. Чого закритий рік
// більше не робить — це не росте від самого лише плину днів.
// ============================================================
import type { LeapDayPolicy } from '../../evolution/types';
import {
  PORTAL_MODULES,
  relationshipYears,
  yearActivity,
  yearFill,
  yearTogetherness,
  type PortalModule,
  type RelationshipYear,
} from '../shared/relationshipYear';
import { daysBetweenExplicit, stableSeed } from './math';
import {
  reefAnnualColonySize,
  reefColonyAnchor,
  reefHeadScale,
  reefHeadSize,
  type ReefAnnualColonySize,
  type ReefColonyAnchor,
  type ReefHeadSize,
} from './colonyFormations';
import { reefColonyBodies, type ReefCoralBody } from './colonyBodies';
import { reefCoupleTint, type ReefTheme, type ReefTint } from './coralPalette';

/** Подія порталу, зведена до того мінімуму, який вирішує ріст. */
export interface ReefHistoryEvent {
  /** Коли сталось: `YYYY-MM-DD` або повна мітка часу. */
  occurredAt: string;
  /** З якої частини порталу прийшла. */
  module: PortalModule;
}

export interface BuildReefPlanInput {
  relationshipStartedAt: string;
  /** Сьогодні очима пари. */
  asOf: string;
  leapDayPolicy: LeapDayPolicy;
  /** Детермінований посів артефакту. */
  seed: number;
  events: readonly ReefHistoryEvent[];
  /** Дати спільних вихідних, `YYYY-MM-DD`. */
  sharedDaysOff: readonly string[];
  theme: ReefTheme;
}

export interface ReefColonyPlan {
  /** Стійка назва року: `reef:year:1` — перший рік стосунків. */
  id: string;
  yearIndex: number;
  /** Рік закритий — колонія більше не змінюється від плину часу. */
  complete: boolean;
  /** Наповненість свого року, 0..1. */
  fill: number;
  seed: number;
  size: ReefAnnualColonySize;
  anchor: ReefColonyAnchor;
  bodies: ReefCoralBody[];
}

export interface ReefPlan {
  head: ReefHeadSize;
  headSeed: number;
  tint: ReefTint;
  /** По одній на кожен рік стосунків, від першого до поточного. */
  colonies: ReefColonyPlan[];
  /** Скільки різних частин порталу жило за всю історію, 0..PORTAL_MODULES. */
  breadth: number;
  daysTogether: number;
}

/**
 * Дата належить рокові, якщо лежить у [початок, кінець).
 *
 * Порівняння рядкове, і це навмисно: межі року — `YYYY-MM-DD`, а подія
 * може мати повну мітку часу, і в ISO-форматі префікс дати впорядкований
 * так само, як сама дата. Той самий прийом, що в кристала — рушій не
 * заводить власного годинника там, де вистачає порядку рядків.
 */
function withinYear(day: string, year: RelationshipYear): boolean {
  return day >= year.startsAt && day < year.endsAt;
}

/** Скільки року вже минуло: закритий — увесь, поточний — до сьогодні. */
function yearProgress(year: RelationshipYear, asOf: string): number {
  if (year.complete) return 1;
  const whole = daysBetweenExplicit(year.startsAt, year.endsAt);
  const lived = daysBetweenExplicit(year.startsAt, asOf);
  if (whole === null || lived === null || whole <= 0) return 0;
  return Math.min(1, Math.max(0, lived / whole));
}

function breadthOf(modules: Set<PortalModule>): number {
  return PORTAL_MODULES.filter((module) => modules.has(module)).length;
}

/**
 * Повний план рифа на сьогодні.
 *
 * Порядок колоній — від першого року до поточного, і це частина
 * контракту: сцена малює їх у ньому, а тести на сталість розкладки
 * спираються на індекс.
 */
export function buildReefPlan(input: BuildReefPlanInput): ReefPlan {
  const years = relationshipYears(
    input.relationshipStartedAt, input.asOf, input.leapDayPolicy,
  );
  const daysTogether = daysBetweenExplicit(input.relationshipStartedAt, input.asOf) ?? 0;

  const livedModules = new Set<PortalModule>();
  for (const event of input.events) {
    if (event.occurredAt <= input.asOf) livedModules.add(event.module);
  }
  const breadth = breadthOf(livedModules);
  const head = reefHeadSize(daysTogether, breadth);

  const colonies = years.map((year) => {
    const id = `reef:year:${year.index + 1}`;
    const seed = stableSeed(input.seed, id);

    const yearEvents = input.events.filter((event) => withinYear(event.occurredAt, year));
    const modules = new Set(yearEvents.map((event) => event.module));
    const activity = yearActivity(breadthOf(modules), yearEvents.length);
    const togetherness = yearTogetherness(
      input.sharedDaysOff.filter((day) => withinYear(day, year)).length,
    );
    const fill = yearFill(yearProgress(year, input.asOf), activity, togetherness);

    /*
     * Голова НА КІНЕЦЬ СВОГО РОКУ — ось де заморозка й живе. І міряється
     * вона самим лише ЧАСОМ, без широти життя.
     *
     * Перша редакція брала повний розмір голови, з широтою включно, — і
     * власний тест на це впав: спогад, дописаний у 2023-й, змінював
     * колонію 2025-го (радіус 0.118 → 0.162). Причина проста, щойно її
     * побачиш: широта накопичується за всю історію, тож подія, додана в
     * старий рік, розширює голову на КОЖНОМУ наступному рубежі. Виходило,
     * що закритий рік переписується подією, яка до нього не має
     * стосунку, — рівно те, що `PRODUCT.md` забороняє.
     *
     * Кристал цієї вади не має, бо його дитина міряється осьовим
     * масштабом монарха, а той залежить лише від днів. Риф робить так
     * само: розмір-опора = `reefHeadScale(днів)`. Широта далі видно —
     * але на самій голові, як їй і належить.
     */
    const scaleAtYearEnd = reefHeadScale(
      year.complete
        ? daysBetweenExplicit(input.relationshipStartedAt, year.endsAt) ?? 0
        : daysTogether,
    );

    const size = reefAnnualColonySize(scaleAtYearEnd, fill, seed);
    return {
      id,
      yearIndex: year.index,
      complete: year.complete,
      fill,
      seed,
      size,
      /*
       * МІСЦЕ береться з СЬОГОДНІШНЬОЇ голови, і це не суперечить
       * заморозці. Колонія сидить на куполі; купол росте — вона
       * їде разом із ним, інакше стара колонія лишилась би висіти в
       * воді там, де поверхня була три роки тому. Незмінний у неї
       * РОЗМІР, а не координата.
       */
      anchor: reefColonyAnchor(head, year.index),
      bodies: reefColonyBodies(size, seed, year.index),
    };
  });

  return {
    head,
    headSeed: stableSeed(input.seed, 'reef:head'),
    tint: reefCoupleTint(input.relationshipStartedAt, input.theme),
    colonies,
    breadth,
    daysTogether,
  };
}
