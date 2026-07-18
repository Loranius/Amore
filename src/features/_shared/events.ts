// ============================================================
// _shared/events — спільний доступ до подій (calendar + home)
// ------------------------------------------------------------
// Один запит із ключем qk.events(): і календар, і головна ділять
// один кеш (як старий кеш-ключ 'events'). planMetadataOf дає
// типізовану metadata плану (валідне або дефолт) — без regex-тегів.
// ============================================================
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/queryKeys';
import { isPlanMetadata } from '@/lib/guards';
import type { EventRow, PlanMetadata } from '@/types';

export async function loadEvents(): Promise<EventRow[]> {
  const { data, error } = await supabase
    .from('events')
    .select('id,title,description,date,created_by,type,yearly,metadata')
    .order('date', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export function useEvents() {
  return useQuery({ queryKey: qk.events(), queryFn: loadEvents });
}

const DEFAULT_METADATA: PlanMetadata = { cat: 'other', status: 'planned', done_at: null };

/** Безпечно дістає metadata плану (валідне або дефолт). */
export function planMetadataOf(ev: EventRow): PlanMetadata {
  return isPlanMetadata(ev.metadata) ? ev.metadata : DEFAULT_METADATA;
}
