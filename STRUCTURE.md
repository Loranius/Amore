# Amore → React: структура проєкту (Крок 1)

Стек: Vite + React 19 + TypeScript (strict) + Tailwind CSS + TanStack Query + react-router-dom + @supabase/supabase-js.

## Дерево файлів

```
amore-react/
├── index.html                    # єдиний HTML; уся розмітка — у компонентах
├── package.json
├── vite.config.ts                # @vitejs/plugin-react + vite-plugin-pwa (заміна service-worker.js)
├── tsconfig.json                 # strict: true, noUncheckedIndexedAccess, alias @ → src
├── tailwind.config.ts
├── .env.local                    # VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (не в git)
├── public/
│   ├── manifest.webmanifest
│   ├── icons/                    # icon-192.png, icon-512.png
│   └── game.html                 # гра-симулятор як є (вбудовується в iframe)
└── src/
    ├── main.tsx                  # ReactDOM.createRoot + провайдери
    ├── App.tsx                   # RouterProvider (роути з app/routes.tsx)
    ├── index.css                 # Tailwind + CSS-токени тем (light / [data-theme="dark"])
    ├── types/
    │   └── index.ts              # ✅ ЦЕЙ КРОК — усі контракти
    ├── app/
    │   └── routes.tsx            # дерево роутів + мапа ViewName → URL
    ├── lib/
    │   ├── supabase.ts           # createClient<Database> + типізований invokeFn<K extends EdgeFunctionName>
    │   ├── queryClient.ts        # QueryClient (staleTime, retry — порт lib/retry.js)
    │   ├── queryKeys.ts          # фабрика ключів (заміна рядкових ключів DataCache)
    │   ├── realtime.ts           # один канал postgres_changes + markSelf/isSelfEcho → invalidateQueries
    │   ├── images.ts             # HEIC→JPEG (heic-to) + компресія через Canvas (порт lib/img.js) — КРИТИЧНО
    │   ├── guards.ts             # runtime-перевірки: isUserName, isPlanMetadata, isCulinaryDish…
    │   └── utils.ts              # cn() = clsx + tailwind-merge, форматери дат
    ├── providers/
    │   ├── AuthProvider.tsx      # PIN-флоу через auth-pin + тихий signInWithPassword; useAuth()
    │   ├── ThemeProvider.tsx     # localStorage 'amore:theme' → data-theme
    │   └── ToastProvider.tsx     # порт ErrorBoundary.showToast
    ├── components/
    │   ├── layout/
    │   │   ├── Layout.tsx        # обгортка: <Outlet/> + BottomNav + Sidebar (desktop)
    │   │   ├── BottomNav.tsx     # NavLink-и; активність секції — з location
    │   │   ├── Sidebar.tsx
    │   │   ├── MoreMenu.tsx      # шторка «Ще»
    │   │   └── HubTabs.tsx       # сабтаби хабів (Календар / Ми)
    │   ├── guards/
    │   │   └── RequireAuth.tsx   # редірект на /login без сесії Supabase + профілю
    │   └── ui/                   # Modal, Skeleton, Lightbox, Confetti, EmptyState
    └── features/                 # 1 фіча = сторінка + хуки + локальні компоненти
        ├── auth/                 # LoginPage, UserSelect, PinPad
        ├── home/                 # HomePage, Counter, PhotosCloud, WeekWidget, HomeWidgets, Greeting
        ├── wishlist/             # WishlistPage, useWishlist.ts, WishCard, WishFormModal
        ├── budget/               # BudgetPage, useFreeLimit.ts, useSavingsGoals.ts
        ├── calendar/             # CalendarPage, useEvents.ts, usePlans.ts, EventList, PlanBoard
        ├── schedule/             # SchedulePage, useWorkSchedule.ts
        ├── photo-calendar/       # PhotoCalendarPage, usePhotoCalendar.ts
        ├── question/             # QuestionPage, useDailyQuestion.ts
        ├── capsule/              # CapsulePage, useCapsules.ts
        ├── media/                # MediaPage, useMediaItems.ts, useTmdb.ts
        ├── swipe/                # SwipeDeck, useSwipeDeck.ts (framer-motion drag)
        ├── whereto/              # WhereToPage, useEventsFinder.ts
        ├── map/                  # MapPage, useMapPins.ts, useLocations.ts (lazy mapbox-gl)
        ├── shopping/             # ShoppingPage, useShoppingItems.ts (optimistic)
        ├── culinary/             # CulinaryPage (стара random), useDishes.ts, useCulinaryConstructor.ts
        ├── settings/             # SettingsModal, useSettings.ts, useUserSizes.ts
        └── game/                 # GamePage → <iframe src="/game.html">
```

## Роути (react-router-dom) ↔ старі view

| URL                  | Сторінка                | Старий view      |
|----------------------|-------------------------|------------------|
| `/login`             | auth/LoginPage          | auth-screen      |
| `/`                  | home/HomePage           | home             |
| `/wishlist`          | wishlist/WishlistPage   | wishlist         |
| `/budget`            | budget/BudgetPage       | budget           |
| `/calendar`          | calendar/CalendarPage   | calendar (хаб)   |
| `/calendar/schedule` | schedule/SchedulePage   | schedule         |
| `/calendar/photos`   | photo-calendar/…Page    | photo-calendar   |
| `/us` → `/us/question` | question/QuestionPage | question (хаб)   |
| `/us/capsule`        | capsule/CapsulePage     | capsule          |
| `/media`             | media/MediaPage (+Swipe)| media            |
| `/whereto`           | whereto/WhereToPage     | whereto          |
| `/map`               | map/MapPage             | map              |
| `/shopping`          | shopping/ShoppingPage   | shopping         |
| `/culinary`          | culinary/CulinaryPage   | random           |
| `/game`              | game/GamePage           | game             |
| `/settings`          | SettingsModal поверх Layout | modal        |

Хаби (`calendar-hub`, `us-hub`) стають вкладеними роутами з `<HubTabs/>` + `<Outlet/>` — жодних `display:none`-перемикань.

## Ключі React Query (queryKeys.ts) ↔ старі ключі DataCache

| Старий ключ            | Новий queryKey                       |
|------------------------|--------------------------------------|
| `users`                | `['users']`                          |
| `events`               | `['events']`                         |
| `shopping:items`       | `['shopping']`                       |
| `wishlist:<owner>`     | `['wishlist', ownerId]`              |
| `media:<type>:<status>`| `['media', { type, status }]`        |
| `dishes`               | `['dishes']`                         |
| `question:log:<date>`  | `['question', date]`                 |
| `sched:<month>`        | `['schedule', month]`                |
| `pcal:<month>`         | `['photoCalendar', month]`           |
| `map_pins`             | `['mapPins']`                        |
| `free_limit` / `savings_goals` | `['freeLimit']` / `['savingsGoals']` |

Realtime (`lib/realtime.ts`): та сама мапа таблиця → ключі, але замість ручного `refresh()` — `queryClient.invalidateQueries({ queryKey })`; придушення власної луни `markSelf(table)` зберігається 1:1 (вікно 2.5 с).

## Ключові рішення Фази 1 (у types/index.ts)

1. **`createClient<Database>`** — інтерфейс `Database` робить типізованими УСІ запити `.from()` без жодного `any`; `Row<'events'>`, `InsertRow<'wishlist_items'>` — готові аліаси.
2. **`id: number` строго всюди.** Оптимістичні записи — від'ємний тимчасовий id (`-Date.now()`) + прапорець `Optimistic<T>`; клас багів «string vs number» із shopping.js неможливий на рівні компілятора.
3. **`events.metadata: PlanMetadata | null`** — типи написані так, ніби колонка вже існує (SQL міграції — у коментарі до `PlanMetadata`; окремо потрібен одноразовий бекфіл старих `[cat:…]`-тегів).
4. **Edge Functions — мапа `EdgeFunctions`**: `invokeFn('culinary-ai', body)` виводить і тип body, і тип відповіді; non-2xx нормалізується wrapper'ом (supabase-js кладе тіло помилки в `FunctionsHttpError.context`, а не в `data`).
5. **`UserName = 'Діма' | 'Лєна'`** + runtime-guard `isUserName` на межі з БД (каст без перевірки заборонений).

## Залежності

- prod: `react`, `react-dom`, `react-router-dom`, `@tanstack/react-query`, `@supabase/supabase-js`, `clsx`, `tailwind-merge`, `framer-motion` (свайпи), `heic-to` (тепер з npm, без CDN)
- dev: `vite`, `@vitejs/plugin-react`, `typescript`, `tailwindcss`, `@tailwindcss/vite`, `vite-plugin-pwa`

## Що свідомо лишається поза React

- `public/game.html` — самодостатня гра, іде в iframe без змін.
- Edge Functions (`supabase/functions/*`) — не чіпаються, деплой вручну як і раніше.
- `mapbox-gl` — динамічний import у feature map (не тягнути в основний бандл).
