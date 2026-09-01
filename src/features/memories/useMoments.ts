import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { compress } from '@/lib/images';
import { qk } from '@/lib/queryKeys';
import { useToast } from '@/providers/ToastProvider';
import type { PlaceCandidate } from './momentPlace';
import { ensurePlacePin } from './placePins';
import type { InsertRow, MapPinRow, MemoryMomentRow, MemoryRow } from '@/types';

// ============================================================
// Спогади: моменти, їхні фото й місця.
// ------------------------------------------------------------
// **Дві таблиці, і імена в них зсунуті на одне.** `memory_moments` — це
// спогад, який бачить пара; `memories` — окремі ФОТО в ньому. Виглядає
// плутано, і причина названа тут, щоб ніхто не «полагодив» це мимохідь:
// `memories` читають ще плани й риф-прев'ю рушія Еволюції, а живі реакції
// продуктових модулів у рушій заборонено чіпати до фази інтеграції. Тож
// таблиця фото лишилась під старим іменем, а момент дістав власне.
//
// Один похід у базу на весь архів, а не запит на кожен момент. Архів пари —
// це десятки записів, не тисячі; тридцять сім окремих запитів на фото
// коштували б більше за все інше в модулі разом.
// ============================================================

export const MEMORIES_BUCKET = 'photo-calendar';

const MOMENT_COLUMNS =
  'id,title,note,memory_date,cover_photo_id,place_pin_id,created_by,created_at,updated_at';
const PHOTO_COLUMNS = 'id,photo_url,moment_id,storage_bucket,storage_path,memory_date,date_precision,taken_at,caption,uploaded_by,sort_order,created_at';

/** Місце спогаду — мітка з «Нашої карти», лише ті поля, які показує рядок. */
export interface MomentPlace {
  id: number;
  title: string | null;
  city: string | null;
  country: string | null;
  lat: number;
  lng: number;
}

/** Момент разом із усім, що потрібно намалювати його картку чи сторінку. */
export interface Moment extends MemoryMomentRow {
  /** Фото в порядку `sort_order`, обкладинка ПЕРША. */
  photos: MemoryRow[];
  cover: MemoryRow | null;
  place: MomentPlace | null;
}

export interface MomentsArchive {
  moments: Moment[];
  /** Скільки фото всього — підпис у шапці рахує саме їх, а не моменти. */
  photoCount: number;
  /**
   * Усі мітки «Нашої карти».
   *
   * Лежать тут, а не в окремому запиті композера: вони вже прочитані, щоб
   * підписати місце кожного спогаду, і другий похід у базу заради того
   * самого списку був би чистою витратою.
   */
  places: MomentPlace[];
}

/**
 * Обкладинка йде першою, решта — за `sort_order`.
 *
 * Не сортування «обкладинка окремо, альбом окремо»: на сторінці спогаду
 * альбом показує ВСІ фото, і якби обкладинка з нього випадала, пара не
 * могла б відкрити її на повний екран свайпом із сусідніх.
 */
function orderPhotos(photos: readonly MemoryRow[], coverId: number | null): MemoryRow[] {
  return [...photos].sort((a, b) => {
    if (a.id === coverId) return -1;
    if (b.id === coverId) return 1;
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.id - b.id;
  });
}

export function useMoments() {
  return useQuery({
    queryKey: qk.moments(),
    queryFn: async (): Promise<MomentsArchive> => {
      const [momentsRes, photosRes, pinsRes] = await Promise.all([
        supabase.from('memory_moments').select(MOMENT_COLUMNS)
          .order('memory_date', { ascending: false }).order('id', { ascending: false }),
        supabase.from('memories').select(PHOTO_COLUMNS).order('sort_order', { ascending: true }),
        supabase.from('map_pins').select('id,title,city,country,lat,lng'),
      ]);
      if (momentsRes.error) throw momentsRes.error;
      if (photosRes.error) throw photosRes.error;
      if (pinsRes.error) throw pinsRes.error;

      const byMoment = new Map<number, MemoryRow[]>();
      let photoCount = 0;
      for (const photo of (photosRes.data ?? []) as MemoryRow[]) {
        if (photo.moment_id === null) continue;
        photoCount += 1;
        const bucket = byMoment.get(photo.moment_id);
        if (bucket) bucket.push(photo);
        else byMoment.set(photo.moment_id, [photo]);
      }

      const pins = new Map<number, MomentPlace>(
        ((pinsRes.data ?? []) as MapPinRow[]).map((pin) => [pin.id, {
          id: pin.id,
          title: pin.title,
          city: pin.city,
          country: pin.country,
          lat: Number(pin.lat),
          lng: Number(pin.lng),
        }]),
      );

      const moments = ((momentsRes.data ?? []) as MemoryMomentRow[]).map((row): Moment => {
        const photos = orderPhotos(byMoment.get(row.id) ?? [], row.cover_photo_id);
        return {
          ...row,
          photos,
          cover: photos.find((p) => p.id === row.cover_photo_id) ?? photos[0] ?? null,
          place: row.place_pin_id === null ? null : pins.get(row.place_pin_id) ?? null,
        };
      });

      return { moments, photoCount, places: [...pins.values()] };
    },
  });
}

/** Що пара вписала в блокнот. Фото приходять окремо — їх ще треба залити. */
export interface MomentDraft {
  title: string;
  note: string | null;
  memoryDate: string;
  placePinId: number | null;
}

export interface NewPhoto {
  file: File;
  /** Час зйомки з EXIF, якщо був. Ніколи не підміняється часом завантаження. */
  takenAt: string | null;
}

/**
 * Куди лягає файл у сховищі.
 *
 * Ім'я будується з часу й порядкового номера — без випадковості: два
 * знімки з однієї партії відрізняються індексом, дві партії — часом.
 * Розширення бере стиснений результат, бо після `compress` файл майже
 * завжди WebP, хай яким прийшов із камери.
 */
function storagePath(momentId: number, index: number, file: File, ext: string): string {
  const stem = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-32);
  return `moments/${momentId}/${Date.now()}-${index}-${stem}.${ext}`;
}

async function uploadPhotos(
  momentId: number,
  memoryDate: string,
  userId: number,
  photos: readonly NewPhoto[],
  startOrder: number,
  onProgress?: (done: number, total: number) => void,
): Promise<MemoryRow[]> {
  const saved: MemoryRow[] = [];
  for (const [index, item] of photos.entries()) {
    /*
     * Стиснути ПЕРЕД заливкою, тим самим шляхом, що й решта порталу.
     *
     * Це не економія «про всяк випадок», а дві окремі речі, без яких
     * модуль ламається:
     *
     *  1. **HEIC.** Знімок з iPhone приходить у форматі, якого браузер не
     *     показує взагалі. `compress` веде його через `normalize`, тобто
     *     через HEIC→JPEG; без цього фотографія лягла б у сховище й
     *     лишилась порожньою рамкою назавжди.
     *  2. **Розмір.** Оригінал сучасної камери — 3–12 МБ і до 50
     *     мегапікселів. Такий файл не лише коштує трафіку: Supabase
     *     ВІДМОВЛЯЄТЬСЯ будувати з нього мініатюру («source image
     *     resolution is too large to process»), і галерея змушена тягнути
     *     повний оригінал. В архіві пари такий знімок уже є — 6144×8160,
     *     10.9 МБ.
     *
     * 1600 по довгій стороні при 0.84 — ті самі числа, що в старому
     * архіві фото й у планах: різні цифри тут дали б різну якість у
     * сусідніх модулях без жодної причини.
     */
    let blob: Blob = item.file;
    let ext = 'jpg';
    let contentType = item.file.type || 'image/jpeg';
    try {
      const out = await compress(item.file, 1600, 0.84);
      blob = out.blob;
      ext = out.ext;
      contentType = out.contentType;
    } catch (e) {
      // Стиснення — не умова збереження спогаду. Але HEIC без нього не
      // покажеться, тому про невдачу треба знати з консолі.
      console.warn('[Спогади] стиснення не вдалося, вантажу оригінал:', e);
    }

    const path = storagePath(momentId, startOrder + index, item.file, ext);
    const { error: upErr } = await supabase.storage
      .from(MEMORIES_BUCKET)
      .upload(path, blob, { cacheControl: '31536000', upsert: false, contentType });
    if (upErr) throw upErr;

    const { data: publicUrl } = supabase.storage.from(MEMORIES_BUCKET).getPublicUrl(path);
    const row: InsertRow<'memories'> = {
      photo_url: publicUrl.publicUrl,
      moment_id: momentId,
      storage_bucket: MEMORIES_BUCKET,
      storage_path: path,
      memory_date: memoryDate,
      date_precision: 'day',
      taken_at: item.takenAt,
      caption: null,
      uploaded_by: userId,
      sort_order: startOrder + index,
    };
    const { data, error } = await supabase.from('memories').insert(row).select(PHOTO_COLUMNS).single();
    if (error) {
      // Рядок не створився — файл у сховищі лишився б сиротою назавжди.
      await supabase.storage.from(MEMORIES_BUCKET).remove([path]).catch(() => undefined);
      throw error;
    }
    saved.push(data as MemoryRow);
    onProgress?.(index + 1, photos.length);
  }
  return saved;
}

export function useMomentMutations() {
  const client = useQueryClient();
  const toast = useToast();
  const invalidate = () => void client.invalidateQueries({ queryKey: qk.moments() });

  /**
   * Створення йде у два кроки: спершу момент, потім фото.
   *
   * Інакше нема куди класти `moment_id`, а класти фото «нікуди» й
   * прив'язувати потім означало б, що обірваний посеред заливки процес
   * лишає в архіві безхазяйні знімки.
   */
  const create = useMutation({
    mutationFn: async (v: {
      draft: MomentDraft;
      photos: readonly NewPhoto[];
      userId: number;
      onProgress?: (done: number, total: number) => void;
    }): Promise<Moment> => {
      const row: InsertRow<'memory_moments'> = {
        title: v.draft.title,
        note: v.draft.note,
        memory_date: v.draft.memoryDate,
        place_pin_id: v.draft.placePinId,
        created_by: v.userId,
      };
      const { data: moment, error } = await supabase
        .from('memory_moments').insert(row).select(MOMENT_COLUMNS).single();
      if (error) throw error;
      const created = moment as MemoryMomentRow;

      let photos: MemoryRow[] = [];
      try {
        photos = await uploadPhotos(
          created.id, v.draft.memoryDate, v.userId, v.photos, 0, v.onProgress,
        );
      } catch (e) {
        // Момент без жодного фото — це порожня картка в галереї. Відкочуємо.
        await supabase.from('memory_moments').delete().eq('id', created.id);
        throw e;
      }

      // Перше фото стає обкладинкою автоматично — вимога концепту.
      const coverId = photos[0]?.id ?? null;
      if (coverId !== null) {
        await supabase.from('memory_moments').update({ cover_photo_id: coverId })
          .eq('id', created.id);
      }
      return { ...created, cover_photo_id: coverId, photos, cover: photos[0] ?? null, place: null };
    },
    onSuccess: invalidate,
    onError: (e) => toast.show('Не вдалось зберегти спогад: ' + (e as Error).message),
  });

  const update = useMutation({
    mutationFn: async (v: { id: number; draft: MomentDraft }) => {
      const { error } = await supabase.from('memory_moments').update({
        title: v.draft.title,
        note: v.draft.note,
        memory_date: v.draft.memoryDate,
        place_pin_id: v.draft.placePinId,
        updated_at: new Date().toISOString(),
      }).eq('id', v.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e) => toast.show('Не вдалось оновити: ' + (e as Error).message),
  });

  const addPhotos = useMutation({
    mutationFn: async (v: {
      moment: Moment;
      photos: readonly NewPhoto[];
      userId: number;
      onProgress?: (done: number, total: number) => void;
    }) => {
      const startOrder = v.moment.photos.reduce((max, p) => Math.max(max, p.sort_order + 1), 0);
      const saved = await uploadPhotos(
        v.moment.id, v.moment.memory_date, v.userId, v.photos, startOrder, v.onProgress,
      );
      // Спогад міг лишитись без обкладинки, якщо всі фото колись видалили.
      if (v.moment.cover_photo_id === null && saved[0]) {
        await supabase.from('memory_moments').update({ cover_photo_id: saved[0].id })
          .eq('id', v.moment.id);
      }
    },
    onSuccess: invalidate,
    onError: (e) => toast.show('Не вдалось додати фото: ' + (e as Error).message),
  });

  const setCover = useMutation({
    mutationFn: async (v: { momentId: number; photoId: number }) => {
      const { error } = await supabase.from('memory_moments')
        .update({ cover_photo_id: v.photoId, updated_at: new Date().toISOString() })
        .eq('id', v.momentId);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e) => toast.show('Не вдалось змінити обкладинку: ' + (e as Error).message),
  });

  /**
   * Видалення одного фото.
   *
   * Файл зі сховища прибирається лише тоді, коли архів сам його туди й
   * поклав (`storage_path` заповнений). Фото, що прийшло з мітки карти,
   * належить карті — архів на нього лише посилається.
   */
  const removePhoto = useMutation({
    mutationFn: async (photo: MemoryRow) => {
      const { error } = await supabase.from('memories').delete().eq('id', photo.id);
      if (error) throw error;
      if (photo.storage_bucket && photo.storage_path) {
        await supabase.storage.from(photo.storage_bucket).remove([photo.storage_path])
          .catch(() => undefined);
      }
    },
    onSuccess: invalidate,
    onError: (e) => toast.show('Не вдалось видалити фото: ' + (e as Error).message),
  });

  /**
   * Видалення спогаду разом із фото.
   *
   * Рядки заберає каскад (`memories.moment_id … on delete cascade`), а от
   * файли сховища каскад не знає — їх треба прибрати руками, і саме тому
   * список шляхів збирається ДО видалення.
   */
  const remove = useMutation({
    mutationFn: async (moment: Moment) => {
      const paths = moment.photos
        .filter((p) => p.storage_bucket === MEMORIES_BUCKET && p.storage_path)
        .map((p) => p.storage_path!);
      const { error } = await supabase.from('memory_moments').delete().eq('id', moment.id);
      if (error) throw error;
      if (paths.length > 0) {
        await supabase.storage.from(MEMORIES_BUCKET).remove(paths).catch(() => undefined);
      }
    },
    onSuccess: invalidate,
    onError: (e) => toast.show('Не вдалось видалити спогад: ' + (e as Error).message),
  });

  return { create, update, addPhotos, setCover, removePhoto, remove };
}

/**
 * Місце спогаду → `map_pins.id`.
 *
 * Пошук серед наявних міток, дедуплікація й дата візиту живуть у
 * `placePins.ts`: ту саму дію робить і заповнення історії, а дві копії
 * розійшлись би тихо — одна дедуплікує, друга ні, і в пари з'являється
 * друга тераса за десять метрів від першої.
 *
 * `visitedAt` — дата самого спогаду, і саме її бракувало. Мітка без
 * `visited_at` невидима рушієві (`adapters/map.ts`), а цей шлях —
 * ЄДИНИЙ живий спосіб створити мітку в порталі: другий, у
 * `useMapPinMutations`, не має жодного споживача. Тобто карта, один із
 * шести модулів року, не зароблялась жодним дотиком пари.
 */
export function useEnsurePlacePin() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (
      v: { place: PlaceCandidate; userId: number; visitedAt: string },
    ): Promise<number> => (
      (await ensurePlacePin(v.place, v.userId, v.visitedAt)).id
    ),
    onSuccess: () => {
      // Нова мітка мусить з'явитись і на карті — інакше пара побачила б її
      // лише після перезавантаження застосунку.
      void client.invalidateQueries({ queryKey: qk.mapPins() });
    },
  });
}
