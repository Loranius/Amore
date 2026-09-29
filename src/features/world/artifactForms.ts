import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { CRYSTAL_FORMS, type CrystalForm } from '@/engine/species/crystalV2/geometry';
import { TREE_FORMS, type TreeForm } from '@/engine/species/treeV2/geometry';
import { qk } from '@/lib/queryKeys';

// ============================================================
// Форма виду — вибір пари в налаштуваннях (ADR-0237 §7, п. 1).
// ------------------------------------------------------------
// Власник: «вигляд можна буде змінити в налаштуваннях вже зареєстрованої
// пари, при реєстрації — лише вигляд вже сталих об'єктів». Тому форма
// живе поруч із видом (`home_artifact`) у спільних налаштуваннях пари:
// той самий ключ-значення, та сама політика «останній вибір перемагає» й
// той самий місцевий кеш для першого кадру (див. `sharedArtifact.ts`).
//
// Форма — лише малюнок: модель росту й таблиця модулів однакові, тож
// перемикання нічого в історії пари не змінює.
// ============================================================

export const ARTIFACT_FORMS_KEY = 'artifact_forms';
export const ARTIFACT_FORMS_STORAGE_KEY = 'amore:artifact-forms';

export interface ArtifactForms {
  crystal: CrystalForm;
  tree: TreeForm;
}

export const DEFAULT_ARTIFACT_FORMS: ArtifactForms = { crystal: 'druse', tree: 'oak' };

/** Розбір збереженого значення: будь-що невідоме — форма за замовчуванням. */
export function parseArtifactForms(value: unknown): ArtifactForms {
  let raw: unknown = value;
  if (typeof value === 'string') {
    try {
      raw = JSON.parse(value);
    } catch {
      return DEFAULT_ARTIFACT_FORMS;
    }
  }
  if (raw === null || typeof raw !== 'object') return DEFAULT_ARTIFACT_FORMS;
  const record = raw as Record<string, unknown>;
  return {
    crystal: CRYSTAL_FORMS.includes(record.crystal as CrystalForm) ? (record.crystal as CrystalForm) : DEFAULT_ARTIFACT_FORMS.crystal,
    tree: TREE_FORMS.includes(record.tree as TreeForm) ? (record.tree as TreeForm) : DEFAULT_ARTIFACT_FORMS.tree,
  };
}

function cached(): ArtifactForms {
  if (typeof window === 'undefined') return DEFAULT_ARTIFACT_FORMS;
  try {
    return parseArtifactForms(window.localStorage.getItem(ARTIFACT_FORMS_STORAGE_KEY));
  } catch {
    return DEFAULT_ARTIFACT_FORMS;
  }
}

function cache(forms: ArtifactForms): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ARTIFACT_FORMS_STORAGE_KEY, JSON.stringify(forms));
  } catch {
    // Приватний режим або заборонене сховище — кеш просто не працює.
  }
}

export const artifactFormsKey = [...qk.settings(), ARTIFACT_FORMS_KEY] as const;

/** Форми пари; поки запит іде — місцевий кеш, а без нього — форми за замовчуванням. */
export function useArtifactForms(): ArtifactForms {
  const query = useQuery({
    queryKey: artifactFormsKey,
    staleTime: 60 * 60_000,
    queryFn: async (): Promise<ArtifactForms> => {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', ARTIFACT_FORMS_KEY)
        .maybeSingle();
      if (error) throw error;
      const forms = parseArtifactForms(data?.value ?? null);
      cache(forms);
      return forms;
    },
  });
  return query.data ?? cached();
}

/**
 * Записати форму одного виду. Кеш і сцена оновлюються одразу; помилка
 * запису не ковтається — вона повертається, щоб екран сказав про неї.
 */
export function useSaveArtifactForm() {
  const client = useQueryClient();
  return useCallback(async <K extends keyof ArtifactForms>(species: K, form: ArtifactForms[K]): Promise<{ ok: boolean }> => {
    const next = { ...(client.getQueryData<ArtifactForms>(artifactFormsKey) ?? cached()), [species]: form };
    cache(next);
    client.setQueryData(artifactFormsKey, next);
    const { error } = await supabase
      .from('settings')
      .upsert({ key: ARTIFACT_FORMS_KEY, value: JSON.stringify(next) }, { onConflict: 'couple_id,key' });
    if (error) {
      console.error('artifact form save failed:', error);
      return { ok: false };
    }
    return { ok: true };
  }, [client]);
}
