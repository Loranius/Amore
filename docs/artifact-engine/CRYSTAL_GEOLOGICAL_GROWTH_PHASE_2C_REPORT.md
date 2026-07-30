# Crystal Geological Growth — Phase 2C Implementation Report

## Scope

Introduce a deterministic geological burial and Growth Center maturation layer for Crystal Species.

Later Growth Centers can now partially cover the lower portions of older bodies without deleting, moving, resizing or mutating the historical `GrowthBody` records. Stable upper tips remain visible and the resulting metadata is published to Crystal Geometry/Fusion consumers.

This phase does not yet deform meshes, alter profile rows, create a fused shell or change materials. It prepares those systems with explicit geological metadata.

## Pipeline

Previous Phase 2B pipeline:

```text
Growth Center placement
  -> Surface Atlas
  -> Growth Shadow
  -> local competition
  -> immutable GrowthBody records
```

Phase 2C pipeline:

```text
immutable GrowthBody records
  -> chronological body ordering
  -> later-center lower-shell coverage
  -> per-body geological burial metadata
  -> per-center maturation metadata
  -> Crystal Geometry State
```

## Append-only Model

Burial is a derived current-state layer rather than a mutation of `GrowthBody`.

A later event may legitimately change the burial metadata of an older body, but it cannot change that body's:

- ID;
- anchor;
- direction;
- skeleton dimensions;
- rendered dimensions;
- original attachment;
- seed;
- generation;
- Growth Center identity.

This preserves historical byte stability while allowing the visible geological mass to become layered over time.

## Burial Eligibility

A body may cover another body only when all of the following are true:

1. the covering body is chronologically later by stable `sequence` and code-point ID ordering;
2. the covering body belongs to a non-null Growth Center;
3. the covering body belongs to a different Growth Center from the target;
4. the lower analytical shell of the covering body reaches one or more sampled points on the target.

Members of the same Growth Center do not create geological burial. Their overlap remains local nucleation/intergrowth and is handled by attachment and future fusion logic.

## Coverage Sampling

Each target body is sampled along six low-to-middle axial positions:

```text
0.04, 0.12, 0.22, 0.34, 0.48, 0.62
```

Lower samples receive greater weight. Coverage is measured against the lower 44% of each later covering body.

The contribution depends on:

- distance to the covering body's lower analytical shell;
- covering radius and length;
- attachment penetration depth;
- relative size;
- maturity;
- growth energy;
- tier;
- Growth Center role;
- chronological distance.

Multiple contributions combine through transmission rather than direct addition, keeping the result bounded in `[0, 1]`.

## Visibility Guarantees

Burial is role-sensitive and capped so stable tips remain visible:

- mother/king body: maximum burial ratio `0.34`, minimum visible ratio `0.66`;
- dominant body: maximum burial ratio `0.48`, minimum visible ratio `0.52`;
- satellite body: maximum burial ratio `0.68`, minimum visible ratio `0.32`;
- micro-growth: maximum burial ratio `0.82`, minimum visible ratio `0.18`.

Burial below `0.015` is normalized to zero to avoid meaningless floating-point noise.

## Body Metadata

Every body receives a `CrystalBodyBurialState` containing:

- `bodyId`;
- `growthCenterId`;
- Growth Center role;
- `burialRatio`;
- `buriedLength`;
- `exposedLength`;
- `exposedTipRatio`;
- weighted `baseCoverage`;
- burial classification: `exposed`, `embedded` or `deeply-buried`;
- IDs of covering bodies;
- IDs of covering Growth Centers.

These values are sufficient for Geometry V2 to sink lower profile rows, remove covered facets and preserve exposed terminations without modifying the logical skeleton.

## Center Maturation

Every existing Growth Center receives a `CrystalCenterMaturationState` containing:

- dominant body ID;
- current body count;
- weighted maturity;
- structural completeness;
- attachment cohesion;
- burial pressure;
- average exposed-tip ratio;
- buried body count.

Dominant bodies receive the strongest maturity weight, satellites a medium weight and micro-growth a smaller weight.

Structural completeness measures the presence of dominant, satellite and micro roles. Cohesion measures whether local members attach to bodies belonging to the same Growth Center.

## Geometry Integration

`buildCrystalGeometry()` now builds `CrystalGeologyState` before mesh generation and publishes it on `CrystalGeometryState.geology`.

The field is optional in the public TypeScript contract so persisted Geometry State v1 snapshots created before Phase 2C remain readable. Every newly generated Crystal Geometry State includes it.

Current mesh positions and profile signatures do not yet consume burial metadata. This deliberately preserves append-only mesh behavior until Geometry V2 introduces the new profile contract.

## Files Changed

- `src/engine/species/crystal/geology.ts`
  - deterministic burial field;
  - body burial state;
  - Growth Center maturation state.
- `src/engine/species/crystal/geology.test.ts`
  - deterministic ordering;
  - dominant-vs-micro burial strength;
  - chronology and same-center isolation;
  - center maturation normalization.
- `src/engine/species/crystal/index.ts`
  - exports the geology builder and public types.
- `src/engine/geometry/types.ts`
  - optional geology metadata on Geometry State v1.
- `src/engine/geometry/engine.ts`
  - computes and publishes geology metadata.
- `src/engine/geometry/geometry.test.ts`
  - validates geology integration;
  - updates the stale one-body append assumption for Growth Centers.

## Verification Performed

Strict isolated TypeScript compilation passed for the new geology source and Geometry integration using:

- `strict`;
- `noUncheckedIndexedAccess`;
- `exactOptionalPropertyTypes`;
- `noUnusedLocals`;
- `noUnusedParameters`;
- `verbatimModuleSyntax`;
- `isolatedModules`.

Deterministic manual harness results for the same target position:

- old micro body under a large mature later dominant: burial ratio `0.82`;
- preserved exposed-tip ratio: `0.18`;
- the covering body and Growth Center are recorded as provenance;
- the same target under a small young later micro body: burial ratio `0`;
- reversing the body array produces identical geology state;
- the input Growth State is not mutated.

The branch comparison from Phase 2B to the final Phase 2C code commit contains only the six files listed above.

GitHub returned no combined status checks for commit `b949efd5c0aba6de4c1cdca4e331cf581f23d9d1`.

A complete repository checkout was unavailable in the execution environment. Full repository `npm test`, `npm run typecheck` and production build are therefore not claimed as executed.

## Remaining Risks

- burial uses analytical lower shells rather than final fused mesh surfaces;
- burial metadata does not yet alter profile rows or triangle trimming;
- current straight prism profiles can still make a layered colony look artificial;
- local junctions remain sealed overlaps instead of continuous mineral transitions;
- old bodies can be classified as buried, but there is not yet a sediment/filler mesh between neighboring bases.

## Next Safe Task

Crystal Geometry V2 — Phase 3A: replace the one-radius straight-prism profile with deterministic asymmetric profile rows.

Each row should support independent X/Z radii, center offsets, facet phase and twist. Geometry V2 should read Phase 2C burial metadata to sink and compress covered lower rows while preserving stable exposed tips. Curvature and controlled asymmetry must be introduced before fractures, chips and local fusion detail.
