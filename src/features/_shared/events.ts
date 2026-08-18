// ============================================================
// _shared/events — спільний доступ до подій (calendar + home + journey)
// ------------------------------------------------------------
// Один запит із ключем qk.events(): календар, головна й карта шляху ділять
// один кеш. Легасі-плани `type='other'` не повертаються, але справжня
// велика подія з `is_milestone=true` не повинна зникати лише через тип.
// ============================================================
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/queryKeys';
import type { EventRow } from '@/types';

export async function loadEvents(): Promise<EventRow[]> {
  const { data, error } = await supabase
    .from('events')
    .select('id,title,description,date,created_by,type,yearly,metadata,significance,is_milestone,person_user_id,star_color')
    // Звичайні `other` — залишки старої моделі планів. Виняток — рядок,
    // який явно позначили великою віхою: він належить історії пари.
    .or('type.neq.other,is_milestone.eq.true')
    .order('date', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export function useEvents() {
  return useQuery({ queryKey: qk.events(), queryFn: loadEvents });
}
