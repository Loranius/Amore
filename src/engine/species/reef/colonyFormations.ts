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
 * Густина року, з якої все починається: порожній рік — не порожнеча.
 *
 * Експортується, бо розкладка тіл усередині колонії мусить знати, де в
 * неї нуль. Інакше 0.35 довелось би написати вдруге в іншому файлі —
 * рівно той спосіб, яким «наповненість року» вже одного разу
 * розійшлася сама з собою.
 */
export const ANNUAL_DENSITY_FLOOR = 0.35;

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
  headScaleAtYearEnd: number,
  fill: number,
  seed: number,
): ReefAnnualColonySize {
  const head = Number.isFinite(headScaleAtYearEnd) ? Math.max(0, headScaleAtYearEnd) : 0;
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
    density: round6(ANNUAL_DENSITY_FLOOR + (1 - ANNUAL_DENSITY_FLOOR) * full),
  };
}

/**
 * Наповненість року — та сама функція, що в кристала.
 *
 * Реекспорт, а не власна копія: `shared/relationshipYear.ts` існує саме
 * тому, що копія тут уже була й одного разу вже розійшлась із оригіналом.
 */
export { yearFill };

// ── Розкладка річних колоній на голові ──────────────────────
//
// НАЙВАЖЛИВІШЕ ТУТ — не форма, а СТАЛІСТЬ. Місце колонії має залежати
// лише від номера свого року й ні від чого більше. Наївне «розставити N
// колоній рівно по колу» виглядає природним і руйнує заморозку: щойно
// з'являється наступний рік, кожен попередній зсувається, тобто минуле
// переписується на кожну річницю.
//
// На кристалі ця сама вада вже була, і впіймали її не тести форми, а
// окремий файл про правила власника. Тому розкладка тут будується на
// послідовностях, які залежать ВИКЛЮЧНО від індексу: золотий кут по
// азимуту й радикальна інверсія за основою 2 по висоті. Обидві дають
// добре розсіяний набір при будь-якій кількості, і жоден член не
// рухається, коли додається наступний.

/** Золотий кут: найрівномірніше розсіювання, яке не залежить від кількості. */
const GOLDEN_ANGLE_RAD = Math.PI * (3 - Math.sqrt(5));

/**
 * Смуга на куполі, у якій сидять колонії, у частках дуги від низу до маківки.
 *
 * Ні найнижчий край, ні сама маківка не годяться. Унизу колонія
 * потонула б у камені, на маківці всі роки збились би в одну точку —
 * купол там вироджується, і будь-який азимут дає те саме місце.
 */
const COLONY_BAND_LOW = 0.18;
const COLONY_BAND_HIGH = 0.86;

export interface ReefColonyAnchor {
  /** Точка на поверхні голови. */
  point: { x: number; y: number; z: number };
  /** Зовнішня нормаль купола в цій точці — куди колонія росте. */
  normal: { x: number; y: number; z: number };
  azimuthRad: number;
  /** 0 біля основи, 1 біля маківки. */
  band: number;
}

/**
 * Радикальна інверсія за основою 2 (послідовність ван дер Корпута).
 *
 * Дає числа, які лягають у проміжок дедалі щільніше й РІВНОМІРНО на
 * будь-якому префіксі: 1/2, 1/4, 3/4, 1/8… Саме та властивість, що
 * потрібна: перші три роки розкладені так само добре, як перші
 * двадцять, і додавання двадцять першого не рухає жодного.
 */
function radicalInverse2(index: number): number {
  let bits = Math.max(0, Math.floor(index)) + 1;
  let result = 0;
  let denominator = 0.5;
  while (bits > 0) {
    result += (bits % 2) * denominator;
    bits = Math.floor(bits / 2);
    denominator *= 0.5;
  }
  return result;
}

/** Азимут року — лише від його номера. */
export function reefColonyAzimuthRad(yearIndex: number): number {
  const index = Number.isFinite(yearIndex) ? Math.max(0, Math.floor(yearIndex)) : 0;
  const raw = index * GOLDEN_ANGLE_RAD;
  return round6(raw - Math.PI * 2 * Math.floor(raw / (Math.PI * 2)));
}

/** Висота року на куполі — теж лише від його номера. */
export function reefColonyBand(yearIndex: number): number {
  const index = Number.isFinite(yearIndex) ? Math.max(0, Math.floor(yearIndex)) : 0;
  return round6(COLONY_BAND_LOW + (COLONY_BAND_HIGH - COLONY_BAND_LOW) * radicalInverse2(index));
}

/**
 * Де саме на голові сидить колонія цього року.
 *
 * Купол —півеліпсоїд із радіусом `head.radius` і підйомом `head.rise`,
 * тож нормаль береться з градієнта його рівняння, а не з припущення,
 * що це сфера: на приплюснутому куполі різниця між ними та сама, що
 * між «росте вгору» і «росте вбік».
 */
export function reefColonyAnchor(head: ReefHeadSize, yearIndex: number): ReefColonyAnchor {
  const azimuth = reefColonyAzimuthRad(yearIndex);
  const band = reefColonyBand(yearIndex);
  const phi = band * (Math.PI / 2);
  const ring = Math.cos(phi);
  const radius = Math.max(1e-6, head.radius);
  const rise = Math.max(1e-6, head.rise);

  const x = radius * ring * Math.sin(azimuth);
  const z = radius * ring * Math.cos(azimuth);
  const y = rise * Math.sin(phi);

  // Градієнт (x²+z²)/R² + y²/H² = 1.
  const nx = x / (radius * radius);
  const ny = y / (rise * rise);
  const nz = z / (radius * radius);
  const length = Math.max(1e-9, Math.hypot(nx, ny, nz));

  return {
    point: { x: round6(x), y: round6(y), z: round6(z) },
    normal: { x: round6(nx / length), y: round6(ny / length), z: round6(nz / length) },
    azimuthRad: azimuth,
    band,
  };
}

/**
 * Розкладка ВСІХ річних колоній — те, що кличе сцена.
 *
 * Існує окремо від `reefColonyAnchor` не для зручності, а тому що
 * тестувати треба саме цей виклик. Перша редакція перевіряла стійкість
 * місця, кличучи прив'язку з тим самим індексом двічі, — і була сліпа
 * до єдиної вади, яку мала ловити: мутація, що почала рахувати азимут
 * від КІЛЬКОСТІ років, пройшла всі двадцять один тест. Бо тест не
 * передавав кількості, а справжній споживач передав би.
 *
 * Тепер властивість формулюється так, як її бачить пара: розкладка на
 * чотири роки — це початок розкладки на двадцять.
 */
export function reefColonyLayout(
  head: ReefHeadSize,
  yearCount: number,
): ReefColonyAnchor[] {
  const count = Number.isFinite(yearCount) ? Math.max(0, Math.floor(yearCount)) : 0;
  return Array.from({ length: count }, (_, index) => reefColonyAnchor(head, index));
}
