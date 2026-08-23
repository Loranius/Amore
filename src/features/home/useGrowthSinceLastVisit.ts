// ============================================================
// Що виросло з минулого разу — пам'ять візитів.
// ------------------------------------------------------------
// Правила приросту лежать поруч, у `growthSinceLastVisit.ts`, і React про
// них не знає. Тут — рівно те, чого ті правила потребують ззовні: які
// ключі подій пара вже бачила і коли записати нові.
//
// Ключ сховища свій, окремий від `amore:clusterSeenKeys`. Той належить
// спалаху процедурного кластера й зберігає ключі ГІЛОК; цей зберігає
// ідентифікатори нормалізованих подій рушія. Спільний ключ означав би, що
// один механізм тихо гасить інший.
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import { summariseGrowth, type GrowthEvent, type GrowthSummary } from './growthSinceLastVisit';

export const GROWTH_SEEN_STORAGE_KEY = 'amore:evolutionSeenEventIds';

/**
 * Скільки підпис лишається чесним, перш ніж візит зарахується.
 *
 * Запис не миттєвий навмисно: сторінка встигає з'явитись, і пара встигає
 * прочитати рядок. Миттєвий запис зробив би підпис правдивим рівно до
 * першого перезавантаження — тобто інколи його не побачили б узагалі.
 */
export const GROWTH_SETTLE_MS = 2000;

/**
 * Розбір збереженого списку.
 *
 * `null` означає «цей портал ще не пам'ятає жодного візиту» — і саме він
 * вмикає перший візит у `summariseGrowth`. Зіпсований або чужий вміст теж
 * дає `null`: краще змовчати, ніж порахувати приростом усе підряд.
 */
export function parseSeenEventIds(raw: string | null): ReadonlySet<string> | null {
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return new Set(parsed.filter((item): item is string => typeof item === 'string'));
  } catch {
    return null;
  }
}

function readSeen(): ReadonlySet<string> | null {
  if (typeof window === 'undefined') return null;
  try {
    return parseSeenEventIds(window.localStorage.getItem(GROWTH_SEEN_STORAGE_KEY));
  } catch {
    // Приватний режим або заблоковане сховище: приросту не буде, і це
    // краще за вигаданий.
    return null;
  }
}

function persistSeen(ids: readonly string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(GROWTH_SEEN_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* сховище недоступне — наступного разу підпис просто не з'явиться */
  }
}

/**
 * Приріст із минулого візиту для поточного набору подій.
 *
 * `events === null` — конвеєр ще не зібрався; поки що казати нічого.
 *
 * Бачені ключі читаються РІВНО ОДИН РАЗ за монтування (`useState` з
 * ініціалізатором). Це і тримає підпис на екрані весь візит: запис нижче
 * оновлює сховище, але не те, з чим порівнюється цей рендер. Інакше рядок
 * зникав би сам через дві секунди після появи.
 */
export function useGrowthSinceLastVisit(
  events: readonly GrowthEvent[] | null,
): GrowthSummary | null {
  const [seen] = useState(readSeen);

  const summary = useMemo(
    () => (events === null ? null : summariseGrowth(events, seen)),
    [events, seen],
  );

  useEffect(() => {
    if (events === null) return undefined;
    const timer = window.setTimeout(() => {
      persistSeen(events.map((event) => event.id));
    }, GROWTH_SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [events]);

  return summary;
}
