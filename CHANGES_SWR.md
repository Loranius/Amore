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
