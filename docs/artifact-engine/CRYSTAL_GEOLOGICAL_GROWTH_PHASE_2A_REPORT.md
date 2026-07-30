# Crystal Geological Growth — Phase 2A Implementation Report

## Scope

Introduce deterministic Growth Centers for Crystal Species so one evolution formation no longer produces one isolated body. Each stable event formation now produces one compact local crystal colony containing:

- one dominant crystal that preserves the original formation identity;
- one to three local satellite crystals;
- one to three micro-growth or inclusion bodies.

This phase changes logical growth structure and placement only. It does not yet replace the current prism geometry, create a fused junction shell, add fractures, or change renderer materials.

## Pipeline

Previous pipeline:

```text
evolution formation
  -> one Universal Growth instruction
  -> one crystal body
```

Phase 2A pipeline:

```text
evolution formation
  -> deterministic Growth Center
  -> dominant crystal
  -> local satellites
  -> local micro-growth
  -> compact Surface Atlas reservations around the same center
```

## Stable Identity Rules

The original formation ID remains the dominant body ID. Derived members use stable IDs:

```text
<formation-id>:satellite:<index>
<formation-id>:micro:<index>
```

Member seeds, dimensions, archetypes, directions and burial values depend only on the original formation seed, role and local index.

Each source formation reserves a fixed sequence stride of eight. Adding a later event therefore cannot insert new members between historical centers or reorder existing bodies.

## Center Composition

Center size is deterministic and bounded between three and six bodies including the dominant crystal.

- emphasized event spire: dominant + 2–3 satellites + 2 micro bodies;
- normal satellite formation: dominant + 1–2 satellites + 1–2 micro bodies;
- inclusion formation: dominant + 1 satellite + 2–3 micro bodies.

Local supporting bodies are always smaller than their dominant crystal.

## Placement Behaviour

The dominant member selects its location from the complete aggregate Surface Atlas introduced in Phase 1B.

Supporting members then receive a Growth Center placement context:

1. prefer active or exposed regions owned by the same Growth Center;
2. otherwise use nearby aggregate regions inside a deterministic influence radius around the dominant body;
3. use global Surface Atlas regions only as a last fallback.

Candidate priority adds bonuses for:

- a host already belonging to the same center;
- attachment directly to the dominant body;
- spatial proximity to the dominant anchor.

All selected regions remain uniquely reserved through `surfaceRegionId`.

## Public Contracts

Added:

- `GrowthCenterRole`;
- `UniversalGrowthCenter`;
- `GrowthCenterState`;
- optional `growthCenterId` and `growthCenterRole` on instructions and bodies;
- optional `growthCenters` on Universal Growth blueprints and Growth State v1.

The fields are optional so older serialized Growth State v1 snapshots and non-crystal adapters remain readable.

## Files Changed

- `src/engine/growth/types.ts`
  - Growth Center contracts and backward-compatible provenance fields.
- `src/engine/species/crystal/growthAdapter.ts`
  - deterministic expansion from one formation into one local center.
- `src/engine/growth/engine.ts`
  - center validation, local candidate domain, relative generations and derived center state.
- `src/engine/growth/index.ts`
  - exports the new public contracts.
- `src/engine/species/crystal/growthAdapter.test.ts`
  - covers deterministic expansion, stable member identity and sequence strides.
- `src/engine/growth/engine.test.ts`
  - covers local hosting, unique reservations, append-only history and safe truncation.

## Compatibility Boundaries

- Tree and Reef continue using the legacy host-first candidate algorithm.
- Crystal uses aggregate Surface Atlas placement and Growth Centers.
- `hostBodyId`, `hostT` and `hostAngleRad` remain available to the current Geometry and Fusion layers.
- `growthStateVersion` and `surfaceMapVersion` remain version 1.
- the original dominant formation IDs remain unchanged.

## Verification Performed

Strict isolated TypeScript compilation passed with:

- `strict`;
- `noUncheckedIndexedAccess`;
- `exactOptionalPropertyTypes`;
- `noUnusedLocals`;
- `noUnusedParameters`;
- `verbatimModuleSyntax`;
- `isolatedModules`.

Deterministic manual harness results:

- three event formations generated three centers;
- sample center sizes were 6, 4 and 5 bodies;
- every non-root body reserved a unique Surface Atlas region;
- every supporting member attached to a body in its own Growth Center;
- reversing the universal instruction array produced byte-identical Growth State;
- appending a later event left all historical bodies byte-identical.

A complete repository checkout was unavailable in the connector environment. Full `npm test`, `npm run typecheck` and production build are therefore not claimed as executed.

## Remaining Risks

- More bodies now reach the current prism-based Geometry Engine, so the structural improvement can expose existing visual limitations more clearly.
- Growth Shadow is not yet applied; large local crystals do not yet suppress neighbouring growth strongly enough.
- Local density affects Surface Atlas scores, but colony-level density and maturity do not yet reshape member sizes after nucleation.
- Junctions are still independent overlapping meshes with trimming rather than a continuous mineral shell.

## Next Safe Task

Phase 2B: implement Growth Shadow and local competition around every Growth Center. Large mature crystals should reduce nearby growth potential, push later members toward available gaps, limit overcrowding and create more believable empty and dense areas before Geometry V2 begins.
