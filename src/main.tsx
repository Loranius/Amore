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
import '@/features/wishlist/wishlistMist.css';
import '@/features/wishlist/wishlistPearlBubbles.css';
// Останній шар поверхні бульбашок. Замінив wishlistPearlRim.css і
// wishlistPearlContrast.css: перший малював 6px обідок, другий існував
// щоб той обідок прибрати — разом вони давали 1px рамку за 152 рядки.
import '@/features/wishlist/wishlistBubbleGlass.css';
// Стилю планів тут більше немає, і це навмисно. Вісім шарів
// (`plansCrystalRefresh` + шість `plansReference*`) зведені в один
// `plansModule.css`, який імпортує сам модуль. Глобальний імпорт стилю
// сторінки — це те, що дозволило їм накопичитись: файл, підключений тут,
// діє скрізь і не належить нікому.

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
