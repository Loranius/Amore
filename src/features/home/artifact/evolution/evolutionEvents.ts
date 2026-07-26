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

  // Фото. Рівно ОДНА з двох форм, ніколи обидві — інакше historyAt рахував
  // би їх двічі:
  //   • є дати (Storage віддав created_at) → по події на фото, кожна зі
  //     своїм віком. Тільки так рахунок фото стає історичним, а отже може
  //     впливати на форму, не зрушуючи вже відкладені тіла;
  //   • дат немає → колишній недатований агрегат: intensity несе кількість
  //     (100 фото ≠ 100 подій росту, це один великий тиск). Тиски матеріалу
  //     від цього не змінюються — на віці 0 обидві форми дають те саме
  //     число, — але історії в такого рахунку немає, і констрейнти його не
  //     читають (crystalConstraints.ts).
  // Окремими тілами фото не стають у жодному разі: Growth Engine бере
  // стріми з growthEvents.ts, а не з таймлайна Evolution.
  const datedPhotos = input.photos ?? [];
  if (datedPhotos.length > 0) {
    for (const p of datedPhotos) {
      events.push({
        id: `photos:${p.id}`,
        timestamp: p.date,
        ageDays: age(p.date),
        source: 'photos',
        category: 'memory',
        intensity: 1,
      });
    }
  } else if (input.usage.photos > 0) {
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
