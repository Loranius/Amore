// ============================================================
// Прогрів чанків розділів — щоб перехід доком не платив за завантаження.
// ------------------------------------------------------------
// **Виміряно на живому порталі.** Розділи вантажаться ліниво
// (`routes.tsx`), і до цього файлу жоден чанк не прогрівався ніколи. Тож
// КОЖЕН перший перехід у «Плани» чи «Вішліст» вибудовував три різні
// екрани поспіль:
//
//   1. `PageSkeleton` — три сірі блоки, поки їде чанк розділу;
//   2. власний скелет модуля (у вішлисті — сім ПОРОЖНІХ бульбашок);
//   3. справжній вміст.
//
// Три розкладки різної висоти одна за одною — це і є «ривок» і «порожні
// бульбашки, які з'являються й зникають». Перший крок прибирається саме
// тут: якщо чанк уже в пам'яті, `Suspense` не спрацьовує взагалі.
//
// Прогрів іде ПО ЧЕРЗІ й лише на дозвіллі. Паралельний `Promise.all`
// відібрав би смугу в того, що потрібно ЗАРАЗ — головна ще домальовує
// сцену, і чотири чанки навперейми зробили б гірше саме тому, заради чого
// прогрів існує.
// ============================================================

/**
 * Чи можна дозволити собі зайвий трафік.
 *
 * `saveData` — прямо висловлене прохання не витрачати трафік; поважати
 * його обов'язково. Повільний тип мережі — окрема причина: на 2G прогрів
 * не зекономить нічого, він лише забере смугу в поточного екрана.
 *
 * `navigator.connection` немає в Safari, і це нормально: без нього
 * вважаємо мережу звичайною, бо інакше прогрів не працював би на iOS
 * узагалі.
 */
export function prefetchAllowed(connection: unknown): boolean {
  if (typeof connection !== 'object' || connection === null) return true;
  const info = connection as { saveData?: unknown; effectiveType?: unknown };
  if (info.saveData === true) return false;
  const type = typeof info.effectiveType === 'string' ? info.effectiveType : '';
  return type !== 'slow-2g' && type !== '2g';
}

/**
 * Один прогрів на сесію.
 *
 * Прапорець ставиться, коли робота ПОЧАЛАСЬ, а не коли її заплановано, і
 * це не дрібниця. У `StrictMode` React навмисно монтує ефект двічі:
 * монтування → прибирання → монтування. При «поставив на плануванні»
 * виходило так: перший ефект планував прогрів і займав прапорець,
 * прибирання скасовувало заплановане, а другий ефект уже впирався в
 * зайнятий прапорець — і не гріло НІЧОГО. Виміряно живим екраном:
 * порожній список прогрітих чанків після дев'яти секунд на головній.
 */
let started = false;

/** Дозвілля з запасним шляхом: `requestIdleCallback` немає в Safari. */
function whenIdle(run: () => void): () => void {
  const idle = (window as typeof window & {
    requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number;
    cancelIdleCallback?: (handle: number) => void;
  });

  if (typeof idle.requestIdleCallback === 'function') {
    const handle = idle.requestIdleCallback(run, { timeout: 4000 });
    return () => idle.cancelIdleCallback?.(handle);
  }
  // 1200 мс — не «на око»: стільки на слабкому профілі триває вихід
  // головної на сталий кадр (сцена, текстури, приїзд камери). Раніше —
  // і прогрів конкурує саме з тим, що пара бачить.
  const timer = window.setTimeout(run, 1200);
  return () => window.clearTimeout(timer);
}

/**
 * Гріє чанки по черзі, поки не скінчаться або поки не скасують.
 *
 * Помилка прогріву НЕ є помилкою застосунку: не приїхав чанк — розділ
 * просто завантажиться при переході, як робив завжди. Тому `catch`
 * мовчазний за побудовою, а не за недоглядом.
 */
export function prefetchRouteChunks(
  chunks: readonly (() => Promise<unknown>)[],
  connection: unknown = (navigator as { connection?: unknown }).connection,
): () => void {
  if (started || !prefetchAllowed(connection)) return () => {};

  let cancelled = false;
  const cancelIdle = whenIdle(() => {
    if (cancelled || started) return;
    started = true;
    void (async () => {
      for (const load of chunks) {
        if (cancelled) return;
        try {
          await load();
        } catch {
          // Чанк не приїхав — розділ довантажиться при переході.
          return;
        }
      }
    })();
  });

  return () => {
    cancelled = true;
    cancelIdle();
  };
}

/** Лише для тестів: прогрів «на сесію» інакше не перевіриш двічі. */
export function resetRoutePrefetchForTests(): void {
  started = false;
}
