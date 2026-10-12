// ============================================================
// Коли ця людина востаннє дивилась на нитку — на ЦЬОМУ пристрої.
// ------------------------------------------------------------
// Потрібне одному: підсвітити спогади, які партнер склав відтоді
// (`memoryThread.ts::unseenFromPartner`, ADR-0251).
//
// Мітка живе в `localStorage`, а не в базі, і це свідомий компроміс: на
// другому телефоні «нове» покажеться ще раз. Таблиця в базі вимагала б
// міграції заради підсвітки, а помилка тут коштує одного зайвого акценту.
// Сховище може бути недоступне (приватний режим) — тоді підсвітки просто
// немає, а не падіння.
// ============================================================
import { useEffect, useState } from 'react';

const key = (userId: number) => `amore:memories-seen:${userId}`;

/** Мітка ПОПЕРЕДНЬОГО візиту; поточний візит записується одразу. */
export function useSeenSince(userId: number): string | null {
  const [previous] = useState<string | null>(() => {
    try {
      return localStorage.getItem(key(userId));
    } catch {
      return null;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key(userId), new Date().toISOString());
    } catch {
      // Без сховища підсвітки «нового» не буде — і це все, що втрачається.
    }
  }, [userId]);

  return previous;
}
