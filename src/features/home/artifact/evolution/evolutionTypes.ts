// ============================================================
// Evolution Engine — Volume I: типи універсальної історії.
// ------------------------------------------------------------
// Рушій моделює ІСТОРІЮ ЖИТТЯ, не геометрію. Він нічого не знає про
// кристали/дерева/маскотів — для нього існують лише події, час і сили.
// Події не створюють форму; вони створюють УМОВИ (тиски), а форма — лише
// наслідок умов, який обчислюють шари нижче (Species → Growth →
// Composition → Renderer).
// ============================================================

/** Джерело події — модуль застосунку. Новий модуль = новий source, ядро
 *  рушія не змінюється (Future Compatibility, §14). */
export type EvolutionSource =
  | 'photos'
  | 'travel'
  | 'memories'
  | 'goals'
  | 'wishes'
  | 'movies'
  | 'books'
  | 'recipes'
  | 'milestones'
  | 'anniversaries'
  | 'finances'
  | 'time';

/** Смислова категорія історії (не «домен кристала» — хоч species-шар і
 *  мапить їх 1:1 на свої регіони росту). 'foundation' — факти самих
 *  стосунків (час разом, спільні фінанси). */
export type EvolutionCategory = 'exploration' | 'memory' | 'connection' | 'creation' | 'future' | 'foundation';

/**
 * Універсальний формат події (§7): УСЕ, що роблять користувачі, зводиться
 * до нього. Photo Added, Place Visited, Goal Completed, Wish Fulfilled…
 */
export interface EvolutionEvent {
  /** Стабільний id: `${source}:${dbId|назва|індекс}` — ніколи не перенумеровується. */
  id: string;
  /** Реальна дата з БД ('YYYY-MM-DD'); null для агрегатних фактів «сьогодні»
   *  (кількість фото, сума фінансів). */
  timestamp: string | null;
  /** Вік у днях (клемплений ≥0) — це і є Evolution Memory (§9): жодного
   *  save-файлу, лише переобчислення з реальних timestamp. */
  ageDays: number;
  source: EvolutionSource;
  category: EvolutionCategory;
  /** Вага події: звичайна подія — 1; агрегат — кількість/сума. */
  intensity: number;
  metadata?: Record<string, string | number>;
}

/** Timeline (§8): відсортована історія, минуле → сьогодні. Артефакт ніколи
 *  не бачить майбутнього — historyAt() читає лише «не молодше за». */
export interface EvolutionTimeline {
  events: EvolutionEvent[];
}

/**
 * Pressure Solver (§10-11): нормалізовані 0..1 канонічні сили еволюції.
 * Species-шари працюють САМЕ з ними (та зі своїми проєкціями) — 100
 * фотографій означають не 100 кристалів, а великий тиск полірування.
 */
export interface EvolutionForces {
  expansion: number;
  memory: number;
  balance: number;
  exploration: number;
  creativity: number;
  harmony: number;
  stability: number;
  curiosity: number;
  care: number;
  growth: number;
}

/** Historical State (§15): скільки чого ВЖЕ існувало на певний вік — єдине
 *  джерело правди для «поля станом на дату події». */
export interface EvolutionHistoryCounts {
  countries: number;
  cities: number;
  memories: number;
  milestones: number;
  goals: number;
  anniversaries: number;
  recipes: number;
  movies: number;
  books: number;
  wishes: number;
  /** Днів разом на той момент. */
  daysTogetherThen: number;
  /** Агрегати «сьогодні» (без датованої історії). */
  photos: number;
  totalSaved: number;
}
