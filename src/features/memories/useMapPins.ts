// ============================================================
// Мітки місць: запит `map_pins` і мутації над ними.
// ------------------------------------------------------------
// Хук переїхав сюди з `features/map` разом із рештою карти (ADR-0039):
// окремого модуля «Наша карта» більше немає, а мітки — це вимір архіву
// спогадів. Читають його ще Плани (посилання плану на місце) і рушій
// Еволюції (кількість відвіданих місць живить кристал), тож ім'я й форма
// експортів лишились незмінними — переїзд не мав ставати міграцією.
//
// Фото: HEIC-normalize + compress → Storage. Місто дотягується зворотним
// геокодом при збереженні; для старих міток без `city` — лінивий бекфіл.
// ============================================================
import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, publicUrl } from '@/lib/supabase';
import { qk } from '@/lib/queryKeys';
import { compress } from '@/lib/images';
import { reverseGeocode } from '@/lib/geo';
import { useToast } from '@/providers/ToastProvider';
import { useCurrentUser } from '@/providers/AuthProvider';
import type { MapPinRow, PinCategory, InsertRow } from '@/types';

const BUCKET = 'map-photos';

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

/**
 * Фото піна: HEIC → compress → Storage. Повертає URL або КИДАЄ.
 *
 * Тут було три проковтнуті помилки поспіль: невдала конвертація HEIC —
 * `console.error` і `null`; невдале стиснення — `console.warn` і
 * ОРИГІНАЛ у сховище; невдале завантаження — знову `console.error` і
 * `null`. Викликач бачив `null` і просто йшов далі, тож мітка зберігалась
 * без фото, а пара не дізнавалась ані що фото не долетіло, ані чому.
 *
 * `null` як «щось пішло не так» не розрізняє причин і не лишає слідів.
 * Тепер функція або віддає адресу, або кидає, а викликач вирішує, що з
 * цим робити, — і в нього є що сказати парі.
 *
 * `normalize` тут більше немає: `compress` кличе його сам першим рядком.
 */
export async function uploadPinPhoto(file: File, pinId: number): Promise<string> {
  const { blob, ext, contentType } = await compress(file, 1080, 0.75);
  const path = `pin-${pinId}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { upsert: true, contentType });
  if (error) throw error;
  return publicUrl(BUCKET, path);
}

export interface PinUpdate {
  title: string;
  review: string | null;
  /** Нотатка, яку писали при створенні мітки. Донедавна її не можна було
   *  ні побачити, ні змінити — вона лише мовчки лежала в базі. */
  note: string | null;
  rating: number | null;
  photo_url?: string;
  /** Коли ви там були. Керує тим, у який день фото мітки стане в архів
   *  «Спогадів» — до появи цієї колонки бралася дата створення мітки,
   *  і мітка про давню подорож падала в сьогоднішній день. */
  visited_at?: string;
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
      visitedAt: string;
    }): Promise<MapPinRow | null> => {
      const geo = await reverseGeocode(v.lat, v.lng);
      const row: InsertRow<'map_pins'> = {
        title: v.title,
        note: v.note,
        category: v.category,
        lat: v.lat,
        lng: v.lng,
        city: geo.city || null,
        country: geo.country || null,
        created_by: user.id,
        visited_at: v.visitedAt,
      };
      const { data, error } = await supabase.from('map_pins').insert(row).select('id').single();
      if (error || !data) throw error ?? new Error('insert failed');

      /*
       * Мітка ВЖЕ в базі, тож падіння фото не має вдавати, що місце не
       * збереглося: `onError` сказав би «Помилка збереження місця», і це
       * була б неправда. Ловимо рівно крок із фото й кажемо про нього.
       */
      if (v.file) {
        try {
          const url = await uploadPinPhoto(v.file, data.id);
          await supabase.from('map_pins').update({ photo_url: url }).eq('id', data.id);
        } catch (e) {
          console.error('uploadPinPhoto:', e);
          toast.show('Місце збережено, але фото не вдалося підготувати');
        }
      }
      const { data: fresh } = await supabase
        .from('map_pins')
        .select('id,title,note,category,lat,lng,photo_url,rating,review,city,country,created_by,created_at,visited_at')
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

/** Лінивий бекфіл міста/країни для пінів, збережених без них. */
export function useCityBackfill(pins: MapPinRow[]) {
  const client = useQueryClient();
  const running = useRef(false);

  useEffect(() => {
    const todo = pins.filter((p) => !p.city || !p.country);
    if (!todo.length || running.current) return;
    running.current = true;
    let cancelled = false;

    (async () => {
      for (const pin of todo) {
        if (cancelled) break;
        const geo = await reverseGeocode(pin.lat, pin.lng);
        const patch: { city?: string; country?: string } = {};
        if (!pin.city && geo.city) patch.city = geo.city;
        if (!pin.country && geo.country) patch.country = geo.country;
        if (Object.keys(patch).length) await supabase.from('map_pins').update(patch).eq('id', pin.id);
        await new Promise((r) => setTimeout(r, 300)); // не спамимо геокодер
      }
      if (!cancelled) void client.invalidateQueries({ queryKey: qk.mapPins() });
      running.current = false;
    })();

    return () => {
      cancelled = true;
      running.current = false;
    };
    // Лише коли змінюється множина «без міста/країни».
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins.map((p) => (!p.city || !p.country ? p.id : '')).join(',')]);
}
