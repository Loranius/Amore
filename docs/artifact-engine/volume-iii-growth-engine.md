# Artifact Engine Documentation — Volume III: Growth Engine

## Purpose

Universal procedural growth engine.

## Philosophy

Species Layer defines **what** grows. Growth Engine defines **how** it grows.

## Architecture

```
Evolution Engine → Species Layer → Growth Instructions → Growth Engine → Growth State → Geometry Engine
```

## Responsibilities

Growth · Nucleation · Attachment · Competition · Colonies · Hierarchy · Stabilization · Aging.

## Core Principles

Deterministic · Append-only · Renderer independent · Physics independent · Surface-based growth · Species agnostic.

## Internal Modules

Growth Sites · Surface Map · Attachment Solver · Competition Solver · Density Solver · Stress Solver · Colony Solver · Generation Solver · Growth Order · Growth State.

## Long-term Vision

Universal engine for crystals, trees, corals, mascots, islands, constellations and future procedural organisms — the engine never knows which; it only consumes Growth Instructions.

---

## Додаток: Реалізація в кодовій базі

Рушій живе в `src/features/home/artifact/growth/` і оркеструє спільні
solver-модулі на рівні `artifact/`. Вхід — `GrowthInstruction` (Volume II,
`species/`); вихід — явний `GrowthState`, який Geometry Engine (`crystal3d/`)
перетворює на меши.

| Внутрішній модуль (спека) | Код |
|---|---|
| Growth Sites / Surface Map | `growthSurface.ts` — `sampleSurfacePoint`, `SurfaceBody`, `radiusAtT` + фіксований K-кандидатний цикл у рушії |
| Attachment Solver | рулетка `growthField.ts::scoreGrowthSite` + `growth/growthEngine.ts::buriedAnchors`/`inheritDirection` |
| Stress Solver | `growthField.ts::surfaceStress` |
| Density Solver | `growthField.ts::localDensity` (+ density-term у `scoreGrowthSite`) |
| Competition Solver | `growthField.ts::growthEnergyAt` (Growth Shadow) + `composition/framework.ts::competitionPass` |
| Colony Solver | блок акреції колонії в `growth/growthEngine.ts::depositMineral` |
| Generation Solver | розміри тіла (girth/monarch/mound) в `depositMineral`, керовані `CrystalConstraints` (Species Layer) |
| Growth Order | ітерація `instruction.streams` у `runDeposition` (заморожений субстрат = append-only) |
| Growth State | `growth/growthTypes.ts::GrowthState` — `{ bodies, order, score, passes }`; вхід — `runGrowth(input)` |
| Hierarchy / Stabilization / Aging | пост-проходи `composition/` (framework/mineralPreset/score) |

**Species-agnostic вхід:** `growth/growthEngine.ts::runGrowth` не знає, що
вирощує — усі видові числа приходять крізь `GrowthInstruction`
(`constraints`, `streams`, `fieldAt`, `hierarchy`). Geometry-Engine handoff —
`toArtifactNode` (Growth State → `ArtifactNode`), далі `crystal3d/`.

**Спільні solver-модулі** (`growthField.ts`, `growthSurface.ts`) лишаються на
рівні `artifact/`, бо Species Layer замикає `placementFieldAt` у
`instruction.fieldAt` — тримати їх під `growth/` створило б зворотний імпорт
Species → Growth. Заголовки цих файлів названо за їхніми Vol III ролями.

Наступний вид (`treeSpecies.ts` тощо) підставляє власні `GrowthInstruction`
і власне тіло; механіка Growth Engine (нуклеація/attachment/competition/
colony/order) не змінюється — саме це й робить рушій універсальним.
