// ============================================================
// Коли ця людина востаннє дивилась на нитку спогадів.
// ------------------------------------------------------------
// Потрібне одному: підсвітити спогади, які партнер склав відтоді
// (`memoryThread.ts::unseenFromPartner`, ADR-0251).
//
// Мітка живе в базі (`memory_visits`, ADR-0252), один рядок на людину:
// переглянуте на одному телефоні гасне й на другому. Перша редакція
// тримала її в `localStorage`, і на кожному пристрої «нове» показувалось
// заново.
//
// Порядок важливий: спершу прочитати ПОПЕРЕДНЮ мітку, лише потім
// записати теперішню. Навпаки — нитка порівнювала б із «щойно» й не
// підсвітила б нічого.
//
// Мітка, що лишилась у `localStorage` від першої редакції, переноситься
// один раз: інакше перший візит після оновлення погасив би «нове», якого
// людина ще не бачила.
// ============================================================
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const legacyKey = (userId: number) => `amore:memories-seen:${userId}`;

/**
 * Мітка ПОПЕРЕДНЬОГО візиту, або `null`, поки її читаємо чи якщо її немає.
 * Поточний візит записується одразу після читання.
 */
export function useSeenSince(userId: number): string | null {
  const [previous, setPrevious] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from('memory_visits').select('seen_at').eq('user_id', userId).maybeSingle();
      // Помилка читання коштує підсвітки, а не екрана: тоді не пишемо й
      // нову мітку, щоб не погасити «нове», якого людина не бачила.
      if (error) return;
      const legacy = readLegacy(userId);
      const since = data?.seen_at ?? legacy;
      if (!cancelled) setPrevious(since);

      const { error: writeError } = await supabase
        .from('memory_visits')
        .upsert({ user_id: userId, seen_at: new Date().toISOString() }, { onConflict: 'user_id' });
      if (!writeError && legacy !== null) dropLegacy(userId);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  return previous;
}

function readLegacy(userId: number): string | null {
  try {
    return localStorage.getItem(legacyKey(userId));
  } catch {
    return null;
  }
}

function dropLegacy(userId: number): void {
  try {
    localStorage.removeItem(legacyKey(userId));
  } catch {
    // Залишок у сховищі нешкідливий: база вже має свою мітку й читається першою.
  }
}
