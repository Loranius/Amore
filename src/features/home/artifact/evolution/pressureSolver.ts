// ============================================================
// Pressure Solver — Volume I, §10-11: події не ростять форму, вони
// створюють СИЛИ. Тут історія перетворюється на нормалізовані канонічні
// сили еволюції та Historical State («скільки чого вже існувало на вік N»
// — артефакт ніколи не бачить майбутнього, §8).
// Детермінізм абсолютний (§12): ті самі дані → ті самі сили. 100%.
// ============================================================
import type {
  EvolutionEvent,
  EvolutionForces,
  EvolutionHistoryCounts,
  EvolutionTimeline,
} from './evolutionTypes';

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

const isCountry = (e: EvolutionEvent): boolean => e.source === 'travel' && e.metadata?.['kind'] === 'country';
const isCity = (e: EvolutionEvent): boolean => e.source === 'travel' && e.metadata?.['kind'] === 'city';

/**
 * Historical State: рахунки джерел серед подій НЕ МОЛОДШИХ за ageDays.
 * Порівнюються ВІКИ (різниці стабільні між днями) — додавання даних
 * сьогоднішньою датою не змінює історію жодної старшої події.
 */
export function historyAt(timeline: EvolutionTimeline, ageDays: number): EvolutionHistoryCounts {
  const counts: EvolutionHistoryCounts = {
    countries: 0,
    cities: 0,
    memories: 0,
    milestones: 0,
    goals: 0,
    anniversaries: 0,
    recipes: 0,
    movies: 0,
    books: 0,
    wishes: 0,
    daysTogetherThen: 0,
    photos: 0,
    totalSaved: 0,
  };
  for (const e of timeline.events) {
    // Агрегати «сьогодні» доступні завжди (вони не мають власної історії).
    if (e.source === 'photos') {
      counts.photos = e.intensity;
      continue;
    }
    if (e.source === 'finances') {
      counts.totalSaved = e.intensity;
      continue;
    }
    if (e.source === 'time') {
      counts.daysTogetherThen = Math.max(0, e.intensity - ageDays);
      continue;
    }
    if (e.ageDays < ageDays) continue; // молодше за запит — майбутнє, невидиме
    if (isCountry(e)) counts.countries += 1;
    else if (isCity(e)) counts.cities += 1;
    else if (e.source === 'memories') counts.memories += 1;
    else if (e.source === 'milestones') counts.milestones += 1;
    else if (e.source === 'goals') counts.goals += 1;
    else if (e.source === 'anniversaries') counts.anniversaries += 1;
    else if (e.source === 'recipes') counts.recipes += 1;
    else if (e.source === 'movies') counts.movies += 1;
    else if (e.source === 'books') counts.books += 1;
    else if (e.source === 'wishes') counts.wishes += 1;
  }
  return counts;
}

/** Смислові «частки» категорій — та сама вагова модель, що жила в
 *  species-шарі (віха важить 6 звичайних подій Connection). */
export function categoryShares(counts: EvolutionHistoryCounts): Record<'exploration' | 'memory' | 'connection' | 'creation' | 'future', number> {
  return {
    exploration: counts.countries * 3 + counts.cities,
    memory: counts.memories,
    connection: counts.milestones * 6 + counts.goals + counts.anniversaries,
    creation: counts.recipes + counts.movies + counts.books,
    future: counts.wishes,
  };
}

/** Pielou-подібна рівномірність: 0 = один голос домінує, 1 = ідеально рівно. */
export function evenness(values: readonly number[]): number {
  const total = values.reduce((a, b) => a + b, 0);
  if (total <= 0) return 0;
  let entropy = 0;
  for (const value of values) {
    if (value > 0) {
      const p = value / total;
      entropy -= p * Math.log(p);
    }
  }
  return entropy / Math.log(values.length);
}

/**
 * Канонічні сили еволюції (нормалізовані 0..1) — універсальний вихід для
 * БУДЬ-ЯКОГО species-шару (кристал/корал/маскот). Кристалічна проєкція
 * (evolutionPressure.ts) має власні, історично успадковані формули — ці
 * сили є чистим, майбутньо-сумісним словником.
 */
export function solveForces(timeline: EvolutionTimeline): EvolutionForces {
  const c = historyAt(timeline, 0);
  const shares = categoryShares(c);
  const shareValues = [shares.exploration, shares.memory, shares.connection, shares.creation, shares.future];
  const total = shareValues.reduce((a, b) => a + b, 0) || 1;
  const dominance = Math.max(...shareValues) / total;

  return {
    expansion: clamp01((c.countries * 3 + c.cities) / 28),
    memory: clamp01(c.memories / 24),
    balance: clamp01(1 - dominance),
    exploration: clamp01(shares.exploration / total),
    creativity: clamp01(shares.creation / total),
    harmony: clamp01(evenness(shareValues)),
    stability: clamp01((c.goals / 8) * 0.5 + (Math.min(c.anniversaries, 4) / 4) * 0.3 + (Math.min(c.daysTogetherThen, 1000) / 1000) * 0.2),
    curiosity: clamp01(c.books * 0.08 + c.movies * 0.01),
    care: clamp01((c.goals / 8) * 0.5 + (Math.min(c.anniversaries, 4) / 4) * 0.3 + (Math.min(c.wishes, 14) / 14) * 0.2),
    growth: clamp01(Math.min(c.daysTogetherThen, 1000) / 1000),
  };
}
