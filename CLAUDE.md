# Amore — портал для двох (Діма і Лєна)

Приватний PWA-портал пари. Хостинг: GitHub Pages (деплой = пуш у main).
Бекенд: Supabase (Postgres + Auth + Storage + Realtime + Edge Functions).

## Стек і жорсткі правила

- **Vanilla JS без збірки.** Немає npm, бандлера, транспіляції. Ніяких import/export —
  модулі це IIFE, що кладуть об'єкт у глобальну область (`const Foo = (() => {...})()`),
  підключаються через `<script defer>` в index.html. Порядок скриптів важливий.
- **Після зміни БУДЬ-ЯКОГО js/css файлу обов'язково:**
  1. Бампни його query-параметр `?v=` у index.html (напр. `random.js?v=culinary3` → `culinary4`).
  2. Бампни `const CACHE = 'amore-vNN'` у service-worker.js (+1).
  Без цього користувачі отримають старий кеш і зміни «не працюватимуть».
- **Мова:** весь UI, коментарі і комміти — українською.
- **Не переписуй файли цілком** без потреби — точкові правки.

## Структура

- `index.html` — вся розмітка view-секцій + глобальні хелпери (`closeModalAnimated`).
- `modules/*.js` — по модулю на вкладку (router, auth, calendar, shopping, random=Кулінарія,
  wishlist, budget, media, map, schedule, photo-calendar, question, capsule, counter,
  greeting, photos, home-widgets, week-widget, settings, swipe, app).
- `lib/*.js` — cache (SWR), realtime, error-boundary (тости: `ErrorBoundary.showToast(msg, 'success'|'warn'|тип за замовч. error)`), img (компресія), pwa, retry, confetti.
- `styles/main.css` — токени/теми (світла + `[data-theme="dark"]`), базове. `styles/components.css` — компоненти.
- `supabase/functions/*/index.ts` — вихідники Edge Functions (ДЕПЛОЯТЬСЯ ВРУЧНУ через
  Dashboard, НЕ з цього репо автоматично). `supabase/migrations.sql` — довідково.

## Архітектура, яку не можна ламати

- **Роутер і хаби:** `Router.showView(name)` диспатчить подію `portal:view` з іменем view.
  Сабв'ю (`calendar`, `schedule`, `photo-calendar`, `question`, `capsule`) живуть у хаб-секціях
  (мапа `SUBVIEWS` у router.js). Модулі слухають `portal:view` за СТАРИМИ іменами — не міняй їх.
- **Дані:** `DataCache.swr(key, loader, render)` + `DataCache.invalidate(key)` після записів.
  Realtime (lib/realtime.js, мапа MAP) інвалідує кеш і ререндерить активну вкладку;
  придушення власної луни через `markSelf`.
- **Auth:** кастомний PIN + тихий Supabase Auth (для RLS). `Auth.getCurrentUser()` → {id, name},
  імена строго 'Діма' і 'Лєна'. RLS увімкнено на всіх таблицях — нові таблиці потребують політик.
- **Події життєвого циклу:** `portal:auth` (після логіну), `portal:view` (зміна вкладки).
  Ініт модулів — у modules/app.js, не самовиклик.

## Домені константи

- Категорії покупок (порядок = порядок відображення, синхронізовано з Edge Function shopping-parse
  і tg-commands): Овочі, Фрукти, М'ясо, Морепродукти, Напої, Побут, Посуд, Гігієна, Косметика,
  Канцелярія, Спорт, Інше.
- Категорії страв (DISH_CATS): meat, vegan, fast, other.
- Рецепт страви — jsonb `dishes.recipe`: `{servings, ingredients:[{name,amount,unit}], steps:[]}`.
- Кулінарія: конструктор викликає Edge Function `culinary-ai` (Claude API, секрет CLAUDE_KEY),
  стан конструктора персиститься в localStorage `amore:culinary`.

## Edge Functions (Supabase)

culinary-ai, shopping-parse (Claude API, ключ CLAUDE_KEY), tg-commands (єдиний Telegram-вебхук;
callback_query форвардить у db-notify), db-notify (DB-вебхуки + кнопки), event-reminders (крон).
Клієнт кличе їх через `supabase.functions.invoke(name, {body})`. Зміни в цих файлах у репо —
лише вихідники; нагадай користувачу передеплоїти вручну.

## Чого НЕ робити

- Не додавати збірку, фреймворки, TypeScript у фронтенд.
- Не чіпати service-worker логіку, крім бампа версії CACHE.
- Не використовувати localStorage для чутливих даних.
- Не видаляти fallback-гілки в запитах до Supabase (вони покривають невиконані міграції).
- Не комітити ключі/токени — всі секрети живуть у Supabase Secrets.
