// ============================================================
// Як рухається людина (ADR-0239, власник 2026-11-01: «перемикання анімацій
// має залежати від стану персонажа, а не від випадкового таймера»).
// Чисті функції: стан тіла → кліп → кадр. Стрибок лише показаний — стіни
// й зіткнення він не змінює, вид у грі згори.
// ============================================================

export type MotionClip = 'idle' | 'walk' | 'run' | 'jump';

/** У скільки разів біг швидший за ходу. */
export const RUN_FACTOR = 1.6;
/** Скільки секунд триває стрибок від присідання до приземлення. */
export const JUMP_S = 0.6;
/** Висота стрибка у світових пікселях для аркушів без кадрів стрибка. */
export const HOP_HEIGHT = 5;

export interface BodyState {
  moving: boolean;
  running: boolean;
  /** Секунди від початку стрибка, `null` — на землі. */
  jump: number | null;
}

/** Кліп за станом тіла. Стрибок важливіший за рух: у повітрі ноги не біжать. */
export function motionClip(b: BodyState): MotionClip {
  if (b.jump != null) return 'jump';
  if (!b.moving) return 'idle';
  return b.running ? 'run' : 'walk';
}

/** Стрибнути можна лише із землі: повторне натискання в повітрі нічого не робить. */
export function startJump(jump: number | null): number | null {
  return jump ?? 0;
}

/** Час стрибка за кадр; після приземлення — `null`. */
export function stepJump(jump: number | null, dt: number): number | null {
  if (jump == null) return null;
  const next = jump + dt;
  return next >= JUMP_S ? null : next;
}

/** Де кліпи лежать на спільному аркуші (`scripts/sprites/compose.mjs`). */
export const SHEET_CLIPS: Readonly<Record<MotionClip, readonly number[]>> = {
  idle: [0, 19, 20, 21],
  walk: [1, 2, 3, 4, 5, 6],
  run: [7, 8, 9, 10, 11, 12],
  jump: [13, 14, 15, 16, 17, 18],
};
const CLIP_FPS: Readonly<Record<Exclude<MotionClip, 'jump'>, number>> = { idle: 3, walk: 12, run: 16 };

/** Стовпець спільного аркуша: `t` — час людини, для стрибка — секунди від його початку. */
export function clipColumn(clip: MotionClip, t: number): number {
  const cols = SHEET_CLIPS[clip];
  if (clip === 'jump') return cols[Math.min(cols.length - 1, Math.floor((t / JUMP_S) * cols.length))]!;
  return cols[Math.floor(t * CLIP_FPS[clip]) % cols.length]!;
}

/** Кадр кліпу для старих аркушів: лише стоїть і чотири кадри ходи. */
export function legacyColumn(clip: MotionClip, t: number, frames: number): number {
  if (clip === 'idle' || clip === 'jump' || frames === 0) return 0;
  return 1 + (Math.floor(t * (clip === 'run' ? 13 : 8)) % frames);
}

/** Висота над землею за стрибок для старих аркушів: дуга від землі до землі. */
export function hopHeight(jump: number): number {
  return Math.sin((Math.min(jump, JUMP_S) / JUMP_S) * Math.PI) * HOP_HEIGHT;
}
