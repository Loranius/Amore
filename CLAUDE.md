# Amore — портал для двох (Діма і Лєна)

Приватний PWA-портал пари. Хостинг: GitHub Pages (деплой = пуш у main).
Бекенд: Supabase (Postgres + Auth + Storage + Realtime + Edge Functions).

## Стек і жорсткі правила

- **Vanilla JS без збірки.** Немає npm, бандлера, транспіляції — все виконується браузером
  як є. Але з переходу на ES-модулі (липень 2026) модулі — це справжні `export`/`import`,
  а не IIFE-глобалі: `export const Foo = {...}` у файлі, `import { Foo } from './foo.js'`
  там, де користуються. Єдина точка входу в index.html —
  `<script type="module" src="modules/app.js?v=N">`; він статично імпортує всі інші модулі
  (порядок import-рядків у app.js важливий — визначає порядок реєстрації portal:auth/
  portal:view-слухачів, як раніше визначав порядок `<script>`-тегів). ES-модулі не
  виконуються через `file://` — локально тестувати тільки через http(s)-сервер
  (напр. `python3 -m http.server`).
- **Після зміни БУДЬ-ЯКОГО js/css файлу обов'язково:**
  1. Якщо міняв стилі — бампни їхній `?v=` у index.html (`styles/main.css?v=13` тощо).
     Якщо міняв `modules/app.js` — бампни його `?v=` (`?v=esm1` → `esm2`). Решта `.js`-файлів
     імпортуються БЕЗ `?v=` (звичайні ES-import шляхи), тому наступний пункт — головний.
  2. Бампни `const CACHE = 'amore-vNN'` у service-worker.js (+1). Список SHELL не чіпай —
     CSS/JS кешуються в рантаймі; бамп CACHE видаляє ВЕСЬ старий рантайм-кеш при activate,
     тож наступний фетч будь-якого імпортованого модуля (навіть без власного `?v=`) піде
     в мережу за свіжим.
  Без цього користувачі отримають старий кеш і зміни «не працюватимуть».
- **Мова:** весь UI, коментарі і комміти — українською.
- **Не переписуй файли цілком** без потреби — точкові правки.
- **JSDoc-типізація:** частина файлів має строгі `@param`/`@returns`/`@type` анотації,
  перевіряються через `tsc -p jsconfig.json` (опційно, нуль впливу на рантайм/деплой —
  GitHub Pages про jsconfig.json/types.d.ts не знає). `types.d.ts` — спільні
  інтерфейси/типи (глобальний ambient-скрипт, без import/export у самому файлі, тому
  видний звідусіль). Новий типізований файл — додай у `jsconfig.json` → `include`.

## Структура

- `index.html` — вся розмітка view-секцій. Єдиний скрипт-тег —
  `<script type="module" src="modules/app.js">`; решта підключається через import-граф.
- `modules/*.js` — по модулю на вкладку (router, auth, calendar, shopping, random=Кулінарія,
  wishlist, budget, media, map, schedule, photo-calendar, question, capsule, counter,
  greeting, photos, home-widgets, week-widget, settings, swipe, game=вкладка «Гра» (game.html в iframe)).
  Кожен експортує іменований об'єкт (`export const Auth = {...}`) і сам імпортує свої
  залежності. `app.js` — точка входу: імпортує всі модулі й вручну кличе `.init()` кожного
  (порядок імпортів/викликів критичний — див. коментар на початку файла).
- `lib/*.js` — cache (SWR), realtime, error-boundary (тости: `ErrorBoundary.showToast(msg, 'success'|'warn'|тип за замовч. error)`), img (компресія), pwa, retry, confetti, modal (`closeModalAnimated` — раніше жила inline в index.html, тепер `export function` тут).
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
