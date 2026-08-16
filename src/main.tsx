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
// Візуальний crystal-glass pass для об'єднаного модуля «Плани».
// Імпортується останнім, щоб бути чистим presentation override без змін
// календарної/планової логіки та без переписування базових стилів модуля.
import '@/features/plans/plansCrystalRefresh.css';
// Фінальний reference-fidelity шар для /plans: фон світу лишається тим самим,
// але геометрія, щільність і кристалічні акценти наближені до затвердженого UI.
import '@/features/plans/plansReferenceFidelity.css';
// Калібрування після живого мобільного скріншота: компактніший календар,
// легші картки, не-sticky tabs і нижні дії в композиції самого модуля.
import '@/features/plans/plansReferencePolish.css';
// Третій прохід за референсом: ще нижчий календар і один візуально зшитий
// glass-panel навколо «Найближчих», «Ідей», «Завершених» та кнопки додавання.
import '@/features/plans/plansReferencePanelPass.css';
// Етап 1 нового UI-pass: темніша navy-violet ієрархія surfaces та контроль
// яскравих lavender/pink акцентів без зміни геометрії або логіки модуля.
import '@/features/plans/plansReferencePaletteStage1.css';
// Етап 2: темне тоноване скло замість великих фіолетових блоків —
// тонші edges, внутрішні highlights, слабші separators і глибший material feel.
import '@/features/plans/plansReferenceGlassStage2.css';
// Етап 3: картки планів отримують справжню faceted crystal edge,
// компактний badge, сильнішу категорійну ідентичність і тихіший chevron.
import '@/features/plans/plansReferenceCardsStage3.css';

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
