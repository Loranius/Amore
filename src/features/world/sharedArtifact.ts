import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/queryKeys';
import { HOME_ARTIFACT_STORAGE_KEY, parseHomeArtifact } from '@/features/home/homeArtifact';
import type { HomeArtifact } from '@/features/home/homeArtifact';

// ============================================================
// Вид артефакта — вибір ПАРИ, а не пристрою (ADR-0209 §17).
// ------------------------------------------------------------
// ADR-0081 лишив його в `localStorage` і назвав це межею дослівно:
// «вибір, перенесений у settings, став би спільним — а чи цього хоче
// пара, вирішує власник». Власник вирішив (2026-09-26): спільний.
//
// До цього один партнер міг обрати дерево, а другий на своєму телефоні
// й далі бачив кристал — тобто «наш артефакт» був у кожного свій.
//
// ЧОМУ localStorage НЕ ВИДАЛЕНО, А СТАВ КЕШЕМ. Запит до `settings`
// асинхронний, а сцена малюється одразу. Без місцевого значення перший
// кадр показував би типовий кристал і ПЕРЕМИКАВСЯ б на дерево за пів
// секунди — стрибок на кожному відкритті порталу. Те саме рішення й з
// тієї ж причини вже стоїть у `useStartDate` (`useHome.ts`).
//
// ЧОМУ «ОСТАННІЙ ВИБІР ПЕРЕМАГАЄ». Обоє можуть обрати одночасно, і
// зливати два вибори в один нема з чого: вид не складається з половинок,
// як колір (ADR-0151). Інший варіант — блокувати другого, — означав би
// пояснювати парі, чому її портал їй відмовляє.
// ============================================================

/** Ключ у `settings`. Поруч із `relationship_start_date`. */
export const SHARED_ARTIFACT_KEY = 'home_artifact';

function cached(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(HOME_ARTIFACT_STORAGE_KEY);
  } catch {
    return null;
  }
}

function cache(artifact: HomeArtifact): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(HOME_ARTIFACT_STORAGE_KEY, artifact);
  } catch {
    // Приватний режим або заборонене сховище — кеш просто не працює.
  }
}

export const sharedArtifactKey = [...qk.settings(), SHARED_ARTIFACT_KEY] as const;

/**
 * Що обрала пара, або `null`, поки невідомо.
 *
 * `null` тут ЗНАЧУЩИЙ і не дорівнює «кристал»: доки відповідь не
 * приїхала, показувати треба місцевий кеш, а не типове значення.
 */
export function useSharedArtifact() {
  return useQuery({
    queryKey: sharedArtifactKey,
    staleTime: 60 * 60_000,
    queryFn: async (): Promise<HomeArtifact | null> => {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', SHARED_ARTIFACT_KEY)
        .maybeSingle();
      if (error) throw error;
      const parsed = parseHomeArtifact(typeof data?.value === 'string' ? data.value : null);
      if (parsed !== null) cache(parsed);
      return parsed;
    },
  });
}

/** Місцевий кеш — для першого кадру, доки запит іде. */
export function cachedArtifact(): string | null {
  return cached();
}

/**
 * Записати вибір пари.
 *
 * Кеш оновлюється ПЕРШИМ і незалежно від мережі: сцена мусить
 * перемкнутись від дотику, а не від відповіді сервера. Помилка запису
 * не ковтається — вона повертається, щоб той, хто кликав, міг сказати
 * про неї вголос.
 */
export function useSaveSharedArtifact() {
  const client = useQueryClient();
  return useCallback(async (artifact: HomeArtifact): Promise<{ ok: boolean }> => {
    cache(artifact);
    client.setQueryData(sharedArtifactKey, artifact);
    const { error } = await supabase
      .from('settings')
      .upsert({ key: SHARED_ARTIFACT_KEY, value: artifact }, { onConflict: 'key' });
    if (error) {
      console.error('shared artifact save failed:', error);
      return { ok: false };
    }
    return { ok: true };
  }, [client]);
}
