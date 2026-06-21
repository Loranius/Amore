# Прискорення Amore — кеш-шар (stale-while-revalidate)

## Суть
Раніше кожен перехід на вкладку робив запит до Supabase з нуля → порожній екран → очікування → рендер.
Тепер дані малюються МИТТЄВО з кешу в пам'яті, а свіжий запит летить у фоні й перемальовує лише якщо щось змінилось.

## Новий файл
- `lib/cache.js` — `DataCache` (swr / ensure / invalidate / invalidatePrefix), з дедуплікацією одночасних запитів.

## Змінені файли (залити всі)
- index.html            — підключено lib/cache.js, бамп ?v на скриптах
- service-worker.js      — CACHE: amore-v12 → amore-v13
- lib/cache.js           — НОВИЙ
- modules/auth.js        — Auth.getUsers() (спільний кеш користувачів)
- modules/counter.js     — дата старту з localStorage (миттєво) + найближча подія зі спільного кешу 'events'
- modules/calendar.js    — кеш 'events' + інвалідація
- modules/budget.js      — кеш tumbo:txs / tumbo:journal / free_limit / savings_goals, паралельний refresh
- modules/capsule.js     — кеш 'time_capsules' + спільні users
- modules/question.js    — кеш відповідей дня 'question:log:DATE'
- modules/media.js       — кеш 'media:<type>' + інвалідація
- modules/swipe.js        — інвалідація 'media:<type>' після додавання через свайп
- modules/random.js       — кеш 'randcats' / 'dishes', паралельний refresh
- modules/shopping.js     — кеш 'shopping:items' + спільні users
- modules/photo-calendar.js — кеш по місяцях 'pcal:YYYY-MM' + спільні users
- modules/wishlist.js     — кеш 'wishlist:<owner>' і 'sizes:<user>'
- modules/map.js          — кеш 'map_pins'
- modules/settings.js     — інвалідація 'sizes:<user>' після збереження розмірів

## Поведінка
- Перший вхід на вкладку: як і раніше (запит → рендер).
- Будь-який наступний перехід: миттєво, без блимання.
- Після додавання/редагування/видалення відповідний ключ скидається → показується свіже.
- Кеш живе в пам'яті вкладки; перезавантаження сторінки очищає його (дата старту лишається в localStorage).

## Що НЕ чіпали
Логіку БД, RLS, Edge Functions, дизайн/CSS, Telegram, TMDB/Mapbox-інтеграції.

---

# Етап 2 — Realtime (живі оновлення від партнера)

## Новий файл
- `lib/realtime.js` — `Realtime`: підписка на зміни в таблицях через Supabase Realtime.
  При зміні скидає відповідний ключ кешу і, якщо вкладка відкрита, перемальовує її наживо.

## Змінені файли
- index.html        — підключено lib/realtime.js, бамп app.js?v=swr2
- service-worker.js  — CACHE: amore-v13 → amore-v14
- modules/app.js     — Realtime.init() у core-bootstrap
- modules/wishlist.js — додано refreshLive() (не скидає під-вкладку «Мої/Партнера»)
- modules/question.js — додано refreshLive() (не стирає набраний текст відповіді)

## ⚠️ ОБОВ'ЯЗКОВО на боці Supabase
Realtime працює лише для таблиць у публікації `supabase_realtime`.
Виконай у SQL Editor (один раз):

    alter publication supabase_realtime add table
      events, transactions, free_limit, savings_goals, time_capsules,
      daily_question_log, media_items, randomizer_categories, dishes,
      wishlist_items, user_sizes, shopping_items, photo_calendar, map_pins;

(Якщо якась таблиця вже додана — Postgres дасть помилку лише на неї; додавай по одній за потреби.)
RLS-політики мають дозволяти SELECT — інакше realtime мовчки не спрацює.

## Перевірка
Відкрий портал на двох пристроях під різними юзерами. Зміна (нове бажання,
позначка «куплено», відповідь дня тощо) має з'явитись у партнера без оновлення сторінки.
У консолі при вході має бути: `[Realtime] підключено ✓`.

---

# Етап 3 — Прибрано подвійний рефетч на власних мутаціях

## Що було
Локальна зміна: інвалідація + рефреш (запит A). Потім realtime-луна тієї ж
зміни → ще одна інвалідація + рефреш (запит B). Запит B — зайвий.

## Як прибрано (lib/realtime.js, без правок у модулях)
- Перехоплено локальні записи: `supabase.from(table).insert/update/upsert/delete`
  тепер позначають таблицю як «свою зміну» (`Realtime.markSelf`). Читання (.select) не зачіпаються.
- У realtime-обробнику додано перевірку `isSelfEcho(table)`: якщо подія по таблиці
  прийшла протягом 2.5 с після власного запису — це наша луна, рефетч пропускаємо.
- Партнерські зміни через цей клієнт не проходять → ніколи не глушаться.

## Змінені файли
- lib/realtime.js   — self-write позначка + перехоплювач записів
- index.html        — бамп realtime.js?v=2
- service-worker.js  — CACHE: amore-v14 → amore-v15

Жодних додаткових кроків на боці Supabase цей етап не потребує.

---

# Етап 4 — Фікс вирівнювання іконок (CSS)

## Симптом
Маркери на карті виглядали зміщеними вгору; іконки на кнопках свайпу «вилазили» зверху.

## Причина
У круглих елементах стояло `align-items: flex-start` → вміст притискався до верху кружечка
замість центру. (Не пов'язано з кешем/realtime — це окремий давній CSS-нюанс.)

## Виправлено (styles/components.css: flex-start → center)
- .map-marker            (емодзі категорії в маркері)
- .swipe-action-btn      (📋 ✕ ▶ ✅ під карткою свайпу)
- .swipe-poster-placeholder (🎬, коли немає постера)

## Змінені файли
- styles/components.css  — три правила align-items
- index.html             — components.css?v=12 → ?v=13
- service-worker.js       — SHELL ?v=13, CACHE amore-v15 → amore-v16
