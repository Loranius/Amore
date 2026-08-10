import { CRYSTAL_SUBSTRATE_BODY_ID, type CrystalGeometryState } from '@/engine/geometry';
import { mulberry32 } from '../../mulberry32';

// ============================================================
// Бажання як тіла — розкладка кристалів вішліста (бриф §28–§30).
// ------------------------------------------------------------
// **Чому це не рушій.** Evolution Engine моделює те, що *сталося*: адаптер
// вішліста бере рівно виконані бажання (`if (!row.fulfilled) continue`), і
// опублікований стан незмінний. Активне бажання — не подія: воно змінюється
// щодня і завтра може зникнути. Вставити його в конвеєр означало б зробити
// історію пари мінливою.
//
// **Чому дошка, а не орбіта.** Перша редакція розвішувала бажання кільцем
// навколо корони. На головній вони були декорацією, якої ніхто не просив, а на
// вішлісті половина ховалась за монархом. Тепер це дошка, повернута до камери
// маршруту: видно всі, і кожне можна взяти пальцем.
//
// **Що вже є.** Збуте бажання й так змінює артефакт: `wishTint` фарбує всю
// друзу від подарунків, які пара зробила одне одному (ADR-0015). Тобто §31
// брифу — «збуте бажання входить у тіло каменю» — наполовину вже правда, і ці
// тіла домальовують другу половину: те, чого ще прагнуть.
// ============================================================

/** Розміри монарха в одиницях рушія — дошка будується від них. */
export interface WishSatelliteBounds {
  height: number;
  radius: number;
}

/** Те, що дошка знає про бажання. Назва, ціна, статус лишаються переднім UI. */
export interface WishSubject {
  id: number;
  /** Фото бажання; воно ляже всередину кристала. */
  photo: string | null;
  priority: 'high' | 'medium' | 'low' | null;
}

export interface WishCrystal {
  /** null у згорнутого залишку — його не можна відкрити як одне бажання. */
  id: number | null;
  photo: string | null;
  /** Позиція в одиницях рушія, у кадрі `bundle.content`. */
  position: readonly [number, number, number];
  /** Бажана висота тіла в одиницях рушія. */
  size: number;
  /** Стартовий кут навколо власної осі. */
  spin: number;
  /** Фаза левітації, щоб сусіди не гойдались в такт. */
  bob: number;
  /**
   * Скільки бажань стоїть за цим кристалом.
   *
   * §29 прямо забороняє показувати сотні одночасно й просить кластери або
   * пріоритизацію. Останній збирає залишок, тож сума `represents` завжди
   * дорівнює числу активних бажань.
   */
  represents: number;
}

export type WishSatelliteQuality = 'high' | 'balanced' | 'low' | 'fallback';

/**
 * Скільки тіл світ погоджується малювати.
 *
 * Не «скільки влізе»: кожне несе власну текстуру, тобто власний матеріал і
 * власний draw call, а §43 називає постійну WebGL-пам'ять першим ризиком
 * мобільного.
 */
export function wishSatelliteCap(quality: WishSatelliteQuality): number {
  if (quality === 'high') return 12;
  if (quality === 'balanced') return 9;
  if (quality === 'low') return 6;
  return 0;
}

/**
 * Скільки місця дошці дає екран, в одиницях рушія, на її власній глибині.
 *
 * Без цього дошка будувалась у власних розмірах і на телефоні виходила за
 * краї: крайні бажання зрізало, а нижній ряд ховався за доком. Тепер сітка
 * вписується у видиму область, тож усі бажання на одному екрані.
 */
export interface WishBoardViewport {
  halfWidth: number;
  halfHeight: number;
}

export interface WishBoardInput {
  wishes: readonly WishSubject[];
  /** Насіння артефакта — у кожної пари свій розсип, і він незмінний. */
  seed: number;
  bounds: WishSatelliteBounds;
  quality: WishSatelliteQuality;
  /** Азимут камери маршруту: дошка стоїть перпендикулярно до погляду. */
  facing: number;
  viewport: WishBoardViewport;
  /**
   * Центр дошки в кадрі артефакта.
   *
   * Приходить із компонента, бо це точка на **осі погляду** камери, а не на
   * осі артефакта. Виміряно на телефоні: коли дошку центрували на артефакті,
   * праву колонку зрізало краєм екрана — камера дивиться під кутом, і центр
   * кадру не збігається з віссю каменю.
   */
  centre: readonly [number, number, number];
}

/** Скільки бажань у ряд. Більше — і на телефоні вони стають марками. */
const COLUMNS = 3;

/**
 * Яку частку видимої області займає дошка.
 *
 * По ширині майже всю; по висоті — менше, бо знизу плаває док, а згори
 * стоїть заголовок сторінки, і ховати бажання під ними означало б не
 * показати їх узагалі.
 */
const FILL_WIDTH = 0.94;
const FILL_HEIGHT = 0.66;
/** Яку частку своєї клітинки займає тіло — решта є проміжком. */
const CELL_FILL = 0.62;

/**
 * Розмір тіла як частка висоти монарха, за вагою мрії.
 *
 * Власник просив, щоб різниця читалась: жадане — більший кристал, бажане —
 * середній, приємне — менший. Розкид 0.32 / 0.25 / 0.19 — це відношення
 * 1.68 між крайніми, тобто помітно з першого погляду, але найменше бажання
 * ще не стає крихтою.
 */
const SIZE_BY_PRIORITY: Readonly<Record<string, number>> = {
  high: 0.32,
  medium: 0.25,
  low: 0.19,
};
const SIZE_DEFAULT = 0.25;

/**
 * Наскільки дошка стоїть перед артефактом, у радіусах друзи.
 *
 * Зменшено з 1.35: винос — це відстань **до камери**, тож чим він більший, тим
 * більші тіла на екрані. Разом зі збільшеними тілами дошка перестала влазити в
 * кадр — виміряно на живому порталі.
 */
const BOARD_STANDOFF = 1.02;
/** Центр дошки як частка висоти монарха. */
const BOARD_CENTRE_RISE = 0.72;

function finite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

/**
 * Центр дошки в кадрі артефакта.
 *
 * Експортується, бо видиму ширину треба міряти саме на цій глибині: дошка
 * стоїть ближче до камери за вісь артефакта, і різниця між «біля осі» та «біля
 * дошки» — це і є та похибка, через яку крайні бажання зрізало.
 */
export function wishBoardCentre(
  bounds: WishSatelliteBounds,
  facing: number,
  centreRise: number,
): readonly [number, number, number] {
  const radius = Math.max(1e-3, finite(bounds.radius, 1));
  const standoff = radius * BOARD_STANDOFF;
  return [Math.sin(facing) * standoff, centreRise, Math.cos(facing) * standoff];
}

export function buildWishBoard(input: WishBoardInput): readonly WishCrystal[] {
  const cap = wishSatelliteCap(input.quality);
  const active = input.wishes.length;
  const shown = Math.min(active, cap);
  if (shown === 0) return [];

  const height = Math.max(1e-3, finite(input.bounds.height, 1));
  const facing = finite(input.facing, 0);
  const random = mulberry32(Math.floor(finite(input.seed, 0)) >>> 0);

  // Дошка стоїть у площині, перпендикулярній до погляду: «праворуч» — вектор,
  // повернутий на чверть від напрямку камери. Тому бажання не ховаються за
  // монархом, під яким би кутом камера не стояла.
  const rightX = Math.cos(facing);
  const rightZ = -Math.sin(facing);

  const columns = Math.min(COLUMNS, shown);
  const rows = Math.ceil(shown / columns);

  // Клітинка — те, що справді лишає екран, а не те, що хотілося б. Береться
  // менша з двох, інакше сітка вилазить по одній з осей.
  const halfWidth = Math.max(1e-3, finite(input.viewport.halfWidth, height));
  const halfHeight = Math.max(1e-3, finite(input.viewport.halfHeight, height));
  const cell = Math.min(
    (halfWidth * 2 * FILL_WIDTH) / columns,
    (halfHeight * 2 * FILL_HEIGHT) / rows,
  );
  const unit = cell;
  const centreX = finite(input.centre[0], 0);
  const centreY = finite(input.centre[1], height * BOARD_CENTRE_RISE);
  const centreZ = finite(input.centre[2], 0);

  const crystals: WishCrystal[] = [];
  for (let index = 0; index < shown; index += 1) {
    const wish = input.wishes[index]!;
    const column = index % columns;
    const row = Math.floor(index / columns);
    const columnsHere = Math.min(columns, shown - row * columns);

    const last = index === shown - 1;
    const represents = last ? active - shown + 1 : 1;
    const cluster = represents > 1 ? 1 + Math.min(0.4, Math.log2(represents) * 0.12) : 1;
    const jitter = 0.94 + random() * 0.12;
    // Вага мрії лишається розміром, але тепер вона частка клітинки, а не
    // висоти монарха: клітинку задає екран, тож дошка вміщається завжди.
    const weight = (wish.priority ? (SIZE_BY_PRIORITY[wish.priority] ?? SIZE_DEFAULT) : SIZE_DEFAULT)
      / SIZE_DEFAULT;
    const size = cell * CELL_FILL * weight * jitter * cluster;

    // Ряди центруються самі, тож неповний останній ряд не з'їжджає вбік.
    const offset = (column - (columnsHere - 1) / 2) * unit;
    const rise = centreY + ((rows - 1) / 2 - row) * unit;

    crystals.push({
      id: represents > 1 ? null : wish.id,
      photo: wish.photo,
      position: [
        centreX + rightX * offset,
        rise,
        centreZ + rightZ * offset,
      ],
      size,
      spin: random() * Math.PI * 2,
      bob: random() * Math.PI * 2,
      represents,
    });
  }

  return crystals;
}

/**
 * Габарити монарха в одиницях рушія.
 *
 * Береться з опублікованої геометрії, а не з кадру сцени: тіла живуть у тому ж
 * кадрі, що й друза, і перерахунок через підгонку означав би друге джерело
 * правди про те, який артефакт описується.
 */
export function wishSatelliteBounds(geometry: CrystalGeometryState): WishSatelliteBounds {
  let height = 0;
  let radius = 0;
  for (const mesh of geometry.meshes) {
    if (mesh.bodyId === CRYSTAL_SUBSTRATE_BODY_ID) continue;
    const positions = mesh.positions;
    for (let index = 0; index + 2 < positions.length; index += 3) {
      const y = positions[index + 1]!;
      if (y > height) height = y;
      const span = Math.hypot(positions[index]!, positions[index + 2]!);
      if (span > radius) radius = span;
    }
  }
  return { height, radius };
}

/**
 * Найменше справжнє тіло пари — форма, яку позичають бажання.
 *
 * §29 просить, щоб бажання належали тій самій мінеральній сім'ї, що й монарх.
 * Позичити готову доньку — найкоротший спосіб зробити це правдою, а не
 * схожістю: та сама огранка, ті самі атрибути фасетів, той самий матеріал.
 */
export function pickWishDonor(
  geometry: CrystalGeometryState,
): CrystalGeometryState['meshes'][number] | null {
  let donor: CrystalGeometryState['meshes'][number] | null = null;
  let donorSpan = Infinity;
  for (const mesh of geometry.meshes) {
    if (mesh.bodyId === CRYSTAL_SUBSTRATE_BODY_ID) continue;
    if (mesh.positions.length < 9) continue;
    let low = Infinity;
    let high = -Infinity;
    for (let index = 1; index < mesh.positions.length; index += 3) {
      const y = mesh.positions[index]!;
      if (y < low) low = y;
      if (y > high) high = y;
    }
    const span = high - low;
    if (span > 0 && span < donorSpan) {
      donorSpan = span;
      donor = mesh;
    }
  }
  return donor;
}

/**
 * Чого коштує дошка — публікується окремо від артефакта.
 *
 * Той самий прийом, що й для оточення порталу: бюджет артефакта має лишатись
 * про артефакт. Без цього приймальний тест порівнював би намальовані
 * трикутники з топологією друзи й бачив би, що їх стало більше — бо донька,
 * позичена дванадцять разів, порахована в топології один раз.
 */
export function wishCrystalCost(
  geometry: CrystalGeometryState,
  wishes: readonly WishSubject[],
  quality: WishSatelliteQuality,
  facing: number,
): { instances: number; triangles: number } {
  const bounds = wishSatelliteBounds(geometry);
  const crystals = buildWishBoard({
    wishes,
    seed: geometry.artifactSeed,
    bounds,
    quality,
    facing,
    // Ціна не залежить від того, скільки місця на екрані: вона про кількість
    // тіл, а їх задає стеля профілю якості.
    viewport: { halfWidth: bounds.height, halfHeight: bounds.height },
    centre: wishBoardCentre(bounds, facing, bounds.height * BOARD_CENTRE_RISE),
  });
  const donor = pickWishDonor(geometry);
  if (crystals.length === 0 || donor === null) return { instances: 0, triangles: 0 };
  return {
    instances: crystals.length,
    triangles: crystals.length * Math.floor(donor.positions.length / 9),
  };
}
