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
// Розділи вантажаться ліниво, і це не мікрооптимізація. Статичні імпорти
// зшивали ВСІ сторінки в один вхідний бандл: mapbox-gl приїздив кожному,
// хто просто відкрив головну й ніколи не заходив на карту. Головна й
// логін лишаються статичними — це перше, що бачить користувач, і ділити
// їх означало б показати порожній екран замість них.
// ============================================================
import { lazy, Suspense, type ReactNode } from 'react';
import { createHashRouter, Navigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { RouteErrorBoundary } from '@/components/layout/RouteErrorBoundary';
import { RequireAuth, RedirectIfAuthed } from '@/components/guards/RequireAuth';
import { LoginPage } from '@/features/auth/LoginPage';
import { HomePage } from '@/features/home/HomePage';
import { PageSkeleton } from '@/components/ui/PageSkeleton';

const ShoppingPage = lazy(() => import('@/features/shopping/ShoppingPage').then((m) => ({ default: m.ShoppingPage })));
const WishlistPage = lazy(() => import('@/features/wishlist/WishlistPage').then((m) => ({ default: m.WishlistPage })));
const CalendarPage = lazy(() => import('@/features/calendar/CalendarPage').then((m) => ({ default: m.CalendarPage })));
const SchedulePage = lazy(() => import('@/features/schedule/SchedulePage').then((m) => ({ default: m.SchedulePage })));
const MemoriesPage = lazy(() => import('@/features/memories/MemoriesPage').then((m) => ({ default: m.MemoriesPage })));
const MediaPage = lazy(() => import('@/features/media/MediaPage').then((m) => ({ default: m.MediaPage })));
const CulinaryPage = lazy(() => import('@/features/culinary/CulinaryPage').then((m) => ({ default: m.CulinaryPage })));
const PiggyBankPage = lazy(() => import('@/features/piggybank/PiggyBankPage').then((m) => ({ default: m.PiggyBankPage })));
const PlansPage = lazy(() => import('@/features/plans/PlansPage').then((m) => ({ default: m.PlansPage })));
const PlanDetailsPage = lazy(() => import('@/features/plans/PlanDetailsPage').then((m) => ({ default: m.PlanDetailsPage })));
const MapPage = lazy(() => import('@/features/map/MapPage').then((m) => ({ default: m.MapPage })));
const WhereToPage = lazy(() => import('@/features/whereto/WhereToPage').then((m) => ({ default: m.WhereToPage })));
const GamePage = lazy(() => import('@/features/game/GamePage').then((m) => ({ default: m.GamePage })));

/** Один Suspense на розділ, а не один на весь Layout: інакше очікування
 *  чанка знімало б із екрана навігацію разом зі сторінкою. */
function page(node: ReactNode): ReactNode {
  return <Suspense fallback={<PageSkeleton />}>{node}</Suspense>;
}

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
        children: [{
          // Безшляховий роут виключно заради errorElement, і місце тут
          // принципове. На самому <Layout> він замінював би Layout цілком —
          // разом із нижньою навігацією, тобто впав один розділ, а вийти з
          // нього нікуди. Дочірнім він малюється в <Outlet/> Layout'а, і
          // портал лишається на місці. Без нього ж react-router підіймав
          // будь-яку помилку до кореня й показував службовий екран замість
          // застосунку (див. RouteErrorBoundary).
          errorElement: <RouteErrorBoundary />,
          children: [
          { index: true, element: <HomePage /> },
          { path: 'wishlist', element: page(<WishlistPage />) },
          { path: 'plans', element: page(<PlansPage />) },
          { path: 'plans/:id', element: page(<PlanDetailsPage />) },
          { path: 'piggybank', element: page(<PiggyBankPage />) },
          // Стара адреса «Фінансів»: закладки й посилання в Telegram
          // не мусять ламатись через перейменування модуля.
          { path: 'budget', element: <Navigate to="/piggybank" replace /> },
          { path: 'shopping', element: page(<ShoppingPage />) },

          { path: 'calendar', element: page(<CalendarPage />) },
          // «Графік» був сабтабом календаря й тому ховався за ним. Тепер це
          // власний розділ у «Ще»; стара адреса лишається редиректом, щоб
          // збережені посилання й закладки не ламались — так само, як
          // «Фото», що став окремим розділом /memories.
          { path: 'schedule', element: page(<SchedulePage />) },
          { path: 'calendar/schedule', element: <Navigate to="/schedule" replace /> },
          { path: 'calendar/photos', element: <Navigate to="/memories" replace /> },

          { path: 'memories', element: page(<MemoriesPage />) },
          { path: 'media', element: page(<MediaPage />) },
          { path: 'whereto', element: page(<WhereToPage />) },
          { path: 'map', element: page(<MapPage />) },
          { path: 'culinary', element: page(<CulinaryPage />) },
          { path: 'game', element: page(<GamePage />) },

          // Невідомий шлях під логіном → на головну.
          { path: '*', element: <Navigate to="/" replace /> },
          ],
        }],
      },
    ],
  },
]);
