import { stableHash32 } from '@/engine/evolution/seed';
import type { ConstellationLevel } from '../constellationRules';

// ============================================================
// Як сузір'я живе.
// ------------------------------------------------------------
// Народження, дихання, сяйво й поява шляху — усе, що змінюється з часом, але
// НЕ залежить від three, React і форми екрана. Лежить окремим чистим модулем
// рівно тому, чому свого часу виїхали `starTints` і `journeyFraming`: у vitest
// сцена не рендериться взагалі, тож помилка, яка живе всередині `useFrame`,
// ловилась би тільки знімком. Обидві попередні вади саме так і жили.
//
// **Ієрархія тут не лише в кольорі.** Власник назвав це прямо: рівень події
// має читатись, навіть якщо колір обрала сама пара. Тому рівень задає чотири
// різні речі — розмір зірки (у `constellation3d`), розмір ореолу, силу сяйва
// й характер дихання. Ключова подія дихає повільніше й глибше за звичайну:
// велике тіло не може мерехтіти, як іскра, і саме це читається як вага.
// ============================================================

/*
 * ПОЯВА СУЗІР'Я — ХРОНОЛОГІЧНО Й ПОВІЛЬНО (ADR-0214).
 *
 * Власник: «при відкритті цього модуля спочатку загораються зірки
 * хронологічно від першої до останньої, повільно з'єднуючись між собою у
 * сузір'я».
 *
 * Було 0.24 с на зірку, і лінія росла одночасно з зіркою — десять подій
 * проскакували за дві секунди, до того ж здебільшого поки фон ще
 * вантажився. Тепер черга така: зірка загоряється → від неї тягнеться
 * лінія до наступної → наступна спалахує рівно тоді, коли лінія до неї
 * дійшла. Тобто шлях ПРОКЛАДАЄТЬСЯ від першої події до останньої.
 *
 * Крок — не стала, а частка загального часу: десять подій ідуть по 1.1 с,
 * сто — по 0.35, і пара не чекає хвилину, поки проявиться довга історія.
 */

/** До скількох секунд розтягується поява всього сузір'я. */
const REVEAL_TOTAL = 10;
/** Найповільніший крок між зірками — щоб дві-три події не тягнулись вічність. */
const MAX_STEP = 1.3;
/** Найшвидший — щоб довга історія все ще читалась зіркою за зіркою. */
const MIN_STEP = 0.35;
/** За скільки секунд зірка розгоряється. */
const MAX_RISE = 0.9;
/** Яку частку розгоряння лінія чекає, перш ніж рушити до наступної зірки. */
const LINE_WAITS = 0.55;

/** Секунди між спалахами сусідніх зірок для сузір'я з `count` зірок. */
export function revealStep(count: number): number {
  if (count < 2) return MAX_STEP;
  return Math.min(MAX_STEP, Math.max(MIN_STEP, REVEAL_TOTAL / (count - 1)));
}

function riseTime(count: number): number {
  return Math.min(MAX_RISE, revealStep(count) * 0.9);
}

function smooth(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

/** Наскільки зірка вже народилась, 0…1. `count` — скільки зірок у сузір'ї. */
export function birthProgress(order: number, clock: number, count: number): number {
  const start = order * revealStep(count);
  if (clock <= start) return 0;
  return Math.min(1, (clock - start) / riseTime(count));
}

/** Скільки секунд триває поява всього сузір'я. */
export function birthDuration(count: number): number {
  return count === 0 ? 0 : (count - 1) * revealStep(count) + riseTime(count);
}

/**
 * Скільки прокладено лінії від зірки `leg` до зірки `leg + 1`, 0…1.
 *
 * Лінія рушає, коли її зірка вже наполовину розгорілась, і приходить рівно
 * в мить, коли наступна починає спалахувати. Хід — м'який (smoothstep):
 * лінія рушає й під'їжджає повільно, а не б'ється в зірку.
 */
export function legProgress(leg: number, clock: number, count: number): number {
  const step = revealStep(count);
  const from = leg * step + riseTime(count) * LINE_WAITS;
  const to = (leg + 1) * step;
  if (to <= from) return clock >= to ? 1 : 0;
  return smooth((clock - from) / (to - from));
}

/**
 * Скільки шляху вже прокладено, 0…1 уздовж `uv.x`.
 *
 * Зірка `i` лежить на `i / (n − 1)` (`buildConstellationLines`), тож частка —
 * номер останнього прольоту в дорозі плюс його власний хід.
 */
export function pathReveal(orders: readonly number[], clock: number): number {
  const count = orders.length;
  if (count < 2) return 0;
  let reveal = 0;
  for (let leg = 0; leg < count - 1; leg += 1) {
    const grown = legProgress(leg, clock, count);
    if (grown <= 0) break;
    reveal = (leg + grown) / (count - 1);
    if (grown < 1) break;
  }
  return Math.min(1, reveal);
}

/**
 * Скільки секунд між імпульсами світла вздовж шляху.
 *
 * Рідко навмисно. Імпульс — це нагадування, що шлях має напрямок, а не
 * прикраса; смуга, яка бігає без упину, за півхвилини стає шумом і в пари
 * лишається відчуття завантаження, а не спогаду.
 */
const PULSE_PERIOD = 13;
/** Скільки секунд смуга йде від найдавнішої події до найновішої. */
const PULSE_TRAVEL = 4.2;

/**
 * Де зараз світла смуга на шляху, 0…1. Від'ємне — смуги немає.
 *
 * Від'ємне, а не нуль: нуль — це початок шляху, тобто цілком законне місце, і
 * смуга завмирала б там на дев'ять секунд із тринадцяти.
 */
export function pulsePosition(clock: number, reveal: number): number {
  if (reveal <= 0) return -1;
  const phase = (clock % PULSE_PERIOD) / PULSE_TRAVEL;
  return phase > 1 ? -1 : phase * reveal;
}

export interface StarAura {
  /** Розмір ореолу в одиницях сцени. */
  halo: number;
  /** Сила сяйва: множник прозорості ореолу. */
  glow: number;
  /** Амплітуда дихання — частка власного розміру зірки. */
  breath: number;
  /** Скільки радіан фази дихання за секунду. */
  rate: number;
  /** Зсув фази, радіани. Щоб сузір'я не дихало в такт. */
  phase: number;
}

/**
 * Ореол: стала частина плюс частка від зірки, і обидві залежать від рівня.
 *
 * Чиста пропорція не годиться, і це виміряно. Ядро втричі більше за звичайну
 * зірку, тож при самому множнику ореол ядра виходив утричі більшим — і лише
 * він показував колір, а звичайна зірка глухла в туманності. Стала частина дає
 * найдрібнішій зірці сяйво, яке ще видно.
 */
const HALO_BASE = 2.4;

const LEVEL: Record<ConstellationLevel, { halo: number; glow: number; breath: number; rate: number }> = {
  // Звичайна подія — іскра: дрібне сяйво, швидке й мілке дихання.
  regular: { halo: 3.1, glow: 0.74, breath: 0.032, rate: 1.05 },
  important: { halo: 3.5, glow: 0.92, breath: 0.046, rate: 0.78 },
  // Ключова — світило: широкий ореол і повільне глибоке дихання.
  key: { halo: 3.9, glow: 1.1, breath: 0.062, rate: 0.54 },
};

/** Ядро світить сильніше за будь-яку ключову подію — воно тримає сузір'я. */
const CORE_GLOW = 1.28;
const CORE_RATE = 0.42;

export interface AuraSource {
  id: number;
  level: ConstellationLevel;
  core: boolean;
  radius: number;
}

export function starAura(star: AuraSource): StarAura {
  const level = LEVEL[star.level];
  return {
    halo: HALO_BASE + star.radius * level.halo,
    glow: star.core ? CORE_GLOW : level.glow,
    breath: level.breath,
    rate: star.core ? CORE_RATE : level.rate,
    // Фаза з `id`, а не з індексу: подія, додана заднім числом, не мусить
    // збивати дихання всім іншим.
    phase: (stableHash32(`breath:${star.id}`) / 4294967296) * Math.PI * 2,
  };
}

/** Множник розміру зірки на цю мить, ≈1. */
export function starBreath(aura: StarAura, clock: number): number {
  return 1 + aura.breath * Math.sin(clock * aura.rate + aura.phase);
}

/**
 * Сила сяйва кожної зірки як плаский масив для інстансованого атрибута.
 *
 * Живе тут, поруч із таблицею рівнів, з тієї ж причини, що й `starTints`: щоб
 * ієрархія перевірялась тестом, а не лише оком на знімку.
 */
export function auraGlows(stars: readonly AuraSource[]): Float32Array {
  const array = new Float32Array(stars.length);
  stars.forEach((star, index) => {
    array[index] = starAura(star).glow;
  });
  return array;
}
