# Reef Species — Phase 5: Colony Mesh Geometry / Morphotype Meshing

## Purpose

Phase 5 converts every accepted Phase 4 colony skeleton into bounded renderer-independent vertex/index buffers.

This is the first phase that creates real coral colony triangles. It still does not create materials, textures, Three.js objects, animation callbacks or Home UI.

## Pipeline

```text
Portal Events
→ Evolution Engine
→ Reef Species Blueprint
→ Colony Layout / Substrate Occupancy
→ Substrate Geometry / Reef Foundation Mesh
→ Colony Geometry Grammar / Morphotype Skeletons
→ Colony Mesh Geometry / Morphotype Meshing
→ future Reef Materials
→ future Reef Life
→ Three.js Renderer
```

## Batch contract

Geometry is merged into one stable batch per morphotype:

```text
reef:colony-mesh-batch:branching
reef:colony-mesh-batch:massive
reef:colony-mesh-batch:plating
reef:colony-mesh-batch:encrusting
reef:colony-mesh-batch:soft-coral
reef:colony-mesh-batch:sea-fan
```

Each colony owns one stable range inside its morphotype batch:

```text
reef:colony-mesh-range:{colonyId}
```

The range records:

- vertex start and count;
- triangle start and count;
- flat index start and count;
- skeleton and colony IDs;
- morphotype and chronological sequence;
- world-space bounds.

Later portal history only appends new colony ranges. Existing ranges and buffers remain byte-identical.

## Coordinate contract

Phase 4 skeleton nodes use local coordinates:

```text
x = attachment right
 y = attachment up
 z = attachment forward
```

Phase 5 converts every local node to world space using the exact orthonormal Phase 4 basis.

This preserves:

- foundation attachment position;
- substrate normal;
- current-aware facing;
- footprint radius;
- target height;
- stable colony orientation.

## Morphotype meshing

### Branching

Every accepted trunk, branch and twig segment becomes a capped low-sided tapered tube.

The default cross-section uses five radial sides. Overlapping segment ends create continuous branch junctions without extra junction meshes.

### Massive

The root, radial control ring and apex become one closed envelope:

- lower fan from root to ring;
- upper fan from ring to apex;
- no internal rib geometry is emitted.

### Plating

The central stalk becomes a tapered tube. The plate instruction becomes a thin closed disc with:

- top face;
- bottom face;
- closed outer wall.

### Encrusting

The low substrate patch becomes a thin closed disc following its irregular Phase 4 rim.

Internal logical ribs are not emitted as visible geometry.

### Soft coral

Stalk and lobe segments become tapered tubes. Each lobe envelope becomes a closed triangular prism that adds soft volume around the logical lobe axis.

### Sea fan

Spine, branches and ribs become tapered tubes. The fan perimeter becomes a thin closed membrane with front, back and edge surfaces.

The membrane plane keeps the Phase 2 current-aware orientation.

## Stable geometry identity

Every renderer primitive has a stable ID:

```text
reef:colony-mesh-range:{colonyId}:vertex:{primitiveLabel}
reef:colony-mesh-range:{colonyId}:triangle:{primitiveLabel}
```

Variation comes only from accepted Phase 4 skeletons and versioned Phase 5 rules.

There is no:

- `Math.random()`;
- `Date.now()`;
- camera dependency;
- renderer state;
- frame-dependent geometry rebuild.

## Renderer-ready data

Each batch publishes:

- world-space positions;
- generated unit normals;
- bounded UV coordinates;
- triangle records;
- flat renderer-ready index buffer;
- stable colony ranges and bounds.

Normals are generated from accumulated face normals after all primitives in a batch are emitted.

## Geometry budget

Default ceilings:

```text
maximum vertices: 24,000
maximum triangles: 36,000
tube radial segments: 5
```

The output is never silently truncated. If accepted geometry exceeds a ceiling, `geometryBudgetExceeded` becomes true while all stable buffers are preserved for diagnosis.

Phase 5 currently publishes no materials, so actual Home draw calls remain zero. A future renderer can consume at most one geometry batch per morphotype.

```text
maximum future colony batches: 6
material slots today: 0
per-frame updates: 0
```

## Geometry acceptance

Diagnostics verify:

- exactly one mesh range per accepted skeleton;
- all six morphotype batches;
- finite positions, normals and UVs;
- unit vertex normals;
- valid renderer indices;
- no degenerate triangles;
- no colonies without mesh output;
- deterministic output and input immutability;
- append-only preservation after later portal history;
- explicit geometry budget reporting;
- full Species → Layout → Foundation → Skeleton provenance.

## Boundaries

Phase 5 adds real coral geometry data but still adds:

```text
0 materials
0 textures
0 shaders
0 Three.js objects
0 active Home draw calls
0 per-frame updates
0 Supabase reads
0 Supabase writes
```

Crystal and Tree are unchanged. Home Reef remains a truthful placeholder because unmaterialized raw geometry is not yet a production scene.

## Next phase

**Reef Phase 6 — Reef Materials / Morphotype Surface Language**

The next phase will assign a bounded material role, palette and surface response to foundation and colony batches without adding geometry or life animation.
