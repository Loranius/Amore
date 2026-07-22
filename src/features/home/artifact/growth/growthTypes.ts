// ============================================================
// Growth Engine — Volume III: типи Growth State.
// ------------------------------------------------------------
// Архітектура: Evolution Engine → Species Layer → Growth Instructions →
// Growth Engine → GROWTH STATE → Geometry Engine.
//
// Growth Engine — універсальний процедурний рушій росту: Species Layer
// визначає ЩО росте, Growth Engine — ЯК воно росте. Він детермінований,
// append-only, renderer- і physics-незалежний, працює через ріст НА
// поверхнях (surface-based) і не знає, що саме вирощує (species-agnostic):
// усе видове приходить крізь GrowthInstruction (Volume II).
//
// Growth State — явний вихід рушія: набір вирощених тіл + порядок їх появи
// (Growth Order) + самооцінка композиції. Geometry Engine (crystal3d/)
// перетворює його на меши; сам рушій мешів/матеріалів не торкається.
// ============================================================
import type { DepositedCrystal } from '../artifactTypes';
import type { CompositionScore } from '../composition/score';

/**
 * Абстрактне «вирощене тіло» — одиниця Growth State. Для виду «кристал»
 * Growth Body Є DepositedCrystal (звужений конус на поверхні маси); інший
 * вид (дерево/корал) підставить власне тіло, а мeханіка рушія лишиться та
 * сама. Псевдонім тримає термінологію Volume III, не дублюючи тип.
 */
export type GrowthBody = DepositedCrystal;

/** Явний вихід Growth Engine (Vol III: «Growth State»). */
export interface GrowthState {
  /** Вирощені тіла — суцільна геологічна маса після композиції. */
  bodies: readonly GrowthBody[];
  /** Growth Order — ключі тіл у порядку відкладення (детермінований). */
  order: readonly string[];
  /** Самооцінка композиції (Hierarchy/Flow/Silhouette/…). */
  score: CompositionScore;
  /** Скільки проходів композиції знадобилось (1 або 2). */
  passes: number;
}
