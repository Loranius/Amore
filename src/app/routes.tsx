// ============================================================
// РОУТИ — дерево react-router-dom
// ------------------------------------------------------------
// Кожен розділ — власний роут; хабів із сабтабами більше немає.
// «Календар» був останнім, і тримав під собою «Графік» — тобто розділ,
// який неможливо було знайти, не знаючи, що він там. Мапу URL ↔ старий
// view див. STRUCTURE.md.
//
// HashRouter (не Browser): хостинг — GitHub Pages, де глибокі URL і
// F5 ламаються без 404-фолбеку та правильного base. Хеш усе це знімає
// без конфігу. Переїзд на createBrowserRouter — заміна одного рядка.
//
// (по одній), тому дерево вже фінальне, а вміст — тимчасовий.
// ============================================================
import { createHashRouter, Navigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { RequireAuth, RedirectIfAuthed } from '@/components/guards/RequireAuth';
import { LoginPage } from '@/features/auth/LoginPage';
import { ShoppingPage } from '@/features/shopping/ShoppingPage';
import { WishlistPage } from '@/features/wishlist/WishlistPage';
import { CalendarPage } from '@/features/calendar/CalendarPage';
import { SchedulePage } from '@/features/schedule/SchedulePage';
import { MemoriesPage } from '@/features/memories/MemoriesPage';
import { MediaPage } from '@/features/media/MediaPage';
import { CulinaryPage } from '@/features/culinary/CulinaryPage';
import { HomePage } from '@/features/home/HomePage';
import { PiggyBankPage } from '@/features/piggybank/PiggyBankPage';
import { PlansPage } from '@/features/plans/PlansPage';
import { PlanDetailsPage } from '@/features/plans/PlanDetailsPage';
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
          { path: 'plans', element: <PlansPage /> },
          { path: 'plans/:id', element: <PlanDetailsPage /> },
          { path: 'piggybank', element: <PiggyBankPage /> },
          // Стара адреса «Фінансів»: закладки й посилання в Telegram
          // не мусять ламатись через перейменування модуля.
          { path: 'budget', element: <Navigate to="/piggybank" replace /> },
          { path: 'shopping', element: <ShoppingPage /> },

          { path: 'calendar', element: <CalendarPage /> },
          // «Графік» був сабтабом календаря й тому ховався за ним. Тепер це
          // власний розділ у «Ще»; стара адреса лишається редиректом, щоб
          // збережені посилання й закладки не ламались — так само, як
          // «Фото», що став окремим розділом /memories.
          { path: 'schedule', element: <SchedulePage /> },
          { path: 'calendar/schedule', element: <Navigate to="/schedule" replace /> },
          { path: 'calendar/photos', element: <Navigate to="/memories" replace /> },

          { path: 'memories', element: <MemoriesPage /> },
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
