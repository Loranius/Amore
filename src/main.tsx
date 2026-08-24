// ============================================================
// ТОЧКА ВХОДУ — композиція провайдерів
// ------------------------------------------------------------
// Порядок вкладення важливий:
//   ThemeProvider   — застосовує data-theme до першого рендеру;
//   ToastProvider   — вішає глобальні error-слухачі якнайраніше;
//   ConfirmProvider — стилізована заміна window.confirm() (useConfirm);
//   QueryClient     — кеш даних, доступний усім хукам нижче;
//   AuthProvider    — стан користувача (використовує supabase + може
//                     читати users через React Query).
//
// <App/> (роутинг + Layout) — Крок 3; поки що тимчасовий плейсхолдер.
// ============================================================
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { ToastProvider } from '@/providers/ToastProvider';
import { ConfirmProvider } from '@/providers/ConfirmProvider';
import { AuthProvider } from '@/providers/AuthProvider';
import App from '@/App';
import '@/index.css';
/* Після `index.css`, а не всередині: `@import` дозволений лише на початку
   файлу, а цей шар перевизначає блоки, оголошені в ньому нижче. Виграє він
   усе одно специфічністю (0,1,1) проти (0,1,0) — порядок тут другий
   запобіжник, а не єдиний. */
import '@/features/world/artifactThemes.css';
// Стилю сторінок тут більше немає, і це навмисно. Файл, підключений у
// точці входу, діє на КОЖНОМУ маршруті й не належить нікому — саме так
// у планів колись накопичилось вісім шарів, і саме так три файли
// вішліста (33 КБ) вантажились на головній, у покупках і на карті, де
// жодного бажання немає. Стиль сторінки імпортує сама сторінка.

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root не знайдено в index.html');

createRoot(rootEl).render(
  <StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <ConfirmProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <App />
            </AuthProvider>
          </QueryClientProvider>
        </ConfirmProvider>
      </ToastProvider>
    </ThemeProvider>
  </StrictMode>,
);
