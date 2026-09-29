// ============================================================
// Скидання слідів попереднього акаунта (ADR-0236).
// ------------------------------------------------------------
// Власник, 2026-09-29: після входу іншою парою на тому самому пристрої
// головна показувала дні й дату Діми й Лєни, їхні плани й «353 нові миті»,
// доки сторінку не оновили. База нічого чужого не віддавала — RLS тримає.
// Віддавав КЕШ:
//   • React Query в пам'яті: ключі запитів не містять пари
//     (`['settings','relationship_start_date']`), тож новий акаунт у тій самій
//     вкладці отримував дані попереднього, доки запит не оновився;
//   • localStorage: дата початку, вид, насіння, «побачені миті» — на
//     пристрій, а не на людину.
//
// Тепер при виході й при вході ІНШОЮ людиною обидва кеші чистяться. Лишаються
// тільки налаштування пристрою, що нічого не кажуть про пару.
// ============================================================
import { queryClient } from './queryClient';

/** Що лишається: вибір пристрою, а не дані пари. */
export const DEVICE_PREFERENCE_KEYS: readonly string[] = [
  'amore:theme',
  'amore:wishlist:view-modes:v1',
];

/** Чи належить ключ сховища порталу й несе дані пари. */
export function isCoupleScopedKey(key: string): boolean {
  if (DEVICE_PREFERENCE_KEYS.includes(key)) return false;
  return key.startsWith('amore:') || key === 'portal_session_user_id';
}

function purge(storage: Storage | undefined): void {
  if (!storage) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (key !== null && isCoupleScopedKey(key)) keys.push(key);
    }
    for (const key of keys) storage.removeItem(key);
  } catch (error) {
    // Заборонене сховище (приватний режим) — чистити нічого.
    console.warn('sessionReset: storage unavailable', error);
  }
}

/** Прибрати все, що портал пам'ятає про попередню людину й пару. */
export function resetPortalSession(): void {
  queryClient.clear();
  if (typeof window === 'undefined') return;
  purge(window.localStorage);
  purge(window.sessionStorage);
}
