# Crystal Geological Growth — Phase 2B Implementation Report

## Scope

Introduce deterministic Growth Shadow and local same-center competition for Crystal Species.

Large, mature and dominant crystal bodies now reduce the future growth potential of nearby Surface Atlas regions. Later members of a Growth Center are pushed toward available gaps instead of coating the dominant crystal at mechanically even intervals.

This phase changes growth-field evaluation and candidate scoring only. It does not yet change crystal profile geometry, mesh fusion, materials, fractures or renderer code.

## Pipeline

Previous Phase 2A pipeline:

```text
evolution formation
  -> Growth Center
  -> dominant crystal
  -> local satellites and micro-growth
  -> nearest available same-center regions
```

Phase 2B pipeline:

```text
existing crystal mass
  -> analytical Surface Atlas
  -> size/maturity/role shadow field
  -> same-center competition field
  -> reduced regional growth potential
  -> shadow-aware candidate score
  -> later growth moves into open gaps
```

## Growth Shadow

Every Crystal Surface Atlas region now publishes:

- `growthShadow` in `[0, 1]`;
- `competitionPressure` in `[0, 1]`.

Shadow strength is determined by stable current-state properties of the nearby body:

- analytical length and radius;
- maturity;
- growth energy;
- tier;
- Growth Center role.

Dominant bodies produce the strongest shadow. King and support bodies remain strong, satellites are moderate, and micro-growth has a deliberately short and weak influence.

The spatial contribution also depends on:

- distance from the other body's analytical envelope;
- whether the surface normal faces the nearby body;
- whether the sampled point lies beside the useful axial span of that body;
- whether both bodies belong to the same Growth Center.

Multiple shadow contributions combine through transmission rather than direct addition, preventing arbitrary unbounded totals while still allowing overlapping mature bodies to create strongly suppressed regions.

## Local Competition

`competitionPressure` only accumulates from other bodies with the same non-null `growthCenterId`.

This keeps two related concepts separate:

- `growthShadow` represents physical suppression from every nearby crystal body;
- `competitionPressure` represents competition among members of one local nucleation center.

A body from another Growth Center may cast a shadow but cannot contribute same-center competition.

## Growth Potential

Surface stress now includes:

- historical body competition;
- body crowding;
- local density;
- Growth Shadow;
- same-center competition;
- exact region occupancy.

The unoccupied exposed region potential is then multiplied by shadow and competition attenuation factors. Covered or reserved regions still receive zero potential.

This means shadow is not only a visual diagnostic. It directly changes which Surface Atlas regions can win candidate selection.

## Candidate Competition

Growth candidates now carry:

- `growthShadow`;
- `competitionPressure`.

The final competition evaluator:

- increases effective competition in shadowed or locally contested regions;
- increases effective crowding;
- lowers the final candidate score;
- reduces later body growth energy through the existing competition pipeline.

As a result, a body that must grow in a crowded region remains possible, but it tends to be smaller and less dominant than growth in an open gap.

## Provenance

New atlas-based attachments persist optional nucleation-time values:

- `growthShadow`;
- `competitionPressure`.

They are optional in `GrowthAttachment`, so Growth State v1 snapshots created before Phase 2B remain readable.

The stored values describe conditions when the body nucleated. Rebuilding the current Surface Atlas may legitimately produce different field values later as the mass continues to grow.

## Species Boundary

Growth Shadow is activated only when the atlas species is `crystal`.

Tree and Reef continue receiving zero values from these new fields and retain their existing placement behavior. Their host-first growth algorithms and public state formats are unchanged.

## Files Changed

- `src/engine/growth/types.ts`
  - optional shadow and competition provenance on `GrowthAttachment`.
- `src/engine/growth/surfaceAtlas.ts`
  - Growth Shadow field;
  - same-center competition field;
  - shadow-aware stress and growth potential.
- `src/engine/growth/surface.ts`
  - carries the fields from an atlas region into the candidate and attachment.
- `src/engine/growth/competition.ts`
  - shadow-aware candidate competition, crowding and score.
- `src/engine/growth/surfaceAtlas.test.ts`
  - normalization, dominant-vs-micro shadow strength and same-center isolation.
- `src/engine/growth/growthShadow.test.ts`
  - Growth State provenance and deterministic shadow-aware generation.

## Verification Performed

Strict isolated TypeScript compilation passed with:

- `strict`;
- `noUncheckedIndexedAccess`;
- `exactOptionalPropertyTypes`;
- `noUnusedLocals`;
- `noUnusedParameters`;
- `verbatimModuleSyntax`;
- `isolatedModules`.

Deterministic manual harness results for the same location:

- large mature dominant maximum shadow: `0.535245`;
- small immature micro maximum shadow: `0.009027`;
- mean potential beside the large dominant: `0.6013013`;
- mean potential beside the small micro body: `0.89592415`;
- same-center maximum competition pressure: `0.170196`;
- identical geometry from a different Growth Center: `0` same-center competition.

The branch comparison from Phase 2A to the final code commit contains six Crystal Growth files and no unrelated file changes.

GitHub returned no combined status checks for commit `d7aeb5597a7efbc7b01b7f415bd7ffe5371583cf`.

A complete repository checkout was unavailable in the execution environment. Full repository `npm test`, `npm run typecheck` and production build are therefore not claimed as executed.

## Determinism and Append-only Safety

- no wall clock or unseeded randomness is used;
- body ordering remains sequence plus code-point ID order;
- historical region identity and coordinates remain stable;
- shadow and competition are derived current fields;
- only previously deposited bodies influence a new candidate;
- adding a later event cannot move an existing body or rewrite its stored nucleation conditions.

## Remaining Risks

- the shadow field uses analytical body envelopes rather than final fused geometry;
- mature bodies can suppress placement, but old bodies are not yet partially buried by later mineral layers;
- Growth Center density does not yet modify center-wide member counts after nucleation;
- the current prism geometry may still make improved spatial clustering look artificial;
- junctions remain overlapping meshes with trimming rather than continuous transition shells.

## Next Safe Task

Phase 2C: add geological burial and center maturation.

Later centers should partially cover old bases and low micro-growth, while stable open tips remain visible. Burial must be deterministic, append-only and expressed as geometry/fusion metadata without deleting historical bodies. After that, Crystal Geometry V2 can replace straight prism profiles with curved, twisted and asymmetric faceted forms.
