// ============================================================
// REACT QUERY — конфігурація (заміна кастомного DataCache)
// ------------------------------------------------------------
// DataCache.swr → useQuery (миттєвий cached + фонова ревалідація —
// вбудована SWR-поведінка React Query). DataCache.invalidate →
// queryClient.invalidateQueries. Backoff портований із lib/retry.js:
// 1с → 3с → 9с, до 3 спроб, лише для retryable-помилок.
// ============================================================
import { QueryClient } from '@tanstack/react-query';
import { isRetryable } from './errors';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Свіжість переважно тримає realtime (invalidateQueries на подіях
      // партнера), тому staleTime великий — зайвих рефетчів при кожному
      // перемиканні вкладки не робимо (як старий in-memory DataCache).
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      // ЧОМУ offlineFirst, а не дефолтний 'online'. При 'online' React
      // Query не робить запит, поки `navigator.onLine === false`: запит
      // лишається в стані pending із fetchStatus 'paused'. Наші екрани
      // (бажання, фінанси, архів) малюють спінер саме по `isPending`, тож
      // користувач бачив би «Завантаження…» без кінця й без помилки — не
      // видно навіть, що причина в мережі.
      //
      // На мобільному це не крайній випадок: `navigator.onLine` сумно
      // відомий хибними false — Android лишає його false при переході
      // Wi-Fi→LTE, а PWA, відкрита з іконки, часом стартує з ним же.
      // З 'offlineFirst' запит виконується попри прапорець: якщо мережа
      // насправді є — дані приходять, якщо ні — це чесна помилка з
      // кнопкою «Спробувати ще», яка вже є на кожному екрані.
      networkMode: 'offlineFirst',
      // 3 спроби всього (1 + 2 ретраї), лише мережеві/5xx — 1:1 зі старим Retry.
      retry: (failureCount, error) => failureCount < 3 && isRetryable(error),
      // attemptIndex 0→1000, 1→3000, стеля 9000 (старі DELAYS).
      retryDelay: (attemptIndex) => Math.min(3 ** attemptIndex * 1000, 9000),
    },
    mutations: {
      // Записи не ретраїмо автоматично: при оптимістичному оновленні
      // важливіше швидко відкотитись і показати помилку, ніж мовчки
      // ретраїти. Конкретна мутація може ввімкнути retry явно.
      retry: 0,
      // Та сама причина, що в запитів, але наслідок гірший: при 'online'
      // мутація в офлайні лишається paused, кнопка сидить у стані
      // «Зберігаємо…» і не відпускає форму. Хай краще буде відмова з
      // тостом — текст у полі зберігається, дію можна повторити.
      networkMode: 'offlineFirst',
    },
  },
});
