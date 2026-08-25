// ============================================================
// Зграя рифа: скільки риб, якого кольору й по яких колах.
// ------------------------------------------------------------
// Власник: «риби не прибирай, можемо просто замінити модельки, зробити
// їх простішими. Менше полігонів, просто різнокольорові рибки. Замість
// ока в них просто чорна точка».
//
// Тобто риба тут — НЕ показник. Вона не міряє модулів, не росте з подій
// і нічого не означає: вона робить риф живим. Єдине, чим вона пов'язана
// з парою, — скільки її: на порожньому рифі зграї нема чого їсти.
//
// ЧОМУ КОЛІР РИБ НЕ ВІД ПАРИ. Колір пари — на коралі, і саме там він
// має значення. Якби риби були того самого відтінку, зграя злилась би з
// колонією і зникла з кадру; а якби вони були «індивідуальні» по-своєму,
// у сцені стало б два незалежні кольорові закони. Тому палітра риб
// стала — шість тонів, які читаються на будь-якому коралі.
//
// РУХ ТУТ ТІЛЬКИ ОПИСАНИЙ, А НЕ ПОРАХОВАНИЙ. Рушій не має годинника
// (DETERMINISM_STANDARD), тож він віддає орбіту — радіус, висоту, нахил,
// фазу, швидкість, — а де риба саме зараз, рахує сцена з власного часу.
// ============================================================
import { clamp01, round6, seededUnit } from './math';
import type { ReefPlan } from './reefAssembly';

/**
 * Скільки риб у найбіднішому й найповнішому рифі.
 *
 * Знизу не нуль: пара, у якої перший порожній рік, має бачити живий
 * риф, а не мертвий камінь. Згори — скільки ще читається зграєю, а не
 * мушвою: понад два десятки дрібних тіл на екрані телефона зливаються
 * в шум.
 */
export const FISH_MIN = 5;
export const FISH_MAX = 22;

/**
 * Палітра зграї: шість тонів, які не сперечаються з коралом.
 *
 * Жовтий, бірюзовий, помаранчевий, синій, сріблястий, фіолетовий —
 * кольори, які справді носять рифові риби, і водночас такі, що жоден із
 * них не збігається з трояндово-помаранчевою дугою коралу.
 */
export const REEF_FISH_COLOURS: ReadonlyArray<readonly [number, number, number]> = [
  [0.98, 0.78, 0.22],
  [0.24, 0.78, 0.76],
  [0.95, 0.45, 0.16],
  [0.28, 0.46, 0.88],
  [0.84, 0.86, 0.9],
  [0.62, 0.42, 0.85],
];

/** Найповільніша й найшвидша риба: обертів за секунду. */
const SPIN_SLOW = 0.014;
const SPIN_FAST = 0.045;

export interface ReefFish {
  /** Радіус кола, по якому риба ходить. */
  orbitRadius: number;
  /** Висота кола над основою рифа. */
  height: number;
  /** Нахил площини кола, радіани — зграя не пласка. */
  tiltRad: number;
  /** Де риба на колі в нульовий час, радіани. */
  phaseRad: number;
  /** Обертів за секунду; від'ємне — проти годинникової. */
  spinPerSecond: number;
  /** Довжина риби в одиницях виду. */
  length: number;
  /** Номер у палітрі. */
  colourIndex: number;
}

/**
 * Зграя цього рифа.
 *
 * Кількість — від того, скільки рифу є що показати: середня
 * наповненість років, зважена їхнім числом. Пара на перший рік бачить
 * кілька риб, пара на десятий — зграю.
 */
export function reefFishSchool(plan: ReefPlan): ReefFish[] {
  const years = plan.colonies.length;
  const meanFill = years === 0
    ? 0
    : plan.colonies.reduce((sum, colony) => sum + colony.fill, 0) / years;
  // Роки й наповненість важать порівну: довга бідна історія й коротка
  // повна мають давати схожу зграю.
  const life = clamp01(0.5 * clamp01(years / 12) + 0.5 * clamp01(meanFill));
  const count = Math.round(FISH_MIN + (FISH_MAX - FISH_MIN) * life);

  const reach = plan.head.radius;
  const top = plan.head.rise;

  return Array.from({ length: count }, (_value, index) => {
    const salt = `reef:fish:${index}`;
    const near = seededUnit(plan.headSeed, `${salt}:near`);
    const high = seededUnit(plan.headSeed, `${salt}:high`);
    const tilt = seededUnit(plan.headSeed, `${salt}:tilt`);
    const speed = seededUnit(plan.headSeed, `${salt}:speed`);
    const size = seededUnit(plan.headSeed, `${salt}:size`);
    const way = seededUnit(plan.headSeed, `${salt}:way`);

    return {
      // Кола йдуть від краю голови й далі: усередині риба пірнала б
      // крізь купол, а рушій тут не рахує зіткнень і рахувати не має.
      orbitRadius: round6(reach * (1.18 + 0.72 * near)),
      height: round6(top * (0.35 + 1.5 * high)),
      tiltRad: round6((tilt - 0.5) * 0.5),
      phaseRad: round6(seededUnit(plan.headSeed, `${salt}:phase`) * Math.PI * 2),
      spinPerSecond: round6(
        (SPIN_SLOW + (SPIN_FAST - SPIN_SLOW) * speed) * (way < 0.5 ? -1 : 1),
      ),
      length: round6(reach * (0.07 + 0.05 * size)),
      colourIndex: index % REEF_FISH_COLOURS.length,
    };
  });
}
