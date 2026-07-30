# Crystal Geological Growth — Phase 1B Implementation Report

## Scope

Switch **Crystal Species** candidate selection from choosing a parent body first to ranking active regions across the complete aggregate Surface Atlas.

Tree, Reef and any other species remain on the previous weighted-host sampler in this phase. This prevents the crystal restructuring from changing their established skeleton layouts.

For crystal growth, the selected source body remains in `hostBodyId` only as compatibility/provenance data for the current Geometry and Fusion layers. New crystal placements also persist the stable `surfaceRegionId` that actually determined the growth location.

This slice does not yet remove generation compatibility, change geometry profiles, create colonies from one Growth Center, or implement local junction fusion.

## Main Behaviour Change

Previous crystal pipeline:

```text
instruction -> weighted host body -> random analytical site -> competition score
```

Phase 1B crystal pipeline:

```text
instruction
  -> build current aggregate Surface Atlas
  -> filter exposed and generation-compatible regions
  -> rank regions by geological potential and species preference
  -> evaluate collision and competition
  -> reserve selected surfaceRegionId
```

Crystal candidate priority now combines:

- aggregate `growthPotential`;
- local `surfaceStress`;
- local density;
- surface-normal alignment with the instruction;
- upward exposure;
- crystal host preference as a bias rather than the initial spatial decision;
- deterministic seeded variation.

## Files Changed

- `src/engine/growth/types.ts`
  - adds backward-compatible optional `surfaceRegionId` provenance to attachments and occupancies.
- `src/engine/growth/surfaceAtlas.ts`
  - adds `buildGrowthSurfaceAtlasFromMass()` for in-progress deposition;
  - recognizes exact region reservations while retaining legacy angular occupancy compatibility.
- `src/engine/growth/surface.ts`
  - adds `sampleGrowthRegionSite()`;
  - stores geological field values on candidates;
  - retains `sampleGrowthSite()` for non-crystal compatibility.
- `src/engine/growth/competition.ts`
  - includes geological potential, stress and density in the final candidate score;
  - legacy candidates receive constant neutral geological values, so their relative ordering is unchanged.
- `src/engine/growth/engine.ts`
  - routes Crystal Species through aggregate Surface Atlas ranking;
  - retains weighted-host-first selection for other species;
  - reserves the selected crystal region identity.
- `src/engine/growth/index.ts`
  - exports the in-progress mass atlas API.
- `src/engine/growth/engine.test.ts`
  - verifies crystal attachment and occupancy region provenance;
  - verifies unique region reservation.
- `src/engine/growth/surfaceAtlas.test.ts`
  - verifies wrapper/direct-builder equivalence;
  - verifies exact region reservations independently from legacy angular coordinates.

## Compatibility

`growthStateVersion` and `surfaceMapVersion` remain at version 1.

`surfaceRegionId` is optional in the public TypeScript contracts so older serialized snapshots remain readable. Newly generated non-root **crystal** bodies and their occupancy records receive a concrete region ID. Other species continue producing the same legacy attachment contract without that optional field.

For crystal bodies, `hostBodyId`, `hostT` and `hostAngleRad` remain populated for the current Geometry and Fusion implementation. They no longer choose the location before the aggregate surface is evaluated.

## Determinism

- bodies are ordered by sequence and code-point ID comparison;
- crystal regions are ranked with explicit ID tie-breaking;
- seeded variation depends only on the instruction seed and stable region ID;
- no wall clock, locale sorting, network state or unseeded randomness is used;
- append-only deposition still reads only previously deposited bodies.

## Verification Performed

- strict isolated TypeScript compilation passed with:
  - `strict`;
  - `noUncheckedIndexedAccess`;
  - `exactOptionalPropertyTypes`;
  - `noUnusedLocals`;
  - `noUnusedParameters`;
  - `verbatimModuleSyntax`;
  - `isolatedModules`.
- deterministic crystal harness passed:
  - instruction-array reversal produced byte-identical state;
  - four deposited bodies reserved four unique Surface Atlas regions;
  - `root` preference remained rooted;
  - `surface` preference could select later aggregate bodies.
- GitHub returned no combined status checks for the latest Phase 1B source commit at verification time.

A complete repository checkout was unavailable in the connector environment, so full `npm test`, `npm run typecheck` and production build are not claimed as executed.

## Remaining Risks

- Surface Atlas regions still originate from analytical envelopes rather than the final fused shell.
- `generation` and host preference remain crystal compatibility constraints.
- Crystal growth still deposits one instruction as one body; Growth Centers and local colonies are not implemented yet.
- Crystal junctions remain overlapping independent meshes with trimming rather than one transition surface.

## Next Safe Task

Phase 2A: introduce deterministic Crystal Growth Centers and let one evolution formation create a local colony containing a dominant crystal plus nearby satellites, while preserving append-only history and the Surface Atlas reservation model.
