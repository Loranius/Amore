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
    },
  },
});
