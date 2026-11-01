# ADR-0257 — Прибирання репозиторію: мертві файли, експорти, стилі й залежності

- **Статус:** Accepted
- **Дата:** 2026-11-01
- **Спирається на:** ADR-0038, ADR-0207 (§4 «Старі стилі модуля не прибрані»),
  ADR-0256 («`PlanCard.tsx` і `planGroups.ts` були без викликачів»)
- **Зачіпає:** `src/components/icons/*`, `src/features/**` (лише видалення
  невикликаного коду й правил CSS), `src/lib/queryKeys.ts`, `vite.config.ts`,
  `vitest.config.ts`, `package.json`, `package-lock.json`
- **Видалено:** `src/components/ui/ViewPicker.tsx`,
  `src/features/home/SceneDecorationBoundary.tsx`,
  `src/features/plans/PlanCard.tsx`, `src/features/plans/planGroups.ts`
  (+ тест), `src/features/plans/plansOverview.css`,
  `src/features/plans/plansMotion.css`,
  `src/features/wishlist/wishlistCardProduct.css`,
  `public/models/glow_whale_native/` (15 частин) і його ліцензія
- **Не зачіпає:** бізнес-логіку, схему бази, міграції, RPC, Edge Functions,
  `.env`, рушій (`src/engine/**`), публічні контракти томів, вигляд будь-якого
  екрана

## Контекст

Аудит технічного боргу на запит власника: прибрати сміття, нічого робочого
не втративши. Вихідна точка — `knip` (файли, експорти, залежності) і власний
сканер CSS-класів, а потім **ручна перевірка кожної знахідки**: що файл не
вантажиться динамічно, не підключений із HTML, не читається тестом як текст
і не названий у плані.

Хибні знахідки `knip`, які лишено: усі `src/labs/*.tsx` і
`src/features/game/life/main.tsx` (вантажаться зі своїх `*-lab.html` і
`game.html`); імпорти `/src/...` у `scripts/live/game-shot.mjs` (їх
розв'язує dev-сервер у браузері).

## Рішення

1. **Файли без жодного викликача видалено.** `PlanCard` і `planGroups` —
   ADR-0256 уже фіксував їх як мертві. `ViewPicker` замінили власні
   перемикачі модулів. `SceneDecorationBoundary` охороняв зграю риб старої
   сцени рифу; сцена, що вантажила модель, прибрана, і межа лишилась без
   дитини.
2. **Експорти, на які немає жодного посилання ні в коді, ні в тестах, ні в
   скриптах, видалено** — лише поза `src/engine/**`: значки категорій міток і
   серце (`MapIcon.tsx`, жили для видаленого `mapMarkers.ts`), шість інших
   значків, хуки `usePerson`, `useFinishedMedia`, `useScheduleTogetherness`
   (і його ключ запиту), сталі `MARK_CYCLE`, `VISIBLE_LINKS`, `LENA_FOR_GAMES`,
   `ZERO_VEC`, `lodPolicy`, функції `dayPhase`, `portalSpinMoving`,
   `readWishlistView`, `removeGiftMemoryAssets`.
3. **Мертвий CSS прибрано.** Два файли стилів «Планів» (`plansOverview.css`,
   852 рядки; `plansMotion.css`, 357) не імпортувались нікуди — це те
   прибирання, яке ADR-0207 §4 відклав «окремою роботою». В імпортованих
   стилях видалено правила, кожен селектор яких вимагає класу, що не
   трапляється в жодному `.ts`/`.tsx`/`.html`: такий елемент у DOM не
   з'являється, тож вигляд не змінюється. Селектори, де мертвий клас стоїть
   у `:not()`/`:is()`/`:has()`, лишено — там видалення змінило б зміст.
   Класи MapLibre (`maplibregl-*`) лишено: їх ставить бібліотека.
4. **Залежності.** `postprocessing` прибрано з прямих залежностей: код його
   не імпортує, а `@react-three/postprocessing` тягне його сам (версія в
   lock-файлі та сама, 6.39.3). `three-stdlib` (імпортують п'ять сцен) і
   `postcss` (читають два тести правил CSS) стояли лише транзитивно —
   тепер названі явно, тими самими версіями, що вже встановлені.
5. **Тест, який ніколи не запускався.** `WishlistBubbleCard.test.tsx` не
   потрапляв під `include` vitest (`*.test.ts`). Шаблон розширено до
   `*.test.{ts,tsx}`; тест проходить.
6. **Ресурс без завантажувача.** Низькополігональний кит
   `glow_whale_native` не вантажився жодним кодом (кит вулкана малюється
   процедурно); прибрано разом із правилом кешу PWA для нього.

## Виміряно

- Збірка з `BASE_PATH=/Amore/`: CSS у `dist/assets` 530 133 → 496 944 байт
  (−33 189, −6,3%); JS 9 150 155 → 9 150 044 байт (мертві експорти й так
  відкидав tree-shaking). `verify:pages-build` — зелений.
- `npm test`: 369 файлів, 3638 перевірок — зелені (`planGroups.test.ts`
  пішов разом із кодом, `WishlistBubbleCard.test.tsx` додався).

## Не зроблено навмисно

- `useCityBackfill` (`memories/useMapPins.ts`) і `setWishlistProcessedImage`
  (`wishlist/wishlistRpc.ts`) — мертві, але пишуть у базу; можливо, це
  від'єднана функція, яку варто повернути, а не стерти. Рішення власника.
- Невикористані експорти в `src/engine/**` (`dispose*`-функції текстур,
  сталі шапок росту) — рушій під нормативною специфікацією, його публічні
  контракти не чіпаються без окремого рішення.
- `school_of_fish_reef.glb` досі матеріалізується в CI
  (`scripts/reef/materialize_school_fish.sh`), хоча сцена його не вантажить.
  Прибирання — зміна трьох робочих потоків; окремо.
- `public/textures/reef/coral_stone_diff_1k.webp` (свідомо не береться,
  `reefStoneSurface.ts`) і `public/assets/reef/volcano/volcano-reference-albedo.webp`
  (призначення не встановлено) лишено.
- `heic2any` поруч із `heic-to` — свідомий запасний конвертер HEIC.
- Жива перевірка `npm run live` не проводилась: у середовищі немає
  `.env.live`. Аргумент, що вигляд не змінився, — статичний (видалено лише
  правила для класів, яких немає в розмітці).
