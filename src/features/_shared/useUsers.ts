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
import { parseProfile, toPerson, type Person, type UserProfile } from '@/features/profile/profileModel';
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

/**
 * Профілі всіх людей: підпис і фото.
 *
 * Лежать у `settings` рядками `profile:<id>`, бо `users` клієнтові
 * відкрита лише на читання — див. `profileModel.ts`.
 */
export function useProfiles() {
  return useQuery({
    queryKey: [...qk.settings(), 'profiles'],
    /*
     * П'ять хвилин, а не `Infinity` як у `useUsers`, і не нуль.
     *
     * `usePeople()` тепер сидить на шести екранах, тож без `staleTime`
     * цей запит ішов би на кожен їх монтаж і на кожне повернення у вкладку
     * — заради рядка, який міняється кілька разів за життя порталу.
     * `Infinity` теж не годиться: профіль МОЖНА змінити зсередини сесії,
     * і хоч збереження інвалідує ключ саме, партнерова зміна інакше
     * доїхала б аж до перезавантаження.
     */
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Record<number, UserProfile>> => {
      const { data, error } = await supabase
        .from('settings')
        .select('key, value')
        .like('key', 'profile:%');
      if (error) throw error;
      const map: Record<number, UserProfile> = {};
      for (const row of data ?? []) {
        const id = Number.parseInt(String(row.key).slice('profile:'.length), 10);
        if (!Number.isFinite(id)) continue;
        map[id] = parseProfile(row.value);
      }
      return map;
    },
  });
}

/**
 * Дні народження — із ПОДІЙ, а не з профілю.
 *
 * У порталі вже є одне місце, де живуть дати, і календар із «Планами»
 * показують його самі. Копія в профілі розійшлася б із подією того дня,
 * коли хтось поправить одну.
 */
export function useBirthdays() {
  return useQuery({
    queryKey: [...qk.events(), 'birthdays'],
    staleTime: 5 * 60_000, // та сама причина, що й у `useProfiles`
    queryFn: async (): Promise<Record<number, string>> => {
      const { data, error } = await supabase
        .from('events')
        .select('date, person_user_id')
        .eq('type', 'birthday')
        .not('person_user_id', 'is', null);
      if (error) throw error;
      const map: Record<number, string> = {};
      for (const row of data ?? []) {
        if (typeof row.person_user_id === 'number' && typeof row.date === 'string') {
          map[row.person_user_id] = row.date;
        }
      }
      return map;
    },
  });
}

/** Люди порталу: ключ, підпис, фото, дата народження. */
export function usePeople(): Person[] {
  const { data: users } = useUsers();
  const { data: profiles } = useProfiles();
  const { data: birthdays } = useBirthdays();
  return useMemo(
    () => (users ?? []).map((user) => toPerson(user, profiles?.[user.id], birthdays?.[user.id] ?? null)),
    [users, profiles, birthdays],
  );
}

/** Людина за ідентифікатором — або `null`, поки список не приїхав. */
export function usePerson(userId: number): Person | null {
  const people = usePeople();
  return people.find((one) => one.id === userId) ?? null;
}

/**
 * id → ПІДПИС. Зручно для авторів («від Діма»).
 *
 * Саме підпис, а не ім'я-ключ: усі споживачі цієї мапи показують ім'я, а
 * не розрізняють за ним.
 */
export function useUsersMap(): Record<number, string> {
  const people = usePeople();
  const map: Record<number, string> = {};
  people.forEach((one) => {
    map[one.id] = one.displayName;
  });
  return map;
}

/** Я — з підписом, фото й датою народження, а не лише з ключем. */
export function useMePerson(): Person {
  const me = useCurrentUser();
  const people = usePeople();
  return people.find((one) => one.id === me.id) ?? toPerson(me, undefined, null);
}

/**
 * Партнер = інший користувач у поточній парі.
 * Повертаємо також стан запиту, щоб UI не показував вигаданий fallback,
 * поки справжнє ім'я ще завантажується.
 *
 * Тип — `Person`, а не `AppUser`: він РОЗШИРЮЄ AppUser, тож усе, що
 * розрізняло людей за ключем, працює далі, а екранам стає доступний
 * підпис. Стан запиту береться з `users`: підпис і дата догружаються
 * окремо й до появи падають на ім'я-ключ, тобто екран ніколи не чекає
 * на них порожнім.
 */
export function usePartnerQuery() {
  const me = useCurrentUser();
  const query = useUsers();
  const people = usePeople();
  const partner = useMemo(
    () => people.find((one) => one.id !== me.id) ?? null,
    [people, me.id],
  );

  return { ...query, partner };
}

/** Партнер без метаданих запиту — для форм, де loading уже оброблено вище. */
export function usePartner(): Person | null {
  return usePartnerQuery().partner;
}
