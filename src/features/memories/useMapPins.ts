// ============================================================
// Мітки місць: запит `map_pins`.
// ------------------------------------------------------------
// Хук переїхав сюди з `features/map` разом із рештою карти (ADR-0039):
// окремого модуля «Наша карта» більше немає, а мітки — це вимір архіву
// спогадів. Читають його ще Плани (посилання плану на місце) і рушій
// Еволюції (кількість відвіданих місць живить кристал), тож ім'я й форма
// експортів лишились незмінними — переїзд не мав ставати міграцією.
//
// Мутацій тут більше немає (ADR-0263): `useMapPinMutations` не мав жодного
// споживача — мітки створює `useEnsurePlacePin` у `useMoments.ts`.
// ============================================================
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/queryKeys';
import type { MapPinRow } from '@/types';

async function fetchPins(): Promise<MapPinRow[]> {
  const { data, error } = await supabase
    .from('map_pins')
    .select('id,title,note,category,lat,lng,photo_url,rating,review,city,country,created_by,created_at,visited_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export function useMapPins() {
  return useQuery({ queryKey: qk.mapPins(), queryFn: fetchPins });
}
