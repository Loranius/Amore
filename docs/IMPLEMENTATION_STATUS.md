# Amore — Implementation Status (Crystal Attachment Integrity slice)

Оновлено: Phase 2. Обсяг за `IMPLEMENTATION_ROADMAP.md` — лише зріз
Crystal Attachment Integrity (Волюми III–VI). Volume VII і нові реакції
продуктових модулів — `DEFERRED_BY_SCOPE`.

## Статус вимог профілю (`CAI-REQ-001..012`)

| ID | Статус | Докази / чому саме так |
|---|---|---|
| `CAI-REQ-001` volumetric reservation | **PARTIAL** | `growthEngine.ts::candidateFits` — капсульна перевірка (вісь+радіус+довжина) перед прийняттям кандидата. Обмеження: перевіряється прогноз тіла (rawLength/rawRadius і оцінений напрямок), бо фактичні розміри залежать від обраного місця. |
| `CAI-REQ-002` deterministic, sector-balanced, non-clumping | **VERIFIED** | Стратифіковані азимути кандидатів (кожен кандидат — свій сектор кола) + мін. кутова сепарація між дітьми одного господаря (`minAngularSeparation`). Детермінізм — тест `attachment.test.ts`. |
| `CAI-REQ-003` intersections only in junction zones | **PARTIAL** | Забезпечено на етапі РОЗМІЩЕННЯ. Композиція (силует/маса/колонії) свідомо зводить тіла назад → залишкові перетини є (виміряно). Резолюція — Vol V trim (див. нижче). |
| `CAI-REQ-004` versioned AttachmentJunction | **VERIFIED** | `composition/attachment.ts`; `GrowthState.junctions`; 6 тестів (рівно один host на дитину, без сиріт, ортонормована рамка, канонічний порядок, детермінізм). |
| `CAI-REQ-005` no child base caps in shell | **PENDING** | Phase 3. Зараз кришки торців є завжди (закривали наскрізні діри); треба вирізати саме ту, що всередині господаря. |
| `CAI-REQ-006` sealed junctions | **PENDING** | Phase 3. |
| `CAI-REQ-007` no unrelated intersections | **NOT MET** | Виміряно: ~20–28% пар несучих тіл перетинаються. Спроби розвести їх у композиції (стискання / поворот осі / ковзання основи по господарю) **не сходяться** і руйнують «одну зрощену масу» — A/B-рендер показав явну регресію вигляду. Профіль §6 прямо дозволяє замість цього локальний trim + прибирання прихованих граней — це Phase 3. |
| `CAI-REQ-008` underside probes | **PENDING** | Phase 3/6 (автоматичні геометричні проби, не скріншоти). |
| `CAI-REQ-009..010` material isolation | **PENDING** | Phase 4. |
| `CAI-REQ-011` LOD integrity | **PENDING** | Phase 5 (LOD-системи в проєкті ще немає). |
| `CAI-REQ-012` publication gating | **PENDING** | Phase 5. |

## Волюми

| Volume | Status | Verified | Примітка |
|---|---|---:|---|
| I Core Simulation | IMPLEMENTED (pre-SAS) | — | `artifact/evolution/`; таймлайн, сили, historical state; тести. |
| II Species Framework | IMPLEMENTED (pre-SAS) | — | `artifact/species/`; SDK виду + `CrystalConstraints`. |
| III Growth Engine | IN_PROGRESS | `V3-REQ-014` ✓, `013/015` partial | `artifact/growth/`; додано об'ємну резервацію та кутову сепарацію. |
| IV Composition | IN_PROGRESS | `V4-REQ-013..015` ✓ | `artifact/composition/`; junction-и публікуються з фінальної геометрії. |
| V Geometry | NOT_STARTED | 0 | `crystal3d/crystalCluster.ts`; наступна фаза — trim/hidden-face/seal. |
| VI Material | NOT_STARTED | 0 | Phase 4. |
| VII Integration | DEFERRED_BY_SCOPE | — | За рішенням власника. |

## Ключове архітектурне рішення (Phase 2)

Спроба досягти `CAI-REQ-007` **розведенням тіл** відхилена за результатами
вимірювань: три стратегії (стискання, поворот осі, ковзання основи) дали
20–31% перетинів (проти 24–30% базових) і при цьому з'їли шпилі — рендер
показав помітно бідніший кристал (44 тіла проти 58). Причина структурна:
композиція навмисно стягує тіла (важкий центр, спільні осі силуету,
поховані основи), бо саме це створює «одну зрощену мінеральну масу», якої
вимагає і власник, і профіль (§7 Geological Mass).

Тому перетини резолвляться там, де це передбачає сам профіль (§6):
**локальний trim + прибирання прихованих граней + зварений шов у Volume V**,
а не фізичним розштовхуванням. Розміщення лишає за собою те, що вміє
дешево: не ставити тіло в явно зайняте місце і тримати кутову сепарацію.

## Гейти

`npm run typecheck` · `npm test` (33) · `npm run build` ·
`python3 scripts/validate_documentation.py` — усі проходять.
