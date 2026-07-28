// ============================================================
// _shared/events — спільний доступ до подій (calendar + home)
// ------------------------------------------------------------
// Один запит із ключем qk.events(): і календар, і головна ділять
// один кеш (як старий кеш-ключ 'events').
//
// `type='other'` СВІДОМО не вибирається. Такі рядки були планами, поки
// плани жили вкладкою календаря; тепер вони мають власну таблицю
// `plans`, а тут лишились ЛИШЕ як страховка на випадок відкату
// міграції. Читати їх звідси означало б показувати кожен план двічі:
// один раз як план, другий — як подію без типу.
// ============================================================
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/queryKeys';
import type { EventRow } from '@/types';

export async function loadEvents(): Promise<EventRow[]> {
  const { data, error } = await supabase
    .from('events')
    .select('id,title,description,date,created_by,type,yearly,metadata,is_milestone,person_user_id')
    .neq('type', 'other')
    .order('date', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export function useEvents() {
  return useQuery({ queryKey: qk.events(), queryFn: loadEvents });
}
