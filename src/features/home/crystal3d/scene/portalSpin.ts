// ============================================================
// Поворот сцени рукою — плавний, з інерцією й доводкою (ADR-0211).
// ------------------------------------------------------------
// Власник: «обертання відбувається ривками, зроби його більш плавним і
// ніжним з автодоводкою після обертання, якщо відбувся один різкий свайп».
//
// ЧОМУ НЕ `OrbitControls`. Він додає рух пальця ПОДІЄЮ, а згасає НА КАДР
// (`dampingFactor` — частка за кадр, див. `portalOrbit.ts`). На телефоні
// події дотику приходять пачками, а кадри — нерівно, тож камера рухалась
// поштовхами: кадр без події стоїть, кадр із двома — стрибає. Інерції
// після відпускання при 0.26 на кадр майже немає — рух обривався.
//
// Тут усе рахується ЗА ЧАСОМ, а не за кадрами:
//   - палець рухає ЦІЛЬ, а видимий кут іде за нею експоненційно з
//     напівперіодом `FOLLOW_HALF_LIFE` — однаково на 30 і на 120 кадрах;
//   - відпускання запускає критично згасаючу пружину з ТІЄЮ Ж швидкістю,
//     що мав палець, — рух не обривається й не смикається;
//   - різкий свайп (кутова швидкість понад `FLICK_SPEED`) «доводиться»:
//     кінцевий кут інерції округлюється до найближчої восьмої оберту, а
//     жорсткість пружини підбирається так, щоб вона прийшла туди без
//     перельоту — острів м'яко лягає в кадр, а не зупиняється будь-де.
//
// Модуль чистий і детермінований: час приходить аргументом, годинника
// тут немає, тож поведінку перевіряє тест, а не око.
// ============================================================

/** Напівперіод, за який видимий кут проходить половину шляху до пальця, с. */
export const FOLLOW_HALF_LIFE = 0.05;

/** Кутова швидкість, з якої свайп вважається різким, рад/с. */
export const FLICK_SPEED = 3.5;

/** Крок доводки після різкого свайпу: восьма частина оберту. */
export const FLICK_SNAP = Math.PI / 4;

/**
 * Скільки інерція несе після різкого свайпу: шлях = швидкість × τ.
 * 0.32 с — рух помітно «допливає», але не крутить острів дзигою.
 */
export const FLICK_GLIDE = 0.32;

/** Найдовший шлях інерції — пів оберту; далі різкий свайп не несе. */
export const FLICK_MAX_TRAVEL = Math.PI;

/** Коротке допливання після звичайного (не різкого) відпускання, с. */
export const SOFT_GLIDE = 0.1;

/** Вікно, за яким міряється швидкість пальця, с. */
const VELOCITY_WINDOW = 0.1;

/** Якщо палець стояв довше за це перед відпусканням, інерції немає, с. */
const STILL_BEFORE_RELEASE = 0.08;

/** Межі жорсткості пружини, 1/с: і не в'язко, і не різко. */
const MIN_OMEGA = 2.2;
const MAX_OMEGA = 16;

export interface PortalSpinGlide {
  /** Куди пружина веде кут. */
  readonly goal: number;
  /** Коли відпущено, с. */
  readonly start: number;
  /** Відхилення від цілі в момент відпускання: x₀ − goal. */
  readonly offset: number;
  /** Похідна коефіцієнта: v₀ + ω·offset. */
  readonly slope: number;
  readonly omega: number;
  /** Чи це доводка різкого свайпу. */
  readonly flick: boolean;
}

export interface PortalSpinState {
  /** Видимий поворот, рад — те, що бачить пара. */
  readonly azimuth: number;
  /** Куди тягне палець, рад. */
  readonly azimuthTarget: number;
  /** Видимий підйом (у частках синуса, як у директора сцени). */
  readonly elevation: number;
  readonly elevationTarget: number;
  readonly dragging: boolean;
  /** Останні положення пальця для швидкості: [час, кут]. */
  readonly samples: readonly (readonly [number, number])[];
  readonly glide: PortalSpinGlide | null;
  /** Час останнього кроку, с. */
  readonly clock: number;
}

export const PORTAL_SPIN_REST: PortalSpinState = {
  azimuth: 0,
  azimuthTarget: 0,
  elevation: 0,
  elevationTarget: 0,
  dragging: false,
  samples: [],
  glide: null,
  clock: 0,
};

function glideAt(glide: PortalSpinGlide, now: number): { angle: number; velocity: number } {
  const t = Math.max(0, now - glide.start);
  const decay = Math.exp(-glide.omega * t);
  const coefficient = glide.offset + glide.slope * t;
  return {
    angle: glide.goal + coefficient * decay,
    velocity: (glide.slope - glide.omega * coefficient) * decay,
  };
}

/** Палець торкнувся: ловимо острів там, де він зараз, навіть якщо він пливе. */
export function portalSpinGrab(state: PortalSpinState, now: number): PortalSpinState {
  const here = state.glide !== null ? glideAt(state.glide, now).angle : state.azimuth;
  return {
    ...state,
    azimuth: here,
    azimuthTarget: here,
    elevationTarget: state.elevation,
    dragging: true,
    samples: [[now, here]],
    glide: null,
    clock: now,
  };
}

/**
 * Палець зрушив. Кути — вже переведені з пікселів у радіани тим, хто знає
 * розмір полотна. Підйом затискається межами, які дає викликач.
 */
export function portalSpinDrag(
  state: PortalSpinState,
  now: number,
  deltaAzimuth: number,
  deltaElevation: number,
  elevationBounds: readonly [number, number] = [-Infinity, Infinity],
): PortalSpinState {
  if (!state.dragging) return state;
  const azimuthTarget = state.azimuthTarget + (Number.isFinite(deltaAzimuth) ? deltaAzimuth : 0);
  const elevationTarget = Math.min(
    elevationBounds[1],
    Math.max(elevationBounds[0], state.elevationTarget + (Number.isFinite(deltaElevation) ? deltaElevation : 0)),
  );
  const samples = [...state.samples, [now, azimuthTarget] as const]
    .filter(([time]) => now - time <= VELOCITY_WINDOW);
  return { ...state, azimuthTarget, elevationTarget, samples };
}

/** Швидкість пальця в момент відпускання, рад/с. */
export function portalSpinReleaseVelocity(state: PortalSpinState, now: number): number {
  const recent = state.samples.filter(([time]) => now - time <= VELOCITY_WINDOW);
  if (recent.length < 2) return 0;
  const [lastTime, lastAngle] = recent[recent.length - 1]!;
  if (now - lastTime > STILL_BEFORE_RELEASE) return 0;
  const [firstTime, firstAngle] = recent[0]!;
  const span = lastTime - firstTime;
  if (span < 1e-3) return 0;
  return (lastAngle - firstAngle) / span;
}

/**
 * Куди ляже острів після відпускання з такою швидкістю.
 *
 * Різкий свайп: природний кінець інерції, округлений до восьмої оберту.
 * Округлення — у бік руху або назад, до найближчого: рука, що кинула
 * острів, бачить, що він доплив і став рівно, а не що його відкинуло.
 * Якщо округлення впало б ПОЗАДУ місця відпускання (дуже коротка
 * інерція), ціль — наступний крок у бік руху: розвертати острів проти
 * свайпу було б найгіршим з можливих «ніжно».
 */
export function portalSpinLanding(from: number, velocity: number): { goal: number; flick: boolean } {
  if (!Number.isFinite(velocity) || Math.abs(velocity) < FLICK_SPEED) {
    return { goal: from + (Number.isFinite(velocity) ? velocity : 0) * SOFT_GLIDE, flick: false };
  }
  const direction = Math.sign(velocity);
  const travel = Math.min(Math.abs(velocity) * FLICK_GLIDE, FLICK_MAX_TRAVEL);
  let goal = Math.round((from + direction * travel) / FLICK_SNAP) * FLICK_SNAP;
  if ((goal - from) * direction <= 1e-6) goal += direction * FLICK_SNAP;
  return { goal, flick: true };
}

/** Палець відпущено (або жест скасовано — тоді без інерції). */
export function portalSpinRelease(
  state: PortalSpinState,
  now: number,
  options: { cancelled?: boolean; reduceMotion?: boolean } = {},
): PortalSpinState {
  if (!state.dragging) return state;
  const velocity = options.cancelled ? 0 : portalSpinReleaseVelocity(state, now);
  const from = state.azimuth;
  if (options.reduceMotion) {
    // §47: без подорожі — кут стає під пальцем і лишається.
    return {
      ...state,
      azimuth: state.azimuthTarget,
      elevation: state.elevationTarget,
      dragging: false,
      samples: [],
      glide: null,
      clock: now,
    };
  }
  /*
   * Ціль рахується від ПАЛЬЦЯ, а пружина стартує з ВИДИМОГО кута: видимий
   * трохи відстає (`FOLLOW_HALF_LIFE`), і якби ціль бралась від нього,
   * відпускання щоразу «з'їдало» б останні міліметри жесту.
   */
  const landing = portalSpinLanding(state.azimuthTarget, velocity);
  const offset = from - landing.goal;
  const distance = Math.abs(offset);
  /*
   * Жорсткість — з умови «прийти без перельоту»: для критичної пружини
   * з початковою швидкістю v, спрямованою до цілі на відстані d, рух іде
   * чистою експонентою, коли ω = |v| / d. Тоді вона й стартує рівно зі
   * швидкістю пальця — без ривка на відпусканні.
   */
  const omega = distance > 1e-6 && Math.abs(velocity) > 1e-6
    ? Math.min(MAX_OMEGA, Math.max(MIN_OMEGA, Math.abs(velocity) / distance))
    : 1 / SOFT_GLIDE;
  const glide: PortalSpinGlide = {
    goal: landing.goal,
    start: now,
    offset,
    slope: velocity + omega * offset,
    omega,
    flick: landing.flick,
  };
  return { ...state, dragging: false, samples: [], glide, clock: now };
}

/** Крок часу: видимий кут іде за пальцем або пливе пружиною. */
export function portalSpinStep(
  state: PortalSpinState,
  now: number,
  reduceMotion = false,
): PortalSpinState {
  const dt = Math.max(0, now - state.clock);
  const follow = reduceMotion ? 1 : 1 - 2 ** (-dt / FOLLOW_HALF_LIFE);
  const elevation = state.elevation + (state.elevationTarget - state.elevation) * follow;
  if (state.dragging) {
    return {
      ...state,
      azimuth: state.azimuth + (state.azimuthTarget - state.azimuth) * follow,
      elevation,
      clock: now,
    };
  }
  if (state.glide !== null) {
    const { angle, velocity } = glideAt(state.glide, now);
    const done = Math.abs(angle - state.glide.goal) < 1e-3 && Math.abs(velocity) < 1e-2;
    return {
      ...state,
      azimuth: done ? state.glide.goal : angle,
      azimuthTarget: state.glide.goal,
      elevation,
      glide: done ? null : state.glide,
      clock: now,
    };
  }
  return { ...state, elevation, clock: now };
}

/** Чи рухається ще щось — щоб не тримати кадри живими даремно. */
export function portalSpinMoving(state: PortalSpinState): boolean {
  return state.dragging
    || state.glide !== null
    || Math.abs(state.elevationTarget - state.elevation) > 1e-5;
}
