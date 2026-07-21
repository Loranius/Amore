// ============================================================
// useMapPins — піни карти (порт fetchPins/savePin/... даних)
// ------------------------------------------------------------
// Запит map_pins + мутації. Фото: HEIC-normalize + compress → Storage.
// Місто дотягується reverse-геокодом при збереженні; для старих пінів
// без city — лінивий бекфіл.
// ============================================================
import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, publicUrl } from '@/lib/supabase';
import { qk } from '@/lib/queryKeys';
import { compress, normalize } from '@/lib/images';
import { reverseGeocode } from '@/lib/mapbox';
import { useToast } from '@/providers/ToastProvider';
import { useCurrentUser } from '@/providers/AuthProvider';
import type { MapPinRow, PinCategory, InsertRow } from '@/types';

const BUCKET = 'map-photos';

async function fetchPins(): Promise<MapPinRow[]> {
  const { data, error } = await supabase
    .from('map_pins')
    .select('id,title,note,category,lat,lng,photo_url,rating,review,city,created_by,created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export function useMapPins() {
  return useQuery({ queryKey: qk.mapPins(), queryFn: fetchPins });
}

/** Фото піна: HEIC → compress → Storage. Повертає URL або null. */
export async function uploadPinPhoto(file: File, pinId: number): Promise<string | null> {
  let normalized: File;
  try {
    normalized = await normalize(file);
  } catch (e) {
    console.error('uploadPinPhoto HEIC:', e);
    return null;
  }
  let blob: Blob = normalized;
  let ext = (normalized.name.split('.').pop() || 'jpg').toLowerCase();
  let contentType = normalized.type;
  try {
    const out = await compress(normalized, 1080, 0.75);
    blob = out.blob;
    ext = out.ext;
    contentType = out.contentType;
  } catch (e) {
    console.warn('uploadPinPhoto compress:', e);
  }
  const path = `pin-${pinId}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { upsert: true, contentType });
  if (error) {
    console.error('uploadPinPhoto:', error);
    return null;
  }
  return publicUrl(BUCKET, path);
}

export interface PinUpdate {
  title: string;
  review: string | null;
  rating: number | null;
  photo_url?: string;
}

export function useMapPinMutations() {
  const client = useQueryClient();
  const user = useCurrentUser();
  const toast = useToast();
  const invalidate = () => void client.invalidateQueries({ queryKey: qk.mapPins() });

  // Створення піна: reverse-geocode міста → insert → повертає новий рядок.
  const add = useMutation({
    mutationFn: async (v: {
      lat: number;
      lng: number;
      category: PinCategory;
      title: string;
      note: string | null;
      file: File | null;
    }): Promise<MapPinRow | null> => {
      const geo = await reverseGeocode(v.lat, v.lng);
      const row: InsertRow<'map_pins'> = {
        title: v.title,
        note: v.note,
        category: v.category,
        lat: v.lat,
        lng: v.lng,
        city: geo.city || null,
        created_by: user.id,
      };
      const { data, error } = await supabase.from('map_pins').insert(row).select('id').single();
      if (error || !data) throw error ?? new Error('insert failed');

      if (v.file) {
        const url = await uploadPinPhoto(v.file, data.id);
        if (url) await supabase.from('map_pins').update({ photo_url: url }).eq('id', data.id);
      }
      const { data: fresh } = await supabase
        .from('map_pins')
        .select('id,title,note,category,lat,lng,photo_url,rating,review,city,created_by,created_at')
        .eq('id', data.id)
        .single();
      return fresh ?? null;
    },
    onSuccess: invalidate,
    onError: () => toast.show('Помилка збереження місця'),
  });

  const update = useMutation({
    mutationFn: async (v: { id: number; patch: PinUpdate }) => {
      const { error } = await supabase.from('map_pins').update(v.patch).eq('id', v.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => toast.show('Помилка збереження'),
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('map_pins').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => toast.show('Помилка видалення'),
  });

  return { add, update, remove };
}

/** Лінивий бекфіл міста для пінів, збережених без city. */
export function useCityBackfill(pins: MapPinRow[]) {
  const client = useQueryClient();
  const running = useRef(false);

  useEffect(() => {
    const todo = pins.filter((p) => !p.city);
    if (!todo.length || running.current) return;
    running.current = true;
    let cancelled = false;

    (async () => {
      for (const pin of todo) {
        if (cancelled) break;
        const geo = await reverseGeocode(pin.lat, pin.lng);
        if (geo.city) await supabase.from('map_pins').update({ city: geo.city }).eq('id', pin.id);
        await new Promise((r) => setTimeout(r, 300)); // не спамимо геокодер
      }
      if (!cancelled) void client.invalidateQueries({ queryKey: qk.mapPins() });
      running.current = false;
    })();

    return () => {
      cancelled = true;
      running.current = false;
    };
    // Лише коли змінюється множина «без міста».
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins.map((p) => (p.city ? '' : p.id)).join(',')]);
}
