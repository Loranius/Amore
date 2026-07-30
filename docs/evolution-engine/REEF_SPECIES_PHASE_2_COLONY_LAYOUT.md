# Reef Species — Phase 2: Colony Layout / Substrate Occupancy

## Purpose

Phase 2 converts the accepted renderer-independent Reef Species blueprint into stable colony anchors across a deterministic substrate field.

It adds:

- one logical substrate occupancy grid;
- stable colony IDs for every accepted recruit;
- deterministic radial, azimuth and vertical placement;
- collision-safe reserved footprints;
- current-aware orientation intent;
- append-only newest-first truncation diagnostics;
- no mesh, materials, renderer instances, UI replacement or database work.

The Home Reef slot remains an honest placeholder until substrate and colony geometry exist.

## Pipeline boundary

```text
Portal Events
→ Evolution Engine ArtifactBlueprint
→ Reef Species Phase 1
  → ReefStructureInstruction
  → ReefGrowthGrammar
  → ReefGrowthInstruction[]
→ Reef Species Phase 2
  → ReefSubstrateCell[]
  → ReefColonyPlacement[]
  → ReefColonyLayoutDiagnostics
→ future Reef Substrate Geometry
→ future Colony Geometry
→ future Reef Material
→ future Reef Life
→ future Three.js Renderer
```

Phase 2 consumes only the accepted `ReefSpeciesBlueprint`.

It does not import Tree geometry, Crystal geometry, React, Three.js or Supabase.

## Stable identity

The state publishes:

```text
reef:colony-layout
reef:substrate-occupancy
reef:colony-anchor
reef:substrate-cell:r<radial-band>:a<azimuth-sector>
reef:colony:<source-instruction>:<recruit-index>
```

Existing colony anchors are processed chronologically before later history.

Appending a later accepted event cannot change an existing colony's:

- ID;
- source instruction;
- morphotype, role or tier;
- substrate cell;
- radial and vertical bands;
- azimuth sector;
- anchor position;
- substrate normal;
- facing direction;
- footprint reservation;
- seed.

A later explicit `asOf` may change the source species maturity. Later geometry must use that maturity as a growth scale without rewriting the stable anchor identity.

## Substrate occupancy grid

The default grid uses:

```text
5 radial bands from Reef Species
24 azimuth sectors
120 stable logical substrate cells
4 accepted colonies per cell maximum
```

Each `ReefSubstrateCell` publishes:

- stable cell ID;
- radial band and azimuth sector;
- radial range;
- deterministic center point;
- normalized substrate normal;
- current exposure;
- capacity;
- accepted colony IDs occupying the cell.

Cells are analytical layout samples, not vertices or terrain geometry.

## Deterministic substrate field

The substrate field derives only from the accepted structure seed and Phase 1 structure values:

- substrate radius;
- reef height;
- shelf count;
- vertical relief;
- slope bias;
- current direction;
- current strength.

The analytical height field combines:

- a central reef mound;
- bounded shelf steps;
- stable radial and cross ripples;
- a current-aligned slope.

Normals are calculated from deterministic finite differences.

No texture, displacement map or procedural shader is created in this phase.

## Colony placement

Each Phase 1 recruit becomes one candidate colony ID.

Placement starts from the source instruction's:

- preferred azimuth;
- radial band;
- vertical band;
- footprint intent;
- height intent;
- morphotype;
- role;
- tier;
- stable seed.

The default layout attempts up to:

```text
24 deterministic cells per colony
```

Attempts search:

- the preferred sector first;
- bounded neighbouring sectors;
- the preferred radial band first;
- bounded neighbouring radial bands only when required.

Recruit siblings use a stable sector stride so one event does not stack every recruit at the same coordinate.

## Footprint and overlap contract

Every accepted colony reserves a circular substrate footprint.

The footprint depends on:

- Phase 1 footprint intent;
- Phase 1 colony spacing;
- anchor / primary / companion / micro tier.

Accepted anchors must satisfy:

```text
center distance
>= (left footprint + right footprint) × 1.05
```

The footprint remains inside the substrate radius with an explicit radial padding.

A candidate that cannot find a valid cell after all attempts is reported as rejected instead of silently overlapping another colony.

## Current-aware facing

Phase 2 publishes only facing intent:

- sea fans align across the current;
- soft coral leans downstream;
- plating coral receives a tangent-facing orientation;
- massive, branching and encrusting colonies preserve a bounded outward-facing direction.

This is not geometry and does not update per frame.

## Colony budget

The accepted global ceiling remains the Phase 1 grammar budget:

```text
maximum accepted colony anchors: 144
```

When the budget is reached:

- already accepted colonies remain unchanged;
- only newest later candidate IDs are truncated;
- truncated colony IDs are reported;
- source instruction IDs affected by truncation are reported;
- history is not deleted from Reef Species.

## Diagnostics

`ReefColonyLayoutDiagnostics` publishes:

```text
sourceInstructionCount
candidateColonyCount
acceptedColonyCount
rejectedColonyIds
truncatedColonyIds
truncatedInstructionIds
instructionIdsWithoutAcceptedColonies
occupiedCellIds
crowdedCellIds
collisionRejectionCount
cellCapacityRejectionCount
maximumAcceptedColonies
maximumAttemptsPerColony
colonyBudgetReached
minimumAcceptedClearance
```

## Mobile and renderer budget

Phase 2 adds logical data only:

```text
120 logical substrate cells
up to 144 colony anchors
0 vertices
0 triangles
0 renderer instances
0 materials
0 textures
0 shaders
0 draw calls
0 per-frame updates
```

The complexity is bounded by at most 144 accepted colonies and 24 deterministic attempts per candidate.

## Acceptance coverage

Automated tests verify:

- deterministic output;
- Reef Species input immutability;
- stable substrate cell count and IDs;
- normalized substrate normals;
- radial and vertical bounds;
- explicit cell occupancy;
- footprint containment inside the substrate;
- pairwise collision clearance;
- append-only anchors after later history;
- newest-only truncation at the accepted colony budget;
- invalid configuration rejection.

Existing Crystal, Tree, Home and Pixel 8 Pro tests must remain unchanged and green because Phase 2 has no renderer integration.

## Architectural boundary

Phase 2 does not add:

- substrate mesh topology;
- coral branches, plates, fans or polyps;
- material palettes;
- transparency, water or caustics;
- particles or fish;
- Life animation;
- camera interaction or picking;
- Home Reef replacement;
- Supabase reads or writes;
- changes to Tree or Crystal.

## Next phase

The next phase is **Reef Phase 3: Substrate Geometry / Reef Foundation Mesh**.

It should convert the accepted analytical substrate field into one bounded mobile mesh while preserving every Phase 2 cell and colony anchor unchanged.
