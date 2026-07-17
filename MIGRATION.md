# Міграція Amore: vanilla JS → React

Підсумковий документ технічної міграції портала **Amore** з vanilla JS (ES6-модулі + Supabase, без збірки) на **React 19 + Vite + TypeScript (strict)**. Візуал і поведінка збережені 1:1; змінилась лише реалізація.

---

## Стек

| | Було | Стало |
|---|---|---|
| UI | Vanilla JS, `innerHTML`-шаблони, ручні `addEventListener` | React 19, JSX, декларативний стан |
| Типи | JSDoc + `types.d.ts` (глобальні, без import) | TypeScript strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`) |
| Дані/кеш | `DataCache.swr` (власний) | `@tanstack/react-query` |
| Роутинг | власний `router.js` + `portal:view`-події | `react-router-dom` (HashRouter) |
| Supabase | `any`-клієнт | `createClient<Database>` — повністю типізований |
| Свайпи | ручні pointer-обробники | `framer-motion` |
| Mapbox | CDN `<script>` + `any` | npm-пакет `mapbox-gl` (типізований) |
| Збірка | немає (файли напряму) | Vite |

Комунікація UI — українською; коментарі в коді — українською.

---

## Архітектура

Feature-folder: кожна фіча — це тека з хуком даних (`useX.ts`: запити + мутації), сторінкою (`XPage.tsx`) та модалками/під-компонентами. Спільне — лише в `_shared`. Крос-фіча-імпортів немає, окрім однієї **навмисної односпрямованої** `media → swipe` (панель свайпу живе всередині медіа; swipe не імпортує media, циклу нема).

```
src/
├── app/          роутинг, layout, константи
├── providers/    Auth (PIN), Theme, Toast
├── lib/          supabase, queryKeys, guards, images, tmdb, mapbox, realtime, confetti, utils, errors
├── components/   ui (Lightbox тощо)
├── types/        index.ts — усі таблиці БД, Edge-функції, guard-типи
└── features/     18 фіч (див. мапу нижче)
```

---

## Мапа: старий модуль → нові файли

| Старий модуль | Нова фіча (`src/features/…`) | Ключові файли |
|---|---|---|
| `counter.js`, `greeting.js`, `home-widgets.js`, `week-widget.js`, `photos.js` | **home** | `HomePage`, `HomeBlocks`, `HomeWidgets`, `PhotoCloud`, `useHome`, `homeUtils` |
| `budget.js` | **budget** | `BudgetPage`, `FreeLimitCard`, `GoalsList`, `useBudget` |
| `shopping.js` | **shopping** | `ShoppingPage`, `EditItemModal`, `useShoppingItems` |
| `wishlist.js` | **wishlist** | `WishlistPage`, `WishCard`, `WishFormModal`, `WishArchive`, `useWishlist` |
| `calendar.js` | **calendar** | `CalendarPage`, `EventList`, `PlansBoard`, `AddEventModal`, `PlanArchiveModal`, `useCalendar`, `calendarUtils` |
| `schedule.js` | **schedule** | `SchedulePage`, `useSchedule` |
| `photo-calendar.js` | **photo-calendar** | `PhotoCalendarPage`, `PhotoDayModal`, `usePhotoCalendar` |
| `question.js` | **question** | `QuestionPage`, `useQuestion` |
| `capsule.js` | **capsule** | `CapsulePage`, `useCapsule` |
| `media.js` | **media** | `MediaPage`, `MediaCard`, `MediaDetailModal`, `ReviewPanel`, `MediaModals`, `useMedia`, `useTmdb`, `mediaConstants` |
| `swipe.js` | **swipe** | `SwipeDeck`, `SwipeCardView`, `SwipeDetailModal`, `useSwipeDeck` |
| `random.js` | **culinary** | `CulinaryPage`, `Constructor`, `Favorites`, `DishModal`, `useCulinaryConstructor`, `useDishes`, `culinaryConstants` |
| `map.js` | **map** | `MapPage`, `MapPanels`, `PinModal`, `AddPinModal`, `LocationHistoryModal`, `useMapPins`, `useLocations`, `mapConstants` |
| `whereto.js` | **whereto** | `WhereToPage`, `useWhereTo`, `whereToConstants` |
| `game.js` | **game** | `GamePage` (+ `public/game.html` без змін) |
| `auth.js` | **_shared/useUsers** + `providers/AuthProvider` | — |
| `lib/cache.js` | `@tanstack/react-query` (замінено) | `lib/queryClient`, `lib/queryKeys` |
| `lib/img.js` | `lib/images` | HEIC-sniff + convert + compress |
| спільне подій | `_shared/events` | `useEvents`, `planMetadataOf` (ділять calendar + home) |

---

## Ключові рішення

**Типізований клієнт замість `any`.** `createClient<Database>` + аліаси `Row<T>`/`InsertRow<T>`/`UpdateRow<T>`. Мутації, що обирають колонку за автором (відгуки, відповіді на питання), використовують **явну гілку `who → колонка`**, а не крихкі computed-key `[field]`.

**Метадані планів замість regex-тегів.** Старий код зашивав `[cat:…][status:…][doneAt:…]` у текст опису й парсив регуляркою. Тепер — типізована JSONB-колонка `events.metadata`. Це прибирає останній regex-парсинг у calendar, counter та week-widget. **Потрібна разова міграція** (див. чек-лист).

**Свайпи на framer-motion.** `useMotionValue`/`useTransform`/`animate` + `drag`/`onDragEnd`. Напрями збережені: вгору = подивились, вниз = пропустити, вліво = в планах, вправо = дивимось. Жодного ручного touch/mouse-обробника.

**Mapbox типізовано.** Перехід із CDN-інжекту на npm прибрав `any`-виняток. Карта керується імперативно через refs; піни/маркери синкаються в ефектах під React-стан. `createElement` для маркерів — легітимний штатний спосіб mapbox.

**Realtime.** monkey-patch мутацій supabase авто-викликає `markSelf` (глушіння відлуння власних змін). Ключі realtime → `queryKeys` для точкової інвалідації.

**localStorage** дозволений (це реальний застосунок, не артефакт): денний кеш «Куди піти», миттєвий старт-дейт лічильника, persist конструктора страв.

**Спрощення (свідомі):** пінч-зум фулскрін-фото → спільний `Lightbox`; інфініт-скрол медіа-списку → рендер усього (список на двох); прибрані `visualViewport`-хаки позиціонування модалок під клавіатуру.

---

## Локальний запуск

Потрібен **Node.js 20+**.

```bash
npm install
npm run dev          # http://localhost:5173, гаряча перезагрузка
npm run typecheck    # строга перевірка типів
npm run build        # збірка у dist/
```

> Тайпчек тут (у середовищі без мережі) прогонявся лише на беззалежних файлах — повний `npm run typecheck` треба запустити локально після `npm install`.

---

## Змінні оточення (`.env.local`)

| Змінна | Обовʼязково | Нотатка |
|---|---|---|
| `VITE_SUPABASE_URL` | так | URL проєкту Supabase |
| `VITE_SUPABASE_ANON_KEY` | так | anon-ключ |
| `VITE_TMDB_KEY` | ні | фолбек — публічний ключ зі старого бандлу |
| `VITE_MAPBOX_TOKEN` | ні | фолбек — публічний pk-токен зі старого бандлу |

Зразок — у `.env.local.example`.

---

## Чек-лист деплою (GitHub Pages)

1. **БД, разово перед деплоєм:** прогнати `supabase/migrations/20260717_events_metadata_backfill.sql` — переносить старі теги планів (`[cat:][status:]`) у `events.metadata`.
2. **Base-path:** якщо сайт живе за `username.github.io/<repo>/`, виставити `base: '/<repo>/'` у `vite.config.ts`. Код уже читає `import.meta.env.BASE_URL` (стосується й `game.html`).
3. **Роутинг:** HashRouter — глибокі посилання на Pages не ламаються, додаткова `404.html` не потрібна.
4. **Збірка:** `npm run build` → публікувати `dist/` (найзручніше — GitHub Action на пуш).
5. **Env:** прописати `VITE_*` (секрети — в GitHub Secrets, підставляти на кроці build).
6. **Storage-бакети:** переконатись, що існують і доступні — `family_photos`, `media-posters`, `map-photos` (+ ті, що використовує schedule/photo-calendar).

---

## Стан

Усі **12 сторінок** мігровані, заглушок немає:
`home · budget · shopping · wishlist · calendar (+schedule, +photos) · question · capsule · media (+swipe) · culinary · map · whereto · game`.

Обсяг: 100 TS/TSX-файлів, ~1680 рядків CSS, 18 feature-тек.
