// ============================================================
// Відгук кристала на нове з минулого візиту (ADR-0261).
// ------------------------------------------------------------
// Оцінка за таблицею `threejs-aaa-graphics-builder` (2026-11-10) дала
// «ефектам і руху» 1: порошинки й сяйво були, але жодне не відповідало на
// те, що пара зробила. Тут — короткий відгук на кожен вид нової події, у
// дусі моделі кристала, де кожен модуль дає рівно один ефект (ADR-0217):
//
//   * спогад (`memory`)  — хвиля світла знизу вгору: спогади розширюють тіло;
//   * план (`plan`)      — спалах граней вершини: плани дають грані вершини;
//   * бажання, медіа     — кристал і ореол наливаються кольором: бажання дають
//     (`wish`, `media`)    колір, медіа — сяйво;
//   * місце, подія       — сплеск порошинок з основи: місця нахиляють
//     (`place`,            кристали років, віхи дають іскри.
//     `calendar`)
//
// Модуль чистий: розклад і обвідні — функції часу, без three й React.
// Відгук грає один раз за візит, після того як сцена з'явилась, і лише
// для того, що справді нове (`GrowthSummary.kinds`); на першому візиті
// нового немає, тож і відгуку немає.
// ============================================================

type CelebrationEffect = 'wave' | 'crown' | 'flush' | 'burst';

/** Вид події → ефект. Невідомий вид мовчить, а не вигадує відгук. */
const EFFECT_OF: Readonly<Record<string, CelebrationEffect>> = {
  memory: 'wave',
  plan: 'crown',
  wish: 'flush',
  media: 'flush',
  place: 'burst',
  calendar: 'burst',
};

/** Порядок, у якому ефекти йдуть один за одним: від основи до вістря, потім колір і порошинки. */
const ORDER: readonly CelebrationEffect[] = ['wave', 'crown', 'flush', 'burst'];

/** Пауза після появи сцени: спершу кристал, потім відгук. */
export const CELEBRATION_DELAY_S = 1.2;
/** Тривалість одного ефекту. */
export const CELEBRATION_DURATION_S = 2.4;
/** Наступний ефект починається, поки попередній ще згасає. */
const CELEBRATION_STEP_S = 1.1;

export interface CelebrationBeat {
  effect: CelebrationEffect;
  start: number;
  duration: number;
}

/** Розклад відгуку: кожен ефект один раз, у сталому порядку. */
export function celebrationTimeline(kinds: readonly string[]): CelebrationBeat[] {
  const wanted = new Set(kinds.map((kind) => EFFECT_OF[kind]).filter((effect): effect is CelebrationEffect => effect !== undefined));
  return ORDER.filter((effect) => wanted.has(effect)).map((effect, k) => ({
    effect,
    start: CELEBRATION_DELAY_S + k * CELEBRATION_STEP_S,
    duration: CELEBRATION_DURATION_S,
  }));
}

/** Коли відгук скінчився повністю — далі сцена знову тиха. */
export function celebrationEnd(timeline: readonly CelebrationBeat[]): number {
  return timeline.reduce((end, beat) => Math.max(end, beat.start + beat.duration), 0);
}

export interface CelebrationState {
  /** Сила хвилі 0…1 і де вона зараз — частка висоти тіла. */
  wave: number;
  waveAt: number;
  /** Спалах вершини 0…1. */
  crown: number;
  /** Наливання кольором 0…1 — тіло й ореол. */
  flush: number;
  /** Сплеск порошинок 0…1. */
  burst: number;
}

export const CELEBRATION_REST: CelebrationState = { wave: 0, waveAt: 0, crown: 0, flush: 0, burst: 0 };

/** М'який горб: 0 на краях, 1 посередині, без зламу на початку й наприкінці. */
function hump(progress: number): number {
  if (progress <= 0 || progress >= 1) return 0;
  return Math.sin(Math.PI * progress) ** 2;
}

/** Стан відгуку в мить `t` секунд від появи сцени. */
export function celebrationAt(timeline: readonly CelebrationBeat[], t: number): CelebrationState {
  const state: CelebrationState = { ...CELEBRATION_REST };
  for (const beat of timeline) {
    const progress = (t - beat.start) / beat.duration;
    const strength = hump(progress);
    if (strength === 0) continue;
    if (beat.effect === 'wave') {
      state.wave = strength;
      // Хвиля проходить від трохи нижче основи до трохи вище вістря.
      state.waveAt = -0.15 + 1.3 * progress;
    } else {
      state[beat.effect] = strength;
    }
  }
  return state;
}
