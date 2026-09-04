// ============================================================
// useNotificationPrefs — «тиша у вихідний»
// ------------------------------------------------------------
// Одне налаштування, одна людина: коли ввімкнене, у день, позначений у
// «Графіку» як вихідний ('Х'), сповіщення не створюються взагалі.
//
// ЗБЕРІГАЄТЬСЯ НА СЕРВЕРІ, а не в localStorage, і причина не в зручності:
// правило виконує база (тригер на `app_notifications`), тож вона мусить
// його бачити. Налаштування, яке знає лише браузер, не спинило б жодного
// сповіщення — воно спинило б лише його показ, а показувати тут поки що
// нема кому.
//
// Відсутній рядок — це «за замовчуванням», тобто сповіщення приходять.
// ============================================================
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/queryKeys';
import { useToast } from '@/providers/ToastProvider';
import type { UserNotificationPrefsRow } from '@/types';

export function useNotificationPrefs(userId: number | undefined) {
  return useQuery({
    queryKey: qk.notificationPrefs(userId ?? 0),
    enabled: userId !== undefined,
    queryFn: async (): Promise<UserNotificationPrefsRow | null> => {
      const { data, error } = await supabase
        .from('user_notification_prefs')
        .select('*')
        .eq('user_id', userId!)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });
}

export function useSaveNotificationPrefs() {
  const client = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: async (input: { userId: number; quietOnDaysOff: boolean }): Promise<void> => {
      const { error } = await supabase
        .from('user_notification_prefs')
        .upsert(
          { user_id: input.userId, quiet_on_days_off: input.quietOnDaysOff },
          { onConflict: 'user_id' },
        );
      if (error) throw error;
    },
    onSuccess: (_data, input) =>
      void client.invalidateQueries({ queryKey: qk.notificationPrefs(input.userId) }),
    onError: () => toast.show('Не вдалося зберегти налаштування сповіщень'),
  });
}
