// ============================================================
// useUsers — спільний список користувачів (id, name)
// ------------------------------------------------------------
// Заміна Auth.getUsers() + локальних usersMap у модулях. Майже
// статичний довідник → великий staleTime. Ім'я валідується guard'ом.
// ============================================================
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/queryKeys';
import { toAppUser } from '@/lib/guards';
import { useCurrentUser } from '@/providers/AuthProvider';
import type { AppUser } from '@/types';

export function useUsers() {
  return useQuery({
    queryKey: qk.users(),
    staleTime: Infinity, // імена не змінюються протягом сесії
    queryFn: async (): Promise<AppUser[]> => {
      const { data, error } = await supabase
        .from('users')
        .select('id, name')
        .order('id', { ascending: true });
      if (error) throw error;
      return (data ?? []).map(toAppUser).filter((u): u is AppUser => u !== null);
    },
  });
}

/** id → ім'я. Зручно для підпису авторів (напр. «від Діма»). */
export function useUsersMap(): Record<number, string> {
  const { data } = useUsers();
  const map: Record<number, string> = {};
  (data ?? []).forEach((u) => {
    map[u.id] = u.name;
  });
  return map;
}

/**
 * Партнер = інший користувач у поточній парі.
 * Повертаємо також стан запиту, щоб UI не показував вигаданий fallback,
 * поки справжнє ім'я ще завантажується.
 */
export function usePartnerQuery() {
  const me = useCurrentUser();
  const query = useUsers();
  const partner = useMemo(
    () => (query.data ?? []).find((u) => u.id !== me.id) ?? null,
    [query.data, me.id],
  );

  return { ...query, partner };
}

/** Партнер без метаданих запиту — для форм, де loading уже оброблено вище. */
export function usePartner(): AppUser | null {
  return usePartnerQuery().partner;
}
