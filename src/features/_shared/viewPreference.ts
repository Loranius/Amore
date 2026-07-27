// ============================================================
// viewPreference — один механізм «яким виглядом показувати список»
// ------------------------------------------------------------
// До цього таких механізмів було ДВА, обидва у вішлисті й майже
// однакові: `useWishlistViewPreference` (дошка: me/partner/shared) і
// `wishlistArchiveView` (архів: personal/shared). Обидва читали JSON-мапу
// з localStorage, нормалізували значення й дописували назад — різнились
// лише ключем, назвами областей і дефолтом.
//
// «Спогади» стали б третім. Проєкт уже платив за такий шлях: скло
// бульбашок розповзлось на десять CSS-файлів, де `PearlContrast` існував
// тільки щоб скасувати `PearlRim`. Тому механізм тут один, а модулі
// приносять свою конфігурацію.
//
// Область (scope) — це вкладка чи розділ, у якого власна пам'ять вибору:
// у вішлисті користувач може хотіти бульбашки в себе й стрічку в партнера.
// ============================================================
import { useCallback, useState } from 'react';

/** Мінімум від localStorage, який нам потрібен — щоб тести не тягли DOM. */
export interface ViewPreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface ViewPreferenceConfig<Mode extends string> {
  /** Ключ у localStorage. Версію в назві лишаємо: 'amore:…:v1'. */
  storageKey: string;
  /** Дозволені вигляди. Усе поза списком ігнорується при читанні. */
  modes: readonly Mode[];
  /** Вигляд за замовчуванням, якщо збереженого немає або він зіпсований. */
  fallback: Mode;
  /** Перейменовані вигляди: старе значення → поточне ('table' → 'feed'). */
  aliases?: Readonly<Record<string, Mode>>;
}

function browserStorage(): ViewPreferenceStorage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    // Доступ до сховища кидає в приватному режимі деяких браузерів.
    return null;
  }
}

/** Значення зі сховища → валідний вигляд або null. */
export function normalizeView<Mode extends string>(
  config: ViewPreferenceConfig<Mode>,
  value: unknown,
): Mode | null {
  if (typeof value !== 'string') return null;
  const aliased = config.aliases?.[value];
  if (aliased !== undefined) return aliased;
  return (config.modes as readonly string[]).includes(value) ? (value as Mode) : null;
}

/**
 * Усі збережені вибори. Зіпсований JSON і невідомі вигляди не валять
 * читання: користувач має побачити дефолт, а не порожній екран.
 */
export function readViewPreferences<Mode extends string, Scope extends string>(
  config: ViewPreferenceConfig<Mode>,
  storage: ViewPreferenceStorage | null = browserStorage(),
): Partial<Record<Scope, Mode>> {
  if (!storage) return {};
  try {
    const raw = storage.getItem(config.storageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Partial<Record<Scope, Mode>> = {};
    for (const [scope, value] of Object.entries(parsed)) {
      const mode = normalizeView(config, value);
      if (mode) out[scope as Scope] = mode;
    }
    return out;
  } catch {
    return {};
  }
}

/** Вибір однієї області, з дефолтом. */
export function readViewPreference<Mode extends string, Scope extends string>(
  config: ViewPreferenceConfig<Mode>,
  scope: Scope,
  storage: ViewPreferenceStorage | null = browserStorage(),
): Mode {
  return readViewPreferences<Mode, Scope>(config, storage)[scope] ?? config.fallback;
}

/** Запис однієї області без затирання решти. */
export function writeViewPreference<Mode extends string, Scope extends string>(
  config: ViewPreferenceConfig<Mode>,
  scope: Scope,
  view: Mode,
  storage: ViewPreferenceStorage | null = browserStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(
      config.storageKey,
      JSON.stringify({ ...readViewPreferences<Mode, Scope>(config, storage), [scope]: view }),
    );
  } catch {
    // Сховище недоступне — вибір усе одно діє до кінця сесії (стан у хуку).
  }
}

/**
 * Вибір вигляду для однієї області.
 *
 * Стан тримається в пам'яті, а сховище — лише його дзеркало: коли
 * localStorage недоступний, перемикач усе одно працює, просто не
 * переживає перезавантаження.
 */
export function useViewPreference<Mode extends string, Scope extends string>(
  config: ViewPreferenceConfig<Mode>,
  scope: Scope,
): readonly [Mode, (view: Mode) => void] {
  const [preferences, setPreferences] = useState<Partial<Record<Scope, Mode>>>(
    () => readViewPreferences<Mode, Scope>(config),
  );

  const setView = useCallback((view: Mode) => {
    setPreferences((current) => (current[scope] === view ? current : { ...current, [scope]: view }));
    writeViewPreference<Mode, Scope>(config, scope, view);
    // config — літерал модуля, стабільний між рендерами; у залежності його
    // не беремо, інакше setView перестворювався б щоразу.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  return [preferences[scope] ?? config.fallback, setView] as const;
}
