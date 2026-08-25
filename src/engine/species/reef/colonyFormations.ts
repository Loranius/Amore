// ============================================================
// Закон росту рифа: одна голова й по колонії на кожен рік.
// ------------------------------------------------------------
// Власник: «кораловий риф, який росте на основі модулів, логіку росту
// як було в кристалах», і на питання про форму — «одна велика колонія
// голова».
//
// Тому це дзеркало `species/crystal/formations.ts`, а не друга система.
// Чотири правила, які власник назвав необговорюваними для кристала,
// діють тут дослівно:
//
//   1. один рік — одна річна колонія;
//   2. колір індивідуальний для пари, від дати початку;
//   3. річна колонія НІКОЛИ не наздоганяє голову;
//   4. завершений рік застигає й більше не змінюється.
//
// ЩО ПЕРЕНЕСЕНО НЕ ДОСЛІВНО — і чому. Кристал росте у ВИСОТУ: рік
// повніший, тіло вище й товще. Колонія коралів — не одне тіло, і
// висота для неї не головна величина. Наповненість року йде в ОБСЯГ і
// ГУСТИНУ: бідний рік дає рідкий кущик, повний — щільну шапку.
// Переносити «вище» дослівно означало б робити з рифа кристал.
// ============================================================
import {
  PORTAL_MODULE_COUNT,
  yearFill,
} from '../shared/relationshipYear';
import { clamp01, round6, seededUnit } from './math';

/** Скільки років голова росте, доки не насититься. */
const HEAD_FULL_TERM_YEARS = 25;

/** Частка розміру голови, якої річна колонія не переступає ніколи. */
export const ANNUAL_HEAD_SHARE = 0.4;

/** Найменша частка — рік, у якому не було нічого, все одно читається колонією. */
const ANNUAL_MIN_SHARE = 0.16;

/** Найбільша й найменша кількість коралових тіл в одній річній колонії. */
export const ANNUAL_BODIES_MIN = 3;
export const ANNUAL_BODIES_MAX = 18;

/**
 * Наскільки широта життя розширює голову.
 *
 * Те саме, що в кристала: рахуються РІЗНІ модулі, які жили того року, а
 * не обсяг. Сто покупок не мають переважити рік, у якому були й спогади,
 * і плани, і подорож.
 */
const HEAD_BREADTH_GAIN = 0.55;

export interface ReefHeadSize {
  /** Радіус голови в одиницях виду. */
  radius: number;
  /** Висота купола над основою. */
  rise: number;
}

export interface ReefAnnualColonySize {
  /** Радіус шапки річної колонії. */
  radius: number;
  /** Скільки окремих коралових тіл у ній. */
  bodies: number;
  /** Наскільки щільно вони стоять, 0..1. */
  density: number;
}

/**
 * Розмір голови від прожитого часу.
 *
 * Насичується, як монарх кристала: пара на двадцятому році не має бути
 * вдвічі більшою за пару на десятому, інакше екран не витримає жодного
 * кадрування.
 */
export function reefHeadScale(daysTogether: number): number {
  const days = Number.isFinite(daysTogether) ? Math.max(0, daysTogether) : 0;
  const years = days / 365.2425;
  const progress = clamp01(years / HEAD_FULL_TERM_YEARS);
  // Квадратний корінь: ріст швидкий на початку й повільний потім — саме
  // так пара його й переживає.
  return round6(0.25 + 0.75 * Math.sqrt(progress));
}

/**
 * Голова: розмір від часу, ширина ще й від широти життя.
 *
 * @param breadth скільки різних модулів жило за всю історію, 0..PORTAL_MODULE_COUNT
 */
export function reefHeadSize(daysTogether: number, breadth: number): ReefHeadSize {
  const scale = reefHeadScale(daysTogether);
  const wide = clamp01(
    (Number.isFinite(breadth) ? Math.max(0, breadth) : 0) / PORTAL_MODULE_COUNT,
  );
  return {
    radius: round6(scale * (1 + HEAD_BREADTH_GAIN * wide)),
    rise: round6(scale * 0.62),
  };
}

/**
 * Річна колонія: обсяг і густина від наповненості СВОГО року.
 *
 * `headScaleAtYearEnd` — розмір голови на кінець того року, а не
 * сьогоднішній. Це і є правило 4: інакше кожен прожитий день тихо
 * збільшував би всі минулі роки, тобто минуле переписувалось би на
 * кожному відкритті головної.
 *
 * Правило 3 виконується ЗА ПОБУДОВОЮ: стеля — частка голови на кінець
 * того року, а голова відтоді лише росла. Але «за побудовою» — це
 * твердження про сьогоднішній код, тож воно ще й перевіряється числом.
 */
export function reefAnnualColonySize(
  headRadiusAtYearEnd: number,
  fill: number,
  seed: number,
): ReefAnnualColonySize {
  const head = Number.isFinite(headRadiusAtYearEnd) ? Math.max(0, headRadiusAtYearEnd) : 0;
  const full = clamp01(fill);
  const share = ANNUAL_MIN_SHARE + (ANNUAL_HEAD_SHARE - ANNUAL_MIN_SHARE) * full;

  /*
   * Густина веде кількість тіл, а насіння лишає лише тремтіння.
   *
   * Той самий висновок, що й у товщині річного кристала: якщо кількість
   * брати навмання, бідний рік може вийти густішим за багатий, і кільце
   * років почне брехати. Тремтіння тут — рівно одне тіло, щоб два роки
   * з однаковою наповненістю не виходили близнюками.
   */
  const jitter = seededUnit(seed, 'reef:annual:bodies') < 0.5 ? 0 : 1;
  const bodies = Math.min(
    ANNUAL_BODIES_MAX,
    ANNUAL_BODIES_MIN + Math.round((ANNUAL_BODIES_MAX - ANNUAL_BODIES_MIN - 1) * full) + jitter,
  );

  return {
    radius: round6(head * share),
    bodies,
    density: round6(0.35 + 0.65 * full),
  };
}

/**
 * Наповненість року — та сама функція, що в кристала.
 *
 * Реекспорт, а не власна копія: `shared/relationshipYear.ts` існує саме
 * тому, що копія тут уже була й одного разу вже розійшлась із оригіналом.
 */
export { yearFill };
