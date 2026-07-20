// ============================================================
// РОУТИ — дерево react-router-dom
// ------------------------------------------------------------
// Хаби (Календар, Ми) — вкладені роути з <Outlet/>, а не приховані
// секції. Мапу URL ↔ старий view див. STRUCTURE.md.
//
// HashRouter (не Browser): хостинг — GitHub Pages, де глибокі URL і
// F5 ламаються без 404-фолбеку та правильного base. Хеш усе це знімає
// без конфігу. Переїзд на createBrowserRouter — заміна одного рядка.
//
// (по одній), тому дерево вже фінальне, а вміст — тимчасовий.
// ============================================================
import { createHashRouter, Navigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { CalendarHub } from '@/components/layout/HubLayout';
import { RequireAuth, RedirectIfAuthed } from '@/components/guards/RequireAuth';
import { LoginPage } from '@/features/auth/LoginPage';
import { ShoppingPage } from '@/features/shopping/ShoppingPage';
import { WishlistPage } from '@/features/wishlist/WishlistPage';
import { CalendarPage } from '@/features/calendar/CalendarPage';
import { SchedulePage } from '@/features/schedule/SchedulePage';
import { PhotoCalendarPage } from '@/features/photo-calendar/PhotoCalendarPage';
import { MediaPage } from '@/features/media/MediaPage';
import { CulinaryPage } from '@/features/culinary/CulinaryPage';
import { HomePage } from '@/features/home/HomePage';
import { BudgetPage } from '@/features/budget/BudgetPage';
import { MapPage } from '@/features/map/MapPage';
import { WhereToPage } from '@/features/whereto/WhereToPage';
import { GamePage } from '@/features/game/GamePage';

// Тимчасовий хелпер: замінюється реальними сторінками в Кроці 4.
export const router = createHashRouter([
  {
    path: '/login',
    element: (
      <RedirectIfAuthed>
        <LoginPage />
      </RedirectIfAuthed>
    ),
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <Layout />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'wishlist', element: <WishlistPage /> },
          { path: 'budget', element: <BudgetPage /> },
          { path: 'shopping', element: <ShoppingPage /> },

          // Хаб «Календар»: /calendar (Події) · /schedule · /photos
          {
            path: 'calendar',
            element: <CalendarHub />,
            children: [
              { index: true, element: <CalendarPage /> },
              { path: 'schedule', element: <SchedulePage /> },
              { path: 'photos', element: <PhotoCalendarPage /> },
            ],
          },

          { path: 'media', element: <MediaPage /> },
          { path: 'whereto', element: <WhereToPage /> },
          { path: 'map', element: <MapPage /> },
          { path: 'culinary', element: <CulinaryPage /> },
          { path: 'game', element: <GamePage /> },

          // Невідомий шлях під логіном → на головну.
          { path: '*', element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
]);
