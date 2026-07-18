// ============================================================
// useLocations — геолокація партнерів (порт checkin/locations)
// ------------------------------------------------------------
// «Я тут» → upsert user_locations + запис у location_history.
// Маркери партнерів + архів за 24 год.
// ============================================================
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/queryKeys';
import { reverseGeocode } from '@/lib/mapbox';
import { useToast } from '@/providers/ToastProvider';
import { useCurrentUser } from '@/providers/AuthProvider';
import type { UserLocationRow, LocationHistoryRow } from '@/types';

export function useUserLocations() {
  return useQuery({
    queryKey: qk.userLocations(),
    queryFn: async (): Promise<UserLocationRow[]> => {
      const { data, error } = await supabase
        .from('user_locations')
        .select('user_id,lat,lng,updated_at');
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Отримати позицію браузера як Promise. */
function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Геолокація не підтримується браузером'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10_000,
    });
  });
}

export function useCheckin() {
  const client = useQueryClient();
  const me = useCurrentUser();
  const toast = useToast();

  return useMutation({
    mutationFn: async (): Promise<{ lat: number; lng: number }> => {
      const pos = await getPosition();
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const now = new Date().toISOString();
      const geo = await reverseGeocode(lat, lng);

      const { error } = await supabase
        .from('user_locations')
        .upsert({ user_id: me.id, lat, lng, updated_at: now }, { onConflict: 'user_id' });
      if (error) throw error;

      await supabase.from('location_history').insert({
        user_id: me.id,
        lat,
        lng,
        address: geo.address,
        city: geo.city,
        created_at: now,
      });
      return { lat, lng };
    },
    onSuccess: () => void client.invalidateQueries({ queryKey: qk.userLocations() }),
    onError: (e) => {
      const err = e as GeolocationPositionError | Error;
      const denied = 'code' in err && err.code === 1;
      toast.show(
        denied
          ? 'Дозвіл на геолокацію відхилено. Надай доступ у налаштуваннях.'
          : 'Не вдалось отримати геолокацію. Спробуй ще.',
      );
    },
  });
}

/** Архів місцезнаходжень за останні 24 год (чистить старіші). */
export function useLocationHistory(enabled: boolean) {
  return useQuery({
    queryKey: ['locationHistory'],
    enabled,
    queryFn: async (): Promise<LocationHistoryRow[]> => {
      const cutoff = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
      await supabase.from('location_history').delete().lt('created_at', cutoff);
      const { data, error } = await supabase
        .from('location_history')
        .select('user_id,lat,lng,address,city,created_at')
        .gte('created_at', cutoff)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
}
