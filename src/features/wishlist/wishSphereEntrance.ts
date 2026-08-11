// ============================================================
// Бажання випливають у кадр — крива входу.
// ------------------------------------------------------------
// Власник подивився макет переходу «Головна → Вішліст» і прийняв його: поки
// камера йде на чверть оберту навколо кристала, з правого краю дугою
// випливають бажання й розходяться по місцях.
//
// **Чому окремий чистий модуль, а не CSS-анімація.** Положення сфери щокадру
// пише фізика одним рядком `transform`; друга анімація того ж стилю затирала б
// її. Тому вхід — це зсув, який складається з фізикою в тому самому рядку, а
// не окреме життя елемента.
//
// **Чому не в компоненті.** Крива — арифметика: коли рушає третя куля, де вона
// на середині шляху, чи відстань до місця лише зменшується. Знімком це не
// перевіриш, а тестом — до числа.
// ============================================================

/** Коли після відкриття вішліста рушає перша куля, мілісекунди. */
export const ENTRANCE_DELAY = 360;

/**
 * Проміжок між сусідніми кулями, мілісекунди.
 *
 * Перекриття тут головне. Якби кожна чекала попередню, це була б черга; якби
 * всі рушали разом — стрибок. Сто двадцять мілісекунд на політ у півтори
 * секунди означає, що в повітрі одночасно більшість сузір'я.
 */
export const ENTRANCE_STAGGER = 120;

/** Скільки летить одна куля, мілісекунди. */
export const ENTRANCE_RUN = 1500;

/** Наскільки куля піднімається над прямою до свого місця, пікселів. */
const ARC = 34;

/** Наскільки нижче свого місця вона входить у кадр, пікселів. */
const DROP = 26;

/** Розмір на старті: куля виростає, наближаючись. */
const START_SCALE = 0.55;

/** За яку частку шляху вона проявляється. */
const FADE = 0.18;

export interface WishSphereEntranceStep {
  /** Зсув від свого місця, пікселів. Нуль — куля вдома. */
  dx: number;
  dy: number;
  scale: number;
  opacity: number;
  /** Чи вхід ще триває: поки так, цикл кадрів не має права спинитись. */
  flying: boolean;
}

const ARRIVED: WishSphereEntranceStep = { dx: 0, dy: 0, scale: 1, opacity: 1, flying: false };

/**
 * Де куля в цю мить свого входу.
 *
 * `travel` — скільки пікселів праворуч від свого місця вона починає; рахує
 * викликач, бо тільки він знає ширину поля й радіус кулі.
 */
export function wishSphereEntrance({
  elapsed,
  beat,
  travel,
}: {
  elapsed: number;
  beat: number;
  travel: number;
}): WishSphereEntranceStep {
  const span = finite(travel, 0);
  const t = (finite(elapsed, 0) - ENTRANCE_DELAY - Math.max(0, beat) * ENTRANCE_STAGGER)
    / ENTRANCE_RUN;
  if (!Number.isFinite(t)) return ARRIVED;
  // Черга ще не дійшла: куля чекає за краєм кадру, а не блимає на місці.
  if (t <= 0) return { dx: span, dy: DROP, scale: START_SCALE, opacity: 0, flying: true };
  if (t >= 1) return ARRIVED;

  // Плавне гальмування: швидкий виліт із-за краю, довгий м'який під'їзд до
  // місця. Прольоту немає — відстань лише зменшується.
  const eased = 1 - Math.pow(1 - t, 3);
  return {
    dx: span * (1 - eased),
    // Дуга: куля заходить знизу, підіймається над прямою і опускається на
    // місце. По лінійці це виглядало б як стрічка, що їде, а не як щось, що
    // припливло.
    dy: DROP * (1 - eased) - ARC * Math.sin(Math.PI * eased),
    scale: START_SCALE + (1 - START_SCALE) * eased,
    opacity: Math.min(1, t / FADE),
    flying: true,
  };
}

/** Скільки триває весь вхід для стількох куль, мілісекунди. */
export function wishSphereEntranceSpan(count: number): number {
  if (!Number.isFinite(count) || count <= 0) return 0;
  return ENTRANCE_DELAY + (Math.ceil(count) - 1) * ENTRANCE_STAGGER + ENTRANCE_RUN;
}

/**
 * Порядок появи — не порядок списку.
 *
 * Зверху вниз читалось би як список, що заповнюється; тут потрібне сузір'я, що
 * збирається. Порядок виводиться з id, тобто той самий для того самого набору:
 * вхід не має бути ще одним джерелом випадковості на кожен рендер.
 */
export function wishSphereEntranceOrder(ids: readonly number[]): Map<number, number> {
  const ranked = ids
    .map((id, index) => ({
      id,
      // Множення на просте число з розкидом бітів: сусідні id отримують
      // геть різні ключі, тож сузір'я не збирається рядами.
      key: Math.imul(Math.floor(finite(id, index)) >>> 0, 2654435761) >>> 0,
      index,
    }))
    .sort((a, b) => (a.key - b.key) || (a.index - b.index));
  return new Map(ranked.map((item, beat) => [item.id, beat]));
}

function finite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}
