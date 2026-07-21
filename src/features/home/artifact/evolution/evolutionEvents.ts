// ============================================================
// Evolution Events — нормалізація всіх модулів застосунку в універсальну
// історію (Volume I, §6-8). Кожен модуль сайту — фото, подорожі, спогади,
// досягнення, бажання, фільми, книги, рецепти, фінанси, сам час — стає
// потоком EvolutionEvent. Підключення майбутнього модуля = ще один блок
// тут; ядро рушія (типи, solver) не змінюється.
// ============================================================
import { daysBetween } from '../../homeUtils';
import type { ArtifactInput, DatedItem } from '../artifactTypes';
import type { EvolutionCategory, EvolutionEvent, EvolutionSource, EvolutionTimeline } from './evolutionTypes';

/** Вік від дати БД, клемплений ≥0 (майбутня дата = «щойно»). */
const age = (date: string): number => Math.max(0, daysBetween(date));

function datedEvents(
  source: EvolutionSource,
  category: EvolutionCategory,
  items: readonly DatedItem[],
): EvolutionEvent[] {
  return items.map((item) => ({
    id: `${source}:${item.id}`,
    timestamp: item.date,
    ageDays: age(item.date),
    source,
    category,
    intensity: 1,
  }));
}

/**
 * Уся історія пари одним відсортованим таймлайном: минуле → сьогодні
 * (стабільні tie-break'и за id — додавання нових даних лише ДОДАЄ шар,
 * ніколи не перебудовує історію, §13).
 */
export function buildEvolutionTimeline(input: ArtifactInput): EvolutionTimeline {
  const events: EvolutionEvent[] = [];

  // Подорожі: перший візит у країну/місто — структурна подія Exploration.
  for (const p of input.countries) {
    events.push({
      id: `travel:country:${p.name}`,
      timestamp: p.firstVisit,
      ageDays: age(p.firstVisit),
      source: 'travel',
      category: 'exploration',
      intensity: 1,
      metadata: { kind: 'country', name: p.name },
    });
  }
  for (const p of input.cities) {
    events.push({
      id: `travel:city:${p.name}`,
      timestamp: p.firstVisit,
      ageDays: age(p.firstVisit),
      source: 'travel',
      category: 'exploration',
      intensity: 1,
      metadata: { kind: 'city', name: p.name },
    });
  }

  events.push(...datedEvents('memories', 'memory', input.memories));
  for (const m of input.milestones) {
    events.push({
      id: `milestones:${m.id}`,
      timestamp: m.date,
      ageDays: age(m.date),
      source: 'milestones',
      category: 'connection',
      intensity: 1,
      metadata: { title: m.title },
    });
  }
  events.push(...datedEvents('goals', 'connection', input.achievedGoals));
  events.push(...datedEvents('anniversaries', 'connection', input.anniversaries));
  events.push(...datedEvents('recipes', 'creation', input.recipes));
  events.push(...datedEvents('movies', 'creation', input.movies));
  events.push(...datedEvents('books', 'creation', input.books));
  for (const w of input.wishes) {
    events.push({
      id: `wishes:${w.id}`,
      timestamp: w.fulfilledAt,
      ageDays: age(w.fulfilledAt),
      source: 'wishes',
      category: 'future',
      intensity: 1,
    });
  }

  // Агрегатні факти «сьогодні»: історія без окремих дат — intensity несе
  // кількість/суму (100 фото ≠ 100 подій росту, це один великий тиск).
  if (input.usage.photos > 0) {
    events.push({
      id: 'photos:aggregate',
      timestamp: null,
      ageDays: 0,
      source: 'photos',
      category: 'memory',
      intensity: input.usage.photos,
    });
  }
  if (input.usage.totalSaved > 0) {
    events.push({
      id: 'finances:aggregate',
      timestamp: null,
      ageDays: 0,
      source: 'finances',
      category: 'foundation',
      intensity: input.usage.totalSaved,
    });
  }

  // Сам час — теж історія: фундаментальна подія «стосунки почались».
  if (input.usage.daysTogether > 0) {
    events.push({
      id: 'time:days-together',
      timestamp: null,
      ageDays: input.usage.daysTogether,
      source: 'time',
      category: 'foundation',
      intensity: input.usage.daysTogether,
    });
  }

  // Минуле → сьогодні; стабільний tie-break за id.
  events.sort((a, b) => b.ageDays - a.ageDays || a.id.localeCompare(b.id));
  return { events };
}
