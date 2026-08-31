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
// зшивали ВСІ сторінки в один вхідний бандл: рушій карти приїздив кожному,
// хто просто відкрив головну й ніколи не заходив на карту. Головна й
// логін лишаються статичними — це перше, що бачить користувач, і ділити
// їх означало б показати порожній екран замість них.
// ============================================================
import { Suspense, type ReactNode } from 'react';
import { createHashRouter, Navigate } from 'react-router-dom';
import { lazyRoute } from './lazyRoute';
import { Layout } from '@/components/layout/Layout';
import { RouteErrorBoundary } from '@/components/layout/RouteErrorBoundary';
import { RequireAuth, RedirectIfAuthed } from '@/components/guards/RequireAuth';
import { LoginPage } from '@/features/auth/LoginPage';
import { HomePage } from '@/features/home/HomePage';
import { PageSkeleton } from '@/components/ui/PageSkeleton';

/*
 * Завантажувач і `lazy` розділені навмисно.
 *
 * `lazy(() => import(…))` ховає сам `import()` усередині компонента, і
 * дістати його ззовні неможливо — а саме він потрібен, щоб ПРОГРІТИ чанк
 * до того, як пара торкнеться доку (`routePrefetch.ts`). Тому завантажувач
 * названий окремо, а `lazy` бере вже його.
 *
 * Специфікатор мусить лишатись тим самим рядком в обох місцях: Vite
 * склеює `import()` за текстом специфікатора, і копія з іншим написанням
 * (аліас проти відносного шляху) дала б ДРУГИЙ чанк — тобто прогрів
 * гріл би не те, що потім поїде.
 */
const loadShopping = () => import('@/features/shopping/ShoppingPage');
const loadWishlist = () => import('@/features/wishlist/WishlistPage');
const loadSchedule = () => import('@/features/schedule/SchedulePage');
const loadMemories = () => import('@/features/memories/MemoriesPage');
const loadMoment = () => import('@/features/memories/MomentPage');
const loadMedia = () => import('@/features/media/MediaPage');
const loadCulinary = () => import('@/features/culinary/CulinaryPage');
const loadPlans = () => import('@/features/plans/PlansPage');
const loadJourney = () => import('@/features/journey/JourneyPage');
const loadPlanDetails = () => import('@/features/plans/PlanDetailsPage');
const loadWhereTo = () => import('@/features/whereto/WhereToPage');
const loadGame = () => import('@/features/game/GamePage');
const loadHistorySweep = () => import('@/features/onboarding/HistorySweepPage');

const ShoppingPage = lazyRoute(loadShopping, (m) => m.ShoppingPage);
const WishlistPage = lazyRoute(loadWishlist, (m) => m.WishlistPage);
const SchedulePage = lazyRoute(loadSchedule, (m) => m.SchedulePage);
const MemoriesPage = lazyRoute(loadMemories, (m) => m.MemoriesPage);
const MomentPage = lazyRoute(loadMoment, (m) => m.MomentPage);
const MediaPage = lazyRoute(loadMedia, (m) => m.MediaPage);
const CulinaryPage = lazyRoute(loadCulinary, (m) => m.CulinaryPage);
const PlansPage = lazyRoute(loadPlans, (m) => m.PlansPage);
const HistorySweepPage = lazyRoute(loadHistorySweep, (m) => m.HistorySweepPage);
const JourneyPage = lazyRoute(loadJourney, (m) => m.JourneyPage);
const PlanDetailsPage = lazyRoute(loadPlanDetails, (m) => m.PlanDetailsPage);
const WhereToPage = lazyRoute(loadWhereTo, (m) => m.WhereToPage);
const GamePage = lazyRoute(loadGame, (m) => m.GamePage);

/**
 * Чанки, які варто прогріти, поки пара дивиться на головну.
 *
 * **Порядок тут — це порядок прогріву, і він не декоративний.** Перші три
 * — сусіди по доку, тобто найімовірніший наступний дотик; «Спогади» йдуть
 * четвертими, бо це найчастіший перехід із «Ще».
 *
 * Решта розділів навмисно НЕ входить: прогрів — це той самий трафік, лише
 * заздалегідь, і тягнути «Медіа» (152 КБ) чи карту (952 КБ) тому, хто до
 * них не збирається, дорожче за паузу перед самим переходом.
 */
export const PREFETCHED_ROUTE_CHUNKS: readonly (() => Promise<unknown>)[] = [
  // `preload`, а не сирий `loadX`: він не лише тягне модуль, а й запам'ятовує
  // готовий компонент, тож прогрітий розділ рендериться без `Suspense`
  // взагалі. Сирий імпорт прогрів би мережу й лишив би скелет на місці —
  // саме так це й було виміряно на продакшн-збірці.
  WishlistPage.preload,
  PlansPage.preload,
  ShoppingPage.preload,
  MemoriesPage.preload,
];

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
          // Єдиний маршрут, що забирає екран цілком: док і бічна панель
          // ідуть з дороги, кристала немає. Див. `useImmersiveRoute`.
          { path: 'journey', element: page(<JourneyPage />) },
          // «Скарбничка» видалена (ADR-0049). Обидві її адреси —
          // теперішня й давня «фінансова» — ведуть на головну: збережене
          // посилання мусить приводити кудись, а не в порожній екран.
          { path: 'piggybank', element: <Navigate to="/" replace /> },
          { path: 'budget', element: <Navigate to="/" replace /> },
          { path: 'shopping', element: page(<ShoppingPage />) },

          // Календар більше не окремий модуль: він став вкладкою всередині
          // «Планів». Адреса лишається перенаправленням, бо на неї ведуть
          // збережені посилання й сповіщення.
          { path: 'calendar', element: <Navigate to="/plans" replace /> },
          // «Графік» був сабтабом календаря й тому ховався за ним. Тепер це
          // власний розділ у «Ще»; стара адреса лишається редиректом, щоб
          // збережені посилання й закладки не ламались — так само, як
          // «Фото», що став окремим розділом /memories.
          { path: 'schedule', element: page(<SchedulePage />) },
          { path: 'calendar/schedule', element: <Navigate to="/schedule" replace /> },
          { path: 'calendar/photos', element: <Navigate to="/memories" replace /> },

          { path: 'memories', element: page(<MemoriesPage />) },
          // Спогад має власну адресу: пара ділиться посиланням, а «назад» із
          // повного екрана мусить вести в галерею, а не з застосунку.
          { path: 'memories/:id', element: page(<MomentPage />) },
          { path: 'media', element: page(<MediaPage />) },
          { path: 'whereto', element: page(<WhereToPage />) },
          // «Наша карта» більше не окремий модуль: карта стала другим
          // виміром «Спогадів» (ADR-0039). Перенаправлення лишається,
          // бо на /map ведуть закладки й старі посилання в планах.
          { path: 'map', element: <Navigate to="/memories" replace /> },
          { path: 'culinary', element: page(<CulinaryPage />) },
          { path: 'game', element: page(<GamePage />) },

          // Заповнення історії: пара, яка разом давно, інакше отримує
          // однакові порожні роки. Окремий маршрут, а не модалка, бо це
          // довга робота на кілька заходів, і на неї треба вміти
          // повернутись за посиланням.
          { path: 'start', element: page(<HistorySweepPage />) },

          // Невідомий шлях під логіном → на головну.
          { path: '*', element: <Navigate to="/" replace /> },
          ],
        }],
      },
    ],
  },
]);
