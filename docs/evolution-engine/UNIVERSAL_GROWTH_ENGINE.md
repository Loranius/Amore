# Amore Universal Growth Engine

## Purpose

The Universal Growth Engine converts species instructions into stable spatial bodies.
It is shared by Crystal, Tree and Coral.

```text
ArtifactBlueprint
  -> Species Blueprint
  -> UniversalGrowthBlueprint
  -> Universal Growth Engine
  -> GrowthState
  -> Composition / Geometry / Renderer
```

The engine does not know what a wish, plan, memory, branch, crystal facet or coral polyp means.
Species adapters provide stable dimensions and preferences; the engine handles placement.

## Public contract

`UniversalGrowthBlueprint` contains:

- one root instruction;
- an append-ordered instruction list;
- colony membership;
- full adult axial/radial dimensions;
- preferred direction;
- attachment depth;
- host preference;
- generation limits;
- species attributes carried forward without interpretation.

`GrowthState` contains:

- bodies in deposition order;
- stable anchors and directions;
- full skeleton dimensions;
- maturity-scaled rendered dimensions;
- attachment contacts;
- occupied surface sites;
- generations and colony state;
- competition and crowding values;
- diagnostics.

## Pipeline

### 1. Growth order

Instructions are ordered by their stable `sequence`, then by ID. A new normal event is appended after historical bodies.

### 2. Analytical Surface Map

The engine never raycasts a render mesh. Every body exposes an analytical tapered surface:

- axis from `anchor + direction`;
- full adult length and radius;
- deterministic surface parameter `hostT`;
- deterministic angle around the host axis;
- local surface normal.

This keeps placement renderer-independent and stable across LOD changes.

### 3. Growth Sites

Each instruction receives a fixed number of candidate sites. Candidate count is versioned and never depends on scene density.

The candidate stream uses only:

- instruction seed;
- candidate index;
- previously deposited bodies;
- versioned engine configuration.

### 4. Attachment Solver

Hosts are selected from earlier generations only. The solver considers:

- root preference;
- same-colony affinity;
- generation depth;
- local surface normal;
- preferred species direction;
- occupied angle separation.

The selected body is buried slightly below the host surface. Geometry later removes hidden faces at this junction.

### 5. Competition Solver

A candidate body is compared with previous skeletal segments. Competition affects only the new body:

- clear candidates keep full energy;
- crowded candidates become shorter and thinner;
- emphasized bodies have a higher energy floor;
- previous bodies are never moved or resized.

### 6. Colony Solver

Species defines colony membership. The engine records:

- deposited members;
- colony root body;
- total deposited weight;
- maximum generation.

### 7. Generation Solver

A child generation is `host.generation + 1`, capped by the species instruction. If a preferred colony branch reached its cap, placement falls back to an eligible older surface and emits diagnostics.

## Two geometries

Every body stores two size systems:

### Skeleton dimensions

Full adult dimensions used for all future placement and collision decisions. They do not change with maturity or a newly appended event.

### Rendered dimensions

Skeleton dimensions multiplied by maturity. These may grow over time without moving the anchor, changing the host or invalidating historical placement.

## Append-only guarantee

Appending a later instruction cannot change any previously deposited body because:

- each body uses its own seed;
- placement reads previous bodies only;
- candidate draw count is fixed;
- full dimensions depend on the stable instruction, not current global pressure;
- competition never performs a global relaxation pass;
- colony summaries do not feed back into historical coordinates.

Adding a genuinely backdated event is different: younger layers may be recomputed because the historical order itself changed. IDs remain stable and this behavior is intentional.

## Crystal adapter

`crystalToGrowthBlueprint()` maps Crystal Species into the universal contract.

- mother -> root / king;
- event spire -> root-preferring support;
- satellite -> balanced colony growth;
- inclusion -> same-colony deeper generation;
- archetype and channel are carried as uninterpreted attributes.

No Three.js, React, Supabase, mesh or material import exists in the new Growth Engine.

## Not included in Phase 4

- final composition scoring;
- silhouette correction;
- exact mesh intersections;
- junction face trimming;
- CrystalScene migration;
- material or shader changes;
- Tree and Coral adapters.

Those belong to later phases.
