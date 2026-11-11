# ADR-0263 — Друге прибирання: мертві функції, невидимі експорти, мертвий CSS

- **Статус:** Accepted
- **Дата:** 2026-11-11
- **Спирається на:** ADR-0257 (перше прибирання — той самий метод і ті самі
  винятки), ADR-0239 (гра лише 32×32), ADR-0248 (полароїда в «Спогадах» немає)
- **Зачіпає:** 150 файлів у `src/` (лише видалення коду, зняті `export`, правки
  коментарів), `src/lib/images.test.ts`, `src/lib/couplePath.test.ts`,
  `src/features/plans/plans.css`
- **Не зачіпає:** рушій поза явно названим нижче, реекспорти в `index.ts` томів,
  `src/types/index.ts`, базу, Edge Functions, залежності, вигляд будь-якого екрана
- **Вказівка власника (2026-11-10):** «Давай розгребемо сміття в коді, проведи
  повний ресьорч — мертвий код, функції прибираємо, чистимо репозиторій».

## Метод

Як в ADR-0257: `knip` (6.45.0; входи — `src/main.tsx`, усі `src/labs/*.tsx` зі
своїх `*-lab.html`, `game/life/main.tsx` з `game.html`, `scripts/**`) дає
кандидатів, кожна знахідка перевіряється вручну. Далі прийом, якого в
першому прибиранні не було:

1. У кожного позначеного експорту поза контрактом рушію знімається `export`.
2. `tsc` з `noUnusedLocals` / `noUnusedParameters` сам називає оголошення, яких
   не вживає навіть власний файл, — це і є мертвий код; він видаляється, і
   `tsc` повторюється, доки не осиротіє ніщо (помічники мертвих функцій).
3. Решта лишається у файлі, лише без `export`, — поведінка та сама.

Ручна перевірка зняла хибні знахідки `knip`:

- `AuthContext` — його бере `newCoupleLab.tsx` через `import()` у `Promise.all`;
- модулі, які `scripts/live/game-shot.mjs` вантажить через dev-сервер
  (`people.ts`, `peopleHd.ts`, `pixel.ts` …), — звірено поіменно: жодне
  позначене ім'я там не вживається, а все, що вживається, лишилось експортом;
- реекспорти в `index.ts` томів рушію і те, що вони реекспортують
  (`adaptEvolutionSnapshot`, `toEvolutionSourceSnapshot`, `CRYSTAL_LIFE_STAGES`,
  `TREE_LIFE_STAGES`, `yearFill`), — опублікований контракт (ADR-0257).

## Що прибрано

**Мертві функції й дані (не вживались ніде, навіть у своєму файлі):**

- **гра:** старий код-малюнок людей 16×30 у `render/people.ts` — `sheetFor`,
  `walkFrame`, `drawFront`, `drawBack`, `drawSide`, `bodyFront`, `headFront`,
  `hairBehindFront`, `bodyOf`, `hairTones`, `spriteSize`, кеш і кольори облич
  (~400 рядків). Людей з 2026-10-31 малюють лише аркуші 32×32; у файлі лишились
  вигляди персонажів (`LENA_*`, `MOM`, `DIMA`, `OLYA`, `townsfolkLook`).
  Разом із ним осиротів `flipX` у `pixel.ts`;
- **мітки на карті:** `useMapPinMutations` з `uploadPinPhoto` і типом
  `PinUpdate`. У коді вже стояло: «не має жодного споживача», а мітки створює
  `useEnsurePlacePin` (`useMoments.ts`). Таблиця `map_pins` і її читання не
  змінились;
- **бажання:** `useFulfilledWishes` (кристал читає виконані бажання обох
  партнерів своїм запитом) і його сталі кешу;
- **дрібне:** `PolaroidIcon`, `errorMessage` (`lib/errors.ts`),
  `isPlanMetadata` з його переліками (`lib/guards.ts`), `floats`
  (`portalLevitation.ts`), сім невживаних типів (`GameFactory`, `Sheet`,
  `PortalSkyShape`, `NeighbourSkyLayerProps`, `PersonKey`, `WishlistWorldTab`,
  реекспорт `WishlistImageDisplayMode`), `export default` у `RegisterPage` і
  `HistorySweepPage` (обидві вантажаться за іменем).

**Експорти, які вживає лише власний файл, — стали внутрішніми:** близько
240 оголошень у ~110 файлах (сталі гри, шейдерні шматки рифу, ключі
налаштувань, допоміжні функції сцен тощо), і реекспорти, які ніхто не
імпортував (`features/home/artifact/index.ts`, `crystalIsland.ts`,
`useCalendar.ts`, `usePortalSources.ts`). Типи — так само, лише поза рушієм і
поза `src/types/index.ts`.

**Мертвий CSS:** `.plan-cat-grid` і `.plan-cat-btn` (`plans.css`) — класів
немає в жодній розмітці. Ще 19 знахідок сканера — модифікатори, які
складаються шаблоном (`mt-node--${side}`, `sched-cell--${status}` …), вони
живі. Кожен файл стилів хтось імпортує.

**Тести, що читали видалене як текст:** `images.test.ts` (перевіряв, що
`uploadPinPhoto` не ковтає помилку) і `couplePath.test.ts` (що `useMapPins.ts`
завантажує через `couplePath`) — рядки прибрано з поясненням: завантаження
там більше немає.

## Лишено навмисно

- `.github/skills/impeccable` — копія навички для GitHub Copilot, яку ставить
  інсталятор Impeccable (`b454e50`).
- `scripts/models/compress-ruin.mjs` — ручний інструмент, описаний у
  `scripts/models/README.md`; `knip` скаржиться, що його залежностей
  (`@gltf-transform/*`, `sharp`) немає в `package.json`, — їх ставлять лише
  на час перебору асету.
- `scripts/pixellab/build_sheet.py` — без посилань у коді, але це живий ручний
  інструмент аркушів PixelLab, описаний в ADR-0239.
- `postprocessing` у залежностях — урок ADR-0257 (Visual Preview).
- Невживані типи рушію (~120) і `src/types/index.ts` — опублікована поверхня
  томів і центральні типи бази.
- `public/`: усі 11 файлів вантажаться кодом.

## Перевірка

- `tsc` — без помилок; `knip` після прибирання: невживаних експортів поза
  контрактом рушію й `AuthContext` — нуль.
- Повні ворота (`scripts/quality-gate.sh`): 376 файлів, 3755 перевірок,
  еталони Python-двійника, збірка — зелені.
- Статистика: 152 файли, +286 / −993 рядки.
- Жива перевірка не проводилась (`.env.live` у пісочниці немає); аргумент, що
  вигляд не змінився, — статичний: видалено лише код без викликів і правила
  CSS для класів, яких немає в розмітці.
