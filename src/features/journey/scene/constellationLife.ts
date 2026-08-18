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

/** Скільки секунд світиться кожна наступна зірка під час появи. */
const BIRTH_STEP = 0.24;
/** Скільки триває поява однієї зірки. */
const BIRTH_RISE = 0.55;

/** Наскільки зірка вже народилась, 0…1. */
export function birthProgress(order: number, clock: number): number {
  const start = order * BIRTH_STEP;
  if (clock <= start) return 0;
  return Math.min(1, (clock - start) / BIRTH_RISE);
}

/** Скільки секунд триває поява всього сузір'я. */
export function birthDuration(count: number): number {
  return count === 0 ? 0 : (count - 1) * BIRTH_STEP + BIRTH_RISE;
}

/**
 * Скільки шляху вже прокладено, 0…1 уздовж кривої.
 *
 * Крива йде контрольними точками ланцюга за датою, і `TubeGeometry` розкладає
 * `uv.x` рівномірно за ПАРАМЕТРОМ, а не за довжиною. Отже точка з номером `i`
 * лежить рівно на `i / (n − 1)` — і частку легко порахувати без самої кривої.
 *
 * Промінь тягнеться до зірки рівно так само, як вона народжується: інакше він
 * на мить висів би в порожнечі попереду неї.
 */
export function pathReveal(orders: readonly number[], clock: number): number {
  const count = orders.length;
  if (count < 2) return 0;
  let reveal = 0;
  for (let index = 1; index < count; index += 1) {
    const grown = birthProgress(orders[index]!, clock);
    if (grown <= 0) break;
    reveal = (index - 1 + grown) / (count - 1);
  }
  return Math.min(1, reveal);
}

/** Скільки відрізків труби на один проліт між подіями. */
const SEGMENTS_PER_LEG = 14;
/**
 * Стеля відрізків шляху.
 *
 * Бюджет, а не смак. Кількість подій у пари росте роками й нічим не обмежена;
 * без стелі сорок подій дали б 546 відрізків, сто — 1386, і геометрія шляху
 * почала б коштувати більше за все інше в сцені разом. 420 відрізків — це
 * приблизно 4200 трикутників при п'яти гранях, тобто трохи більше за все, що
 * сцена малює зараз, і на цьому число зупиняється назавжди.
 */
const MAX_PATH_SEGMENTS = 420;

/** Скільки відрізків труби будувати на ланцюг із `count` подій. */
export function pathSegments(count: number): number {
  if (count < 2) return 0;
  return Math.min(MAX_PATH_SEGMENTS, (count - 1) * SEGMENTS_PER_LEG);
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
