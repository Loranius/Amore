# Reef Phase 12 — Foundation / Seafloor Pass

## Мета

Прибрати вигляд ідеально круглого підноса та зробити accepted foundation природною кам’яною основою рифу без зміни Reef Species, topology або production budgets.

## Renderer-only pass

`applyReefFoundationPresentation(scene, build)` запускається після Phase 10 colony presentation і до Phase 11 material presentation.

Pass змінює лише наявний foundation position/normal buffer:

- три великі та сім дрібних bounded берегових хвиль ламають круглий контур;
- нижнє кільце звужується, формуючи похилий кам’яний skirt замість вертикальної стінки;
- top surface отримує невеликий детермінований shelf/cross-current relief;
- біля accepted foundation attachments додаються локальні посадкові подушки, які візуально з’єднують колонії з основою;
- нижній край має невелику нерівномірність глибини;
- normals і bounds перераховуються після скульптингу.

## Незмінні контракти

- source `ReefFoundationMeshState` не мутується;
- accepted foundation vertices, triangles, indices, patches та attachments збережені;
- colony IDs, mesh ranges, positions і motion bindings не змінені;
- один foundation geometry object і один foundation material object;
- без нових draw calls, materials, textures, shaders або per-frame updates;
- Phase 9 production signature залишається accepted;
- Supabase, Crystal і Tree не змінені.

## Diagnostics

Home Reef публікує:

- `data-reef-foundation-presentation="reef-foundation-v1"`;
- `data-reef-foundation-pass="phase-12-foundation-seafloor"`.

## Acceptance

Перед роботою збережено Pixel 8 Pro baseline Phase 11. Після завершення PR знімається новий Pixel 8 Pro screenshot із тією самою камерою, viewport і portal history. Merge дозволений лише після зеленого CI та ручного before/after review відповідно до `ARTIFACT_VISUAL_ACCEPTANCE_WORKFLOW.md`.
