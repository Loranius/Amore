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
