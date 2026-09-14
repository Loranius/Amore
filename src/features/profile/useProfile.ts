// ============================================================
// Профіль — запис.
// ------------------------------------------------------------
// Читання живе в `_shared/useUsers.ts` (`usePeople`), бо читають профіль
// геть усі модулі, а пишуть — лише налаштування.
//
// Збереження зачіпає ДВА місця, і це не випадковість, а модель: підпис і
// фото йдуть у `settings`, дата народження — у `events`. Чому саме так —
// у шапці `profileModel.ts`.
// ============================================================
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, publicUrl } from '@/lib/supabase';
import { qk } from '@/lib/queryKeys';
import { compress, normalize } from '@/lib/images';
import { useToast } from '@/providers/ToastProvider';
import { useCurrentUser } from '@/providers/AuthProvider';
import { birthdayEventTitle, profileSettingKey, serialiseProfile, type UserProfile } from './profileModel';
import type { InsertRow } from '@/types';

/**
 * Бакет той самий, що й у полароїда, але ПАПКА окрема.
 *
 * `usePhotoPool` читає КОРІНЬ бакета (`list('')`) і бере лише файли з
 * розширенням картинки. Вкладена папка приходить туди одним записом без
 * розширення й відсіюється — тобто портрети не потраплять у пул фото
 * кристала. Перевірено по коду `useHome.ts`, а не припущено.
 */
const PHOTO_BUCKET = 'family_photos';
const PROFILE_FOLDER = 'profile';

export interface ProfileSave {
  userId: number;
  profile: UserProfile;
  /** 'YYYY-MM-DD' або порожній рядок, якщо дату прибрали. */
  birthday: string;
}

export function useSaveProfile() {
  const client = useQueryClient();
  const toast = useToast();
  const me = useCurrentUser();

  return useMutation({
    mutationFn: async ({ userId, profile, birthday }: ProfileSave): Promise<void> => {
      const { error: settingsError } = await supabase
        .from('settings')
        .upsert(
          { key: profileSettingKey(userId), value: serialiseProfile(profile) },
          { onConflict: 'key' },
        );
      if (settingsError) throw settingsError;

      /*
       * Подія дня народження шукається за ПАРОЮ `type` + `person_user_id`,
       * а не за збереженим ідентифікатором. Так профіль лишається без
       * посилання, яке могло б протухнути, коли подію видалять із
       * календаря вручну.
       */
      const { data: existing, error: findError } = await supabase
        .from('events')
        .select('id')
        .eq('type', 'birthday')
        .eq('person_user_id', userId)
        .maybeSingle();
      if (findError) throw findError;

      const title = birthdayEventTitle(profile.displayName?.trim() || '');

      if (birthday === '') {
        // Дату прибрали — прибираємо й подію: інакше в календарі лишилась
        // би дата, якої в профілі вже немає.
        if (existing) {
          const { error } = await supabase.from('events').delete().eq('id', existing.id);
          if (error) throw error;
        }
        return;
      }

      if (existing) {
        const { error } = await supabase
          .from('events')
          .update({ date: birthday, title, yearly: true })
          .eq('id', existing.id);
        if (error) throw error;
        return;
      }

      const row: InsertRow<'events'> = {
        title,
        date: birthday,
        type: 'birthday',
        yearly: true,
        person_user_id: userId,
        created_by: me.id,
      };
      const { error } = await supabase.from('events').insert(row);
      if (error) throw error;
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: qk.settings() });
      void client.invalidateQueries({ queryKey: qk.events() });
      toast.show('Профіль збережено');
    },
    onError: (error) => {
      console.error('useSaveProfile:', error);
      toast.show('Не вдалося зберегти профіль');
    },
  });
}

/**
 * Портрет: нормалізація HEIC → стиснення → Storage.
 *
 * Ім'я файлу СТАЛЕ (`profile/<id>.<ext>`), тож старий портрет
 * перезаписується й у бакеті не накопичуються покинуті файли. Ціною цього
 * є кеш: посилання те саме, тому до нього дописується мітка часу —
 * інакше телефон показував би вчорашнє фото ще добу.
 */
export function useUploadProfilePhoto() {
  const toast = useToast();
  return useMutation({
    mutationFn: async ({ userId, file }: { userId: number; file: File }): Promise<string> => {
      const normalized = await normalize(file);
      let blob: Blob = normalized;
      let ext = (normalized.name.split('.').pop() || 'jpg').toLowerCase();
      let contentType = normalized.type;
      try {
        // 512 px: портрет стоїть кружечком 44–72 px, і більший файл — це
        // лише довше завантаження на мобільному інтернеті.
        const out = await compress(normalized, 512, 0.82);
        blob = out.blob;
        ext = out.ext;
        contentType = out.contentType;
      } catch (error) {
        console.warn('useUploadProfilePhoto: стиснення не вдалося, ллю оригінал', error);
      }
      const name = `${PROFILE_FOLDER}/${userId}.${ext}`;
      const { error } = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(name, blob, { upsert: true, contentType });
      if (error) throw error;
      return `${publicUrl(PHOTO_BUCKET, name)}?v=${Date.now()}`;
    },
    onError: (error) => {
      console.error('useUploadProfilePhoto:', error);
      toast.show('Не вдалося завантажити фото');
    },
  });
}
