import { CRYSTAL_CENTRE_POSE, type WorldCameraPose } from './crystalAtlas';

// ============================================================
// The Scene Director — one place that decides where the camera is going.
// ------------------------------------------------------------
// Brief §22 asks for exactly this and for a reason worth restating: without it,
// every module grows its own camera animation, and the second one to be written
// fights the first. So the rule is that no feature moves the camera. Features
// change the route; the atlas turns the route into a pose (ADR-0021); this file
// turns a pose into where the camera actually is this frame.
//
// Pure and frame-rate independent: it takes the elapsed seconds and returns the
// next state. Nothing here touches Three, React, the DOM or the clock, which is
// why the awkward parts — interruption, deep links, manual rotation — can be
// tested at all rather than only looked at.
// ============================================================

/**
 * How much the world is allowed to move on its own right now (§27).
 *
 * `navigation` is not requested by anyone: the director derives it from its own
 * travelling state, because "the camera is moving" is a fact about the camera,
 * not a mood the UI can declare.
 */
export type WorldMotionMode = 'idle' | 'navigation' | 'interaction' | 'modal' | 'reduced';

/** What a mode requests of the idle motion, 0 = perfectly still. */
const IDLE_GAIN: Readonly<Record<WorldMotionMode, number>> = {
  idle: 1,
  // While travelling, the travel *is* the motion. Adding drift on top would
  // read as the camera failing to settle.
  navigation: 0,
  // §27: the UI must never feel like it floats over a moving ride.
  interaction: 0,
  modal: 0,
  reduced: 0,
};

/**
 * Скільки кристал повертається сам, поки лежить фоном модуля, рад/с.
 *
 * Прохання власника: «після відкриття модуля і завершення прокрутки кристала,
 * кристал в модулі на фоні починає повільно обертатись навколо своєї осі», і
 * на запитання про швидкість він обрав оберт приблизно за дві хвилини.
 *
 * Це НЕ те саме, що `IDLE_*` нижче. Ті — дихання: синус із амплітудою 0.8°,
 * який повертається туди, звідки почав. Це — рух в один бік без кінця, і
 * тому він окремий: скласти їх в одну формулу означало б, що зміна дихання
 * міняє швидкість обертання.
 */
export const MODULE_SPIN_RATE = (2 * Math.PI) / 120;

/** What the couple turned by hand, on top of whatever the route asked for. */
export interface ManualTurn {
  azimuth: number;
  elevation: number;
}

export const NO_MANUAL_TURN: ManualTurn = { azimuth: 0, elevation: 0 };

export interface SceneDirectorState {
  /** Where the route wants the camera. */
  target: WorldCameraPose;
  /** Where the camera has got to, before manual turn and idle motion. */
  base: WorldCameraPose;
  /** Retained hand rotation. Survives standing still, dissolves on travel. */
  manual: ManualTurn;
  /** Smoothed idle amplitude, 0–1. Smoothed so a mode change fades. */
  idleGain: number;
  /** Seconds of idle motion accumulated. Only advances while the idle is on. */
  clock: number;
  /**
   * Куди довернувся кристал власним обертанням, рад.
   *
   * Тримається в межах одного оберту: за годину в модулі сире число виросло б
   * до сотень радіан, і точність синуса на ньому просіла б там, де її ніхто не
   * шукатиме.
   */
  spinAngle: number;
  /** True while the base pose has not yet reached the target. */
  travelling: boolean;
}

export interface SceneDirectorInput {
  /** The route's pose, from the atlas. */
  target: WorldCameraPose;
  /** What the UI is asking of the world right now. */
  mode: Exclude<WorldMotionMode, 'navigation'>;
  /** Seconds since the last step. */
  dt: number;
  /**
   * Скільки кристал повертається сам цього кадру, рад/с.
   *
   * Вирішує той, хто знає маршрут: у модулі кристал — фон і обертається, на
   * головній він сам предмет розмови й стоїть. Директор про маршрути не знає
   * і знати не повинен.
   */
  spin?: number;
  /**
   * How far the orbit controls moved the camera away from what the director
   * last wrote — that is, what the couple's finger did.
   */
  drift?: ManualTurn;
}

/**
 * Half-life of the approach to the target, in seconds.
 *
 * Exponential rather than a tween with a duration, and that choice is the whole
 * answer to §24. A tween has to be cancelled, replaced or queued when the
 * couple taps a second destination mid-flight, and every one of those is a way
 * to snap, stack or freeze. An exponential approach has no schedule to
 * interrupt: retargeting changes where it is heading, and it continues from
 * whatever it had reached, at whatever speed it had.
 *
 * 0.22 s puts the camera within 5% of its destination in about 0.95 s — a
 * settled arrival rather than a slide.
 */
const TRAVEL_HALF_LIFE = 0.22;

/** Idle motion fades in and out this slowly, so modes change without a lurch. */
const IDLE_GAIN_HALF_LIFE = 0.55;

/**
 * Below this, the camera is where it was asked to be.
 *
 * Needed because an exponential never quite arrives: without a floor, the
 * director would report itself travelling forever and the world would never
 * return to its idle motion.
 */
const SETTLED = 0.0012;

/** Idle motion (§26). Amplitudes are deliberately at the edge of noticeable. */
const IDLE_AZIMUTH_AMPLITUDE = 0.014;
const IDLE_AZIMUTH_PERIOD = 53;
const IDLE_DISTANCE_AMPLITUDE = 0.006;
const IDLE_DISTANCE_PERIOD = 37;
const IDLE_HEIGHT_AMPLITUDE = 0.004;
const IDLE_HEIGHT_PERIOD = 41;

/**
 * The largest step the director will take at once.
 *
 * A backgrounded tab hands back a dt of many seconds. Without this the first
 * frame after returning would resolve the whole approach in one jump, which is
 * the snap §24 forbids — arriving by way of a hidden tab rather than a tap.
 */
const MAX_STEP = 1 / 15;

/** Shortest signed turn from one bearing to another, in radians. */
export function shortestTurn(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

/** Fraction of the remaining distance to cover in `dt`, given a half-life. */
function approach(dt: number, halfLife: number): number {
  if (dt <= 0) return 0;
  return 1 - Math.pow(2, -dt / halfLife);
}

/**
 * The state a cold open starts in (§25).
 *
 * Standing at the target rather than travelling to it: opening `/calendar`
 * directly must *be* the Calendar world, not a flight from Home that the couple
 * never took.
 */
export function createSceneDirector(target: WorldCameraPose = CRYSTAL_CENTRE_POSE): SceneDirectorState {
  return {
    target,
    base: target,
    manual: NO_MANUAL_TURN,
    idleGain: 0,
    clock: 0,
    spinAngle: 0,
    travelling: false,
  };
}

function samePose(a: WorldCameraPose, b: WorldCameraPose): boolean {
  return a.azimuth === b.azimuth
    && a.targetHeight === b.targetHeight
    && a.elevation === b.elevation
    && a.distance === b.distance
    && a.luminosity === b.luminosity;
}

export function advanceSceneDirector(
  state: SceneDirectorState,
  input: SceneDirectorInput,
): SceneDirectorState {
  const dt = Number.isFinite(input.dt) ? Math.min(Math.max(input.dt, 0), MAX_STEP) : 0;
  const drift = input.drift ?? NO_MANUAL_TURN;
  const retargeted = !samePose(state.target, input.target);

  // Hand rotation is picked up wherever it happened, including the damping tail
  // after the finger lifts — the director reads what the controls did rather
  // than trying to know when a drag is over.
  const turned: ManualTurn = {
    azimuth: state.manual.azimuth + (Number.isFinite(drift.azimuth) ? drift.azimuth : 0),
    elevation: state.manual.elevation + (Number.isFinite(drift.elevation) ? drift.elevation : 0),
  };

  if (input.mode === 'reduced') {
    // §47: reduced motion keeps the spatial identity and drops the journey.
    // The pose changes at once, and the hand rotation goes with it, because a
    // retained turn is only meaningful as something the couple can watch
    // dissolve.
    return {
      target: input.target,
      base: input.target,
      manual: retargeted ? NO_MANUAL_TURN : turned,
      idleGain: 0,
      clock: state.clock,
      // §47: під зменшеним рухом кристал не обертається. Кут лишається там,
      // де був, а не скидається: повернення до звичайного режиму не має
      // виглядати стрибком.
      spinAngle: state.spinAngle,
      travelling: false,
    };
  }

  const k = approach(dt, TRAVEL_HALF_LIFE);
  const azimuth = state.base.azimuth + shortestTurn(state.base.azimuth, input.target.azimuth) * k;
  const base: WorldCameraPose = {
    azimuth,
    targetHeight: state.base.targetHeight + (input.target.targetHeight - state.base.targetHeight) * k,
    elevation: state.base.elevation + (input.target.elevation - state.base.elevation) * k,
    distance: state.base.distance + (input.target.distance - state.base.distance) * k,
    luminosity: state.base.luminosity + (input.target.luminosity - state.base.luminosity) * k,
  };

  const remaining = Math.max(
    Math.abs(shortestTurn(base.azimuth, input.target.azimuth)),
    Math.abs(input.target.targetHeight - base.targetHeight),
    Math.abs(input.target.elevation - base.elevation),
    Math.abs(input.target.distance - base.distance),
    Math.abs(input.target.luminosity - base.luminosity),
  );
  const settled = remaining < SETTLED;

  // A hand turn is the couple's while they stay, and the atlas's when they
  // travel. This is the question ADR-0021 left open, answered: keeping the turn
  // across a route change would land Wishlist on whichever side they happened
  // to have spun to, which is exactly the spatial memory §20 is asking for.
  const manual: ManualTurn = settled
    ? turned
    : {
      azimuth: turned.azimuth * (1 - k),
      elevation: turned.elevation * (1 - k),
    };

  const spin = Number.isFinite(input.spin) ? input.spin! : 0;
  const wanted = IDLE_GAIN[settled ? input.mode : 'navigation'];
  const gainStep = approach(dt, IDLE_GAIN_HALF_LIFE);
  const idleGain = state.idleGain + (wanted - state.idleGain) * gainStep;

  return {
    target: input.target,
    base: settled ? { ...input.target } : base,
    manual,
    idleGain,
    // The idle clock only runs while the idle motion is showing, so the drift
    // resumes from where it stopped instead of jumping to where it would have
    // been had the couple not been reading.
    clock: state.clock + dt * idleGain,
    // Обертання йде на тому ж підсиленні, що й дихання, і це навмисно: воно
    // мовчить, поки камера летить, і завмирає під модалкою чи пальцем — тобто
    // рівно тоді, коли §27 забороняє рухати світ під інтерфейсом.
    spinAngle: wrapAngle(state.spinAngle + dt * spin * idleGain),
    travelling: !settled,
  };
}

/** Кут у межах одного оберту, щоб число не росло без кінця. */
function wrapAngle(angle: number): number {
  const turn = 2 * Math.PI;
  const wrapped = angle % turn;
  return wrapped < 0 ? wrapped + turn : wrapped;
}

/** What the camera should be at, all three contributions composed. */
export function sceneDirectorPose(state: SceneDirectorState): WorldCameraPose {
  const t = state.clock;
  const gain = state.idleGain;
  return {
    azimuth: state.base.azimuth
      + state.manual.azimuth
      + state.spinAngle
      + Math.sin((2 * Math.PI * t) / IDLE_AZIMUTH_PERIOD) * IDLE_AZIMUTH_AMPLITUDE * gain,
    targetHeight: state.base.targetHeight
      + Math.sin((2 * Math.PI * t) / IDLE_HEIGHT_PERIOD + 1.7) * IDLE_HEIGHT_AMPLITUDE * gain,
    elevation: state.base.elevation + state.manual.elevation,
    distance: state.base.distance
      + Math.sin((2 * Math.PI * t) / IDLE_DISTANCE_PERIOD + 0.9) * IDLE_DISTANCE_AMPLITUDE * gain,
    luminosity: state.base.luminosity,
  };
}

/**
 * The mode the world is actually in, as opposed to the one the UI asked for.
 *
 * Travelling wins over idle and loses to everything else: a modal is open or a
 * finger is on the glass regardless of where the camera happens to be.
 */
export function effectiveMotionMode(
  state: SceneDirectorState,
  requested: Exclude<WorldMotionMode, 'navigation'>,
): WorldMotionMode {
  if (requested !== 'idle') return requested;
  return state.travelling ? 'navigation' : 'idle';
}
