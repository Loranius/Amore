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
//
// А ЩЕ ВІН СВІЙ У КОЖНОГО ВИДУ — і це виправлення, знайдене числом
// (ADR-0188). Один ключ на весь портал здавався правильним, поки звітував
// один вид. Щойно риф під'єднали до каналу, перший же живий кадр показав
// над ним «435 нових митей» проти 328 у кристала того самого дня. Різниця
// рівно 107 — і це не приріст, а ІНШИЙ ЗНІМОК ПОРТАЛУ: риф читає джерела
// через `portalSources.ts`, який домішує «сказані» числа онбордингу
// (29+3, 29+15, 15+16 = 107 на цій парі), а конвеєр кристала їх не бачить.
//
// Спільний ключ перетворював цю різницю на «нові миті»: перехід на риф
// показав би 107 подій, яких пара не додавала. Ключ на вид робить перший
// візит на риф ПЕРШИМ візитом — тобто мовчанням, рівно як і задумано
// (`GrowthSummary.firstVisit`), а далі рахує вже справжній приріст.
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import { summariseGrowth, type GrowthEvent, type GrowthSummary } from './growthSinceLastVisit';
import type { HomeArtifact } from './homeArtifact';

/** Що пам'ятає кристал — ключ без суфікса, бо історія в ньому вже лежить. */
export const GROWTH_SEEN_STORAGE_KEY = 'amore:evolutionSeenEventIds';

/**
 * Де лежать бачені події цього виду.
 *
 * Кристал лишається на старому ключі НЕ як виняток, а тому, що ключ
 * містить саме його події: перейменувати означало б стерти парі пам'ять
 * про візити й показати їй одне зайве мовчання замість підпису.
 */
export function growthSeenStorageKey(species: HomeArtifact): string {
  return species === 'crystal'
    ? GROWTH_SEEN_STORAGE_KEY
    : `${GROWTH_SEEN_STORAGE_KEY}:${species}`;
}

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

function readSeen(key: string): ReadonlySet<string> | null {
  if (typeof window === 'undefined') return null;
  try {
    return parseSeenEventIds(window.localStorage.getItem(key));
  } catch {
    // Приватний режим або заблоковане сховище: приросту не буде, і це
    // краще за вигаданий.
    return null;
  }
}

function persistSeen(key: string, ids: readonly string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(ids));
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
  species: HomeArtifact,
): GrowthSummary | null {
  const key = growthSeenStorageKey(species);
  const [seen] = useState(() => readSeen(key));

  const summary = useMemo(
    () => (events === null ? null : summariseGrowth(events, seen)),
    [events, seen],
  );

  useEffect(() => {
    if (events === null) return undefined;
    const timer = window.setTimeout(() => {
      persistSeen(key, events.map((event) => event.id));
    }, GROWTH_SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [events, key]);

  return summary;
}
