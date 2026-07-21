// ============================================================
// Species Layer — Volume II: SDK виду.
// ------------------------------------------------------------
// Species Layer — перекладач між Evolution Engine і Growth Engine:
// Evolution нічого не знає про світ, Growth нічого не знає про історію;
// вид пояснює, «як саме ЦЕЙ вид реагує на історію». Evolution каже «пара
// багато подорожувала» — вид вирішує, що це означає для кристала (нові
// колонії), для дерева (довші гілки) чи для маскота (цікавість).
//
// Вид НІКОЛИ не: генерує вершини, працює з GPU/матеріалами/шейдерами,
// знає про Three.js/React, малює. Лише біологія/геологія, морфологія,
// правила реакцій, обмеження і власний стан.
//
// Повністю модульний SDK (§14): новий вид = один файл поруч
// (crystalSpecies.ts, treeSpecies.ts, eggSpecies.ts…), що реалізує цей
// інтерфейс. Growth Engine отримує лише GrowthInstruction і взагалі не
// знає, що вирощує (§15).
// ============================================================

/**
 * Growth Instruction (§7) — єдиний вихід виду в Growth Engine:
 *  • streams — ЩО і КОЛИ відкладається (перелічені місця росту виду);
 *  • fieldAt — історичне ймовірнісне поле «ДЕ» станом на вік події;
 *  • reactions — проєкція еволюційних тисків у словник виду
 *    (споживають і Growth, і рендер-матеріал);
 *  • hierarchy — видові ролі (напр. головний кристал друзи);
 *  • constraints — природні правила виду числами (§10);
 *  • speciesState — внутрішній стан виду (§13), описовий.
 */
export interface GrowthInstruction<TStream, TField, TReactions, TConstraints, TState> {
  streams: readonly TStream[];
  fieldAt: (ageDays: number) => TField;
  reactions: TReactions;
  hierarchy: { monarchKey: string | null };
  constraints: TConstraints;
  speciesState: TState;
}

/** Species SDK (§14): react / evolve / constrain / buildInstructions. */
export interface Species<TInput, TStream, TField, TReactions, TConstraints, TState, TStage> {
  name: string;
  /** Морфологія (§9): що взагалі може рости в цього виду. */
  morphology: readonly string[];
  /** Правила реакцій (§11): як тиски історії проявляються у виді. */
  react(input: TInput): TReactions;
  /** Еволюція виду (§12): стадія життєвого циклу конкретного тіла. */
  evolve(maturity: number, energy: number, refinement: number): TStage;
  /** Природні обмеження (§10) — числа/прапорці, які читає Growth Engine. */
  constrain(): TConstraints;
  /** Головний вхід: історія + ДНК + seed → Growth Instructions (§7). */
  buildInstructions(input: TInput): GrowthInstruction<TStream, TField, TReactions, TConstraints, TState>;
}
