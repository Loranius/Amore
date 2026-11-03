# Evolution Engine — Claude Code Project Instructions

## Mission

This repository implements the Evolution Engine defined in `docs/`. The specification is normative. Code is correct only when its behavior is traceable to a documented requirement and verified by tests.

## Required Reading

Before changing code:

1. Read `docs/00_GOVERNANCE/AI_EXECUTION_REQUIREMENTS.md`.
2. Read `docs/00_GOVERNANCE/REFERENCE_IMPLEMENTATION_PROFILE_TYPESCRIPT.md`.
3. Read `docs/01_CONTRACTS/DETERMINISM_STANDARD.md` and `docs/01_CONTRACTS/TESTING_VALIDATION_STRATEGY.md`.
4. Read the current volume in `docs/02_VOLUMES/` and its checklist in `docs/03_CHECKLISTS/`.
5. For Amore crystal work, read `docs/01_CONTRACTS/CRYSTAL_ATTACHMENT_INTEGRITY_PROFILE.md`.
6. Before changing a product module, read `docs/MODULE_STATUS.md` — it states what each module's current state is, what "done" means, and which defects CI already knows about. Update it in the same change whenever a module's state changes; a status file nobody updates is worse than none.
7. Before changing anything a couple sees, read `PRODUCT.md` and `DESIGN.md`. `PRODUCT.md` is the north star — who this is for, what "успіх" means on each screen, and what the owner has marked immutable. `DESIGN.md` is the committed visual world, and its named rules (Two Accents, Rare Colour, Fredoka Restraint, Shadow Is A Shadow, One Blur) are binding on new UI, not advisory. `.impeccable/design.json` is its machine-readable sidecar: keep the two in step, and never edit the sidecar alone.
8. Read every upstream volume contract used by the task.

Do not load every document without need. Read the index, then open only the relevant normative files.

## Non-Negotiable Architecture

- Volume boundaries are fixed.
- Dependencies point from lower-numbered volumes to their contracts; no volume reads another volume's private mutable state.
- Published states are immutable, versioned, validated, serializable, and hashable.
- Identical canonical inputs, versions, configuration, and seeds produce identical canonical outputs.
- Core packages do not import React, React Three Fiber, browser UI code, Supabase clients, Cloudinary clients, Auth0 clients, or application components.
- Three.js and React Three Fiber belong in adapters and visualization packages only. Existing Amore renderer code SHALL be adapted in place; reference package names do not justify duplicate implementations.
- Current live reactions from product modules into Evolution Engine remain unchanged until the owner explicitly starts the integration phase.
- For fused crystal colonies, raw overlap of independently closed meshes is non-compliant; junction zones, hidden-face removal, sealed external shell, and material isolation are mandatory.
- Supabase/PostgreSQL persist published snapshots and metadata; they are not the authoritative in-memory simulation state.
- Diagnostics and performance timing never affect authoritative hashes or decisions.

## Work Protocol

For every implementation task:

1. Inspect the repository and current git diff.
2. Identify requirement IDs affected.
3. Produce a concise implementation plan before edits.
4. Implement the smallest complete vertical slice.
5. Add or update tests in the same change.
6. Run format, lint, typecheck, unit, contract, determinism, serialization, and build gates that apply.
7. Run `python scripts/validate_documentation.py` when documentation changes.
8. For any change a couple would see, verify it on the running portal with `npm run live -- <route>` before claiming it works, and report what was measured. Read `scripts/live/README.md` first: it lists seven ways a live screenshot has already lied in this project — a stale service worker, missing CORS on textures, no WebGL, an unspoofed device tier, screenshots taken before the scene settles, the React Query devtools button covering the dock so a `--tap` reports success and does nothing, and time itself running about twenty times slow under SwiftShader. The first six are closed in the harness; the seventh cannot be closed, so never make a frame-rate or duration claim from that sandbox.

   Extend that harness rather than writing a second one. A fresh browser context is always a *first* visit, so any behaviour that depends on memory between visits needs `--seed=<key>=<value>`; without it the screenshot shows a screen on which everything is correctly silent.
9. Report changed files, satisfied requirement IDs, commands executed, results, and remaining risks.

## Prohibitions

- No architectural redesign without an accepted ADR.
- No hidden global mutable state.
- No wall-clock dependence, locale-dependent sorting, unordered iteration in canonical output, `NaN`, `Infinity`, or implicit nondeterministic IDs.
- **Nondeterminism has exactly one address.** In `src/engine/**` there is none at all — no `Math.random()`, and no import of `@/lib/entropy` to reach it indirectly. Everywhere else in `src/`, `Math.random()` is called only inside `src/lib/entropy.ts`, where every draw carries a named reason; modules take a function whose name says why the coin is thrown. `src/lib/noRawRandom.test.ts` enforces both halves.

  This replaces a blanket ban on `Math.random()`. That ban could not be obeyed — rolling a random dish *is* the button, confetti without randomness is not confetti, and storage filenames must not collide — so it was not obeyed: fourteen call sites had accumulated under it, each looking innocent. A rule that cannot be followed is not a rule, it is a fiction that hides its own violations. Prefer a boundary someone can check over a prohibition nobody can keep.
- No production placeholders, fake implementations, silent fallbacks, swallowed errors, or tests that assert only that code runs.
- No direct database/network calls inside deterministic evaluation functions.
- No mutation after publication.
- No generated mesh inside Volumes I–IV and no material evaluation inside Volumes I–V.
- No child crystal base cap or internal face may remain externally visible, including from the underside.
- No child material may break through an unrelated host region.

## Completion Standard

A task is not complete until the relevant checklist passes and the implementation report matches `docs/06_TEMPLATES/IMPLEMENTATION_REPORT_TEMPLATE.md`.

## Гра «Дєвочка в городі» (ADR-0239)

Піксельний симулятор життя Лєни, сторінка `game.html` (лише пара 1). Код — `src/features/game/life/`: `sim/` (чиста детермінована логіка й тести), `world/` (мапи), `render/` (Canvas 2D, без Three.js), `ui/`, `games/`, `controller.ts`. Кожна зміна гри — поправкою в кінець `docs/05_ADR/ADR-0239-lena-life-game.md` і словами в рядку «Гра» `docs/MODULE_STATUS.md`. З власником — українською.

**Як власник ставить задачі.** Планів словами він не дає — малює їх у редакторі-артефакті, тисне «Зберегти для Claude» і пише «Готово». Тоді прочитай артефакт (`Artifact` → `read`), візьми `script#plan-data`, перенеси в гру, а тест хай звіряє мапу з планом. Після змін у грі опублікуй редактор знову (той самий файл або `url`) з теперішніми даними, щоб «як зараз у грі» не брехало. Редактори:
- розміри кімнат хати, у клітинках гри: https://claude.ai/artifact/XXxPExnvq8as2Tf1r1r3eg
- план хати (сусідство кімнат): https://claude.ai/artifact/HHfawGHnyBYaueGXDSaQjH
- подвір'я: https://claude.ai/artifact/72SRmBJHU4VguARRwvLUCE
- літня кухня: https://claude.ai/artifact/WeEks4MG1rex8x5nA2SFYM
- погріб: https://claude.ai/artifact/9L6DTHYHEFWdP9awKx87MU

**Мапи.** `world/build.ts` `MapBuilder`; ґрунти — `world/types.ts` (`x` порожнеча, `W` стіна зі шпалерами, `f` підлога, `e`/`S` земля й бутова стіна погреба). Кімната всередині: ліва колонка — стіна з сусідом, верхні ряди — задня стіна. Меблі в домі ×1.25 (`INTERIOR_FURNITURE`). Точки появи — цілі клітинки; кожна мапа проходить `assertReachable` у `world/maps.test.ts`. Садиба в Жилинцях: `yard.ts`, `kitchen.ts`, `cellar.ts`, хата — `interior.ts` (`HATA_ROOMS`, `HATA_DOORS`); вхід і вихід — `enter*` / `enterYard(spawn)` у контролері. Облаштування кімнати Лєни зберігається в рамці 16×12 (`ROOM_FLOOR`, `DEFAULT_SPOT`), у хаті його розкладає `hataSpots` — формат сейву не міняй. Усередині порожнеча впритул до кімнати малюється верхом стіни (`isWallTop`), поза будинком — темрява; підлоги хати: `f` дошки, `o` фарбована веранда, `l` глиняна долівка (`HATA_FLOORS`). Город — ділянки `GARDEN` (`yard.ts`, `MapBuilder.crop`, `render/crops.ts`): низькі культури в землі, кукурудза й помідори — прохідні пропи; мама порається лише на низьких.

**Живі.** Мама — розклад `sim/mom.ts`, рух `updateMom` (ліжко в хаті / подвір'я / кухня). Бася — `sim/dog.ts` (5 с бігає, 3 с за Лєною, 30% перечепитись, 1 с лежить), аркуш `render/assets/hd/basia.png` із PixelLab (персонаж «Бася HD»); поки він вантажиться, Басі ще нема. Кури й півень — `sim/birds.ts` (стоять, дзьобають, ходять біля свого місця, тікають від Лєни й Басі), місця — `map.birds` (`MapBuilder.bird`); аркуш 32×32 (на подвір'ї й у курнику, `drawHen`) збирає `scripts/pixellab/build_birds.py` з персонажів PixelLab «Курка біла», «Курка коричнева», «Півень», а `scripts/pixellab/birds.test.mjs` звіряє аркуш із кадрами, які обирає поведінка. Випадковість у грі — лише `rngFor(seed, 'причина', …)`.

**Маркери взаємодій** — `render/markers.ts`: значок кожної зони береться з її дії (`markerKind`), тож нова дія — нова гілка там і піктограма в `icons.ts`; `markers.test.ts` ловить зону без значка й значки, що налазять один на одного. Зона, де Лєна стоїть, — жовте кільце на землі (`ringSpot`, `drawGroundRing`), не пляма на всю зону.

**Падіння від Басі** — `render/fall.ts`, фази й тривалості — `fallPhase` у `sim/dog.ts`. Кадри — смуги `assets/hd/lena-*-fall.png`: кадр «праворуч» з аркуша порту, повернутий навколо стоп суперсемплінгом (`scripts/port/import_game1.py`), кадри на лінії стоп. Одяг з шафи лежачи й у позах перефарбовується за масками `*-fall-mask.png` / `*-poses-mask.png`, які повертаються разом з кадром.

**Міні-ігри садиби** — `games/farm.ts` (сад, город, курник, рибалка), нагорода — `sim/farm.ts` (`farmReward`): гра лише рахує `tally`, а заняття без зіграного (`Played` у `doActivity`) не зараховується. Ціни 1/2/3 ₴, 15 у кошику, 20 яєць зі швидшанням щоп'ятого — слова власника, тримай їх у тестах. Поле на телефоні стоячи ~274×564, на комп'ютері ~256×114: стоячи сцени розкладено інакше (склепіння крон замість дерев-тичок, грядки 3×5, лоток яєць) і вдвічі крупніше (`sceneZoom`, `zoomed`), тож дивись обидва: `game-shot.mjs phone|wide "village||game:farm:<id>:0"`. Лєна й мама в іграх — з аркушів 32×32 (`games/farmLena.ts`): сад — обличчям до нас, курник і рибалка — пози з руками перед собою (`assets/hd/lena-*-poses.png`, PixelLab `skeleton-v3` з порожніми руками — кошик малює код тим самим пікселем, `artScale`), точки долонь у таблиці `peopleHd.ts`; кінці жолобів курника — від кошика в позі (`coopSpot`). Код-Лєна `lenaWithBasket` лишилась лише на мить, поки аркуш вантажиться: від її кошика залежить, куди падають фрукти й яйця. Усіх персонажів одним аркушем в одному масштабі показує `game-shot.mjs wide "lineup:<ім'я>"`.

**Мамина хата** — `momHata`: поки Лєна живе в Жилинцях, це її хата; після переїзду — гості (без ліжка, шафи, облаштування й речей з нового житла), табличка HUD — `placeTitle`.

**Лише 32×32** (власник 2026-10-31: «повністю відмовляємось від 16×16»; перемикача `?art=hd` і кнопки «HD» більше нема — не повертай). Уся гра малюється зі щільністю 2 (`ART_DENSITY` у `pixel.ts`; `canvasAt`, `densityOf`, `dot`), деталі — у `tilesHd`/`buildingsHd`/`propsHd`, масштаб сцени — парний. Міні-ігри ділять полотно зі світом, тож `Kit.begin` ставить щільність 1. **Люди** (власник 2026-11-03: «персонажі завеликі для декорацій… адаптувати в новому стилі Лєну, маму, Діму й Олю») — усі з Godot-порту гри (`Documents/game-1`): `scripts/port/import_game1.py <тека game-1>` зводить вбрання й зачіску в аркуш 56×56 (9 кадрів: стоїть і 8 ходи, 11 за секунду), піксель порту — піксель малюнка, як у будинків: дорослий 37 пікселів малюнка при клітинці мапи 32. Таблиця аркушів — `peopleHd.ts` (`SHEETS`, мешканці й перехожі — `FOLK`, `folkSheet`: стать, вік, зачіска, сиві — бабусею чи сивим, далі хеш кольорів; жоден перехожий не носить вбрання Лєни, Олі чи батьків Діми). Люди малюються лише аркушами — на мапі, у міні-іграх (`Kit.person` → `drawPersonHdFrame`, піксель — `hdArtScale`, `hdWalkCol`) і в портретах (`Portrait` → `hdPortrait`, `PORTRAIT_CROP`); поки аркуш вантажиться, людини не видно. Лєна ще має маску одягу (`lena-*-mask.png`: червоний — верх, зелений — низ; з шару вбрання порту), за якою `outfitHd.ts` перефарбовує куплене, падіння й пози (передпліччя домальоване кодом, місце руки — з кадру ходи, де рука позаду), точки долонь — `assets/hd/port.json`. Аркуш упізнає Лєну за волоссям, зачіскою, шкірою й очима, тож перехожий її двійником бути не може (`townsfolkLook`, тест у `peopleHd.test.ts`). PNG людей перевіряє `scripts/port/people.test.mjs` (стопи на лінії, маска в кожному кадрі, падіння в клітинці, долоні). Ставлячи нового персонажа, дивись його поруч з рештою в справжньому масштабі: `game-shot.mjs wide "lineup:<ім'я>"`. 2D-стиль власник відхилив — не повертай.

**Малювання.** `render/pixel.ts`: тіні зсуваються по тону (`shade`), обвідка з рампи (`outline`), близькі кольори зливаються (`mergeNearDuplicates`) — тож тон дошки чи черепиці мусить відходити від основного далі за `NEAR_DUPLICATE`, інакше мовчки зникне. У 32×32 фактура — рисками й купками, не поодинокими крапками (ті читаються шумом і пунктиром); трава надворі — окремим проходом `lawnHd` (латки — пороги плавного поля `lawnField`). Дахи прив'язані до світу, щоб будівля з частин не виглядала порізаною. Референси власника (зокрема тайлсети Stardew) — лише для прийомів; пікселі не копіюй.

**Перевірка наживо.** `node scripts/live/game-shot.mjs wide "village||js:c.life={...c.life,home:'zhylyntsi'}; c.enterCellar(); c.worldFrame=function(){}"` — `c` це `window.__lifeGame`, кадри в `.live/game/`. Сценарій `png:<ім'я>:<пора>` після входу на мапу зберігає всю мапу одним PNG без людей (піксель малюнка — піксель файлу): так текстури порівнюються по всьому подвір'ю, а до й після — піксель у піксель. Подивись кадр через Read, перш ніж казати «готово». GitHub Pages кешує ~10 хв; iframe гри отримує URL збірки (`gameSrc.ts`, `__BUILD_ID__` у `vite.config.ts` і `vitest.config.ts`).

**Доставка.** Після `bash scripts/quality-gate.sh` власник хоче пуш і в робочу гілку, і в `main` (`git push origin HEAD:main`).

**MCP.** `.mcp.json` підключає `threejs-devtools-mcp` (версія закріплена; для 3D-порталу, не для гри), `pixellab` (HTTP, ключ — зі змінної `PIXELLAB_API_TOKEN` у секретах середовища; ключ ніколи не потрапляє в репозиторій), `pxcli` (малювання пікселями) і `pixelart-tiles` (тайли й тайлсети) — версії закріплені. Піксельні навички в `.claude/skills/`: `pxl-pixel-art` (crsolver/claude-pxl, MIT — спрайти кодом, `node .claude/skills/pxl-pixel-art/bin/pxl.js`), довідники `pixel-art` і `pixel-art-sprites` (omer-metin, Apache-2.0), `aseprite-pixel-art-*` (willibrandon/pixel-plugin, MIT — працюють лише з Aseprite і її MCP, яких у хмарі нема). Це поради, а не правила: стиль гри задають PixelLab-аркуші й правила вище.
