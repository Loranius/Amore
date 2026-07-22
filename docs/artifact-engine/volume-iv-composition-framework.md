# Artifact Engine Documentation — Volume IV: Composition Framework

## Mission

The Composition Framework transforms a technically correct growth result into a visually convincing natural artifact. It never creates the history of the artifact, never decides *why* something grows — it decides **how the finished artifact should look as a whole**.

## Responsibilities

Hierarchy · Silhouette · Balance · Density · Negative space · Crystal families · Competition · Geological realism · Visual rhythm · Micro details.

## Pipeline

```
Evolution Engine → Species Layer → Growth Engine → Composition Framework → Geometry Engine → Material & Shader Engine → Life Engine
```

## Internal Modules

1. **Hierarchy Engine** — King → Support → Family → Companion → Micro. One dominant focal point only.
2. **Silhouette Engine** — a readable outline (Tower/Diamond/Cathedral/Cascade/Fan/Brush/Cluster). Avoid radial symmetry.
3. **Density Engine** — dense vs sparse zones, breathing space, contrast.
4. **Competition Engine** — older dominates; the younger shrinks/bends/breaks/becomes a companion. Older never changes.
5. **Colony Engine** — one dominant may spawn satellites/twins/blades/micro clusters.
6. **Archetype Engine** — deterministic morphology (Massive/Needle/Blade/Tabular/Twin/Broken/Split/Intergrown/Etched).
7. **Geological Mass Engine** — one continuous body: buried bases, shared volume, overlap, intergrowth, invisible origins.
8. **Negative Space Engine** — never fill every gap; keep breathing room.
9. **Micro Detail Engine** — micro crystals/dust/tiny twins to increase perceived scale.
10. **Composition Scoring** — hierarchy/silhouette/density/rhythm/balance/realism/flow; below threshold → rerun passes (max 2).

## Determinism

Deterministic. May modify only decorative crystals, companions, micro details. Additions never disturb an existing crystal's final form.

## Future Species Support

Species-agnostic. Future presets (Crystal/Tree/Island/Constellation/Coral/Mascot/…) change only preset rules; the framework never changes.

## Final Goal

The viewer should immediately recognize: *"This artifact could have been created by nature."*

---

## Додаток: Реалізація в кодовій базі

Фреймворк живе в `src/features/home/artifact/composition/`:
- **`framework.ts`** — генерик-рушій, знає лише геометрію/ієрархію/напрямки (жодних матеріалів/THREE). Усе предметне — через `CompositionConfig`.
- **`mineralPreset.ts`** — кристалічний пресет (бібліотеки силуетів/архетипів, мапінг DepositedCrystal ↔ CompositionBody, `decorative`/`shielded` прапорці) + `composeMineralCluster`.
- **`score.ts`** — метрики (Composition Scoring).

| Модуль (спека) | Код |
|---|---|
| 1. Hierarchy Engine | `framework.ts::assignTiers` — king/support/family/companion/micro |
| 2. Silhouette Engine | `framework.ts::buildSilhouetteFrame` + `silhouettePass`; пресети в `mineralPreset.ts::SILHOUETTES` (центрально-курганні варіанти fan/cathedral/druse — уникають радіальної симетрії; ще архетипи додаються конфігом) |
| 3. Density Engine | `framework.ts::densityPass` (seeded-сектори rich/sparse) |
| 4. Competition Engine | `framework.ts::competitionPass` — поступається МОЛОДШИЙ; старший недоторканний |
| 5. Colony Engine | архетипні компаньйони у `framework.ts::archetypePass` + колонії Growth Engine |
| 6. Archetype Engine | `framework.ts::archetypePass` + `mineralPreset.ts::ARCHETYPES` (12 форм, вибір з ознак — ніколи випадково) |
| 7. Geological Mass Engine | `framework.ts::massPass` (поховані основи, стиснутий центр) + base burial у Growth Engine |
| 8. Negative Space Engine | `framework.ts::densityPass` (culling надлишку decorative) + `score.ts::negativeSpace` |
| 9. Micro Detail Engine | `framework.ts::microPass` |
| 10. Composition Scoring | `score.ts::scoreComposition`; `composeSpecimen` робить до 2 проходів |

**Детермінізм / «older never changes».** Кожен прохід — чиста функція від
оригінальних значень тіла + фіксованих seed-осей (не data-залежних рангів),
тож повторний прохід ідемпотентний, а додавання даних не зрушує старі тіла
(закріплено append-only тестом). Композиція МОДИФІКУЄ домінанти
(силует/вік/маса), але лише детерміновано й append-only-безпечно:
конкуренція завжди штрафує молодшого, видалення/burial — лише decorative
(`shielded`-віхи недоторканні). Це і є практична форма «never move historical
dominant crystals»: додавання нового кристала ніколи не змінює фінальний
вигляд існуючого.

**Species-agnostic.** `framework.ts` не імпортує ні THREE/React, ні
artifactTypes-домену; майбутній Tree/Coral-пресет підставляє інший
`CompositionConfig` поруч із `mineralPreset.ts`, а сам фреймворк не
змінюється.
