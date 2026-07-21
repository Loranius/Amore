// ============================================================
// useMemories — усі фото дня (photo_calendar) для «Кристал → Спогад».
// ------------------------------------------------------------
// На відміну від usePhotoCalendar (місячна вибірка для календаря),
// тут потрібен весь пул одразу — модалка вибирає з нього випадковий
// запис. Таблиця невелика (фото дня, не кожен день), тож один запит
// без пагінації.
// ============================================================
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/queryKeys';
import type { PhotoCalendarRow } from '@/types';

export function useMemories() {
  return useQuery({
    queryKey: qk.photoCalendarAll(),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<PhotoCalendarRow[]> => {
      const { data, error } = await supabase
        .from('photo_calendar')
        .select('id,date,user_id,photo_url,comment')
        .order('date', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}
