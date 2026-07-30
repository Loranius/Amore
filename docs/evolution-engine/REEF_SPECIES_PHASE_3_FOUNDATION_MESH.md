# Reef Species — Phase 3: Substrate Geometry / Reef Foundation Mesh

## Purpose

Phase 3 converts the renderer-independent Phase 2 substrate grid into the first real indexed reef geometry.

It does not create coral colonies yet. It creates the stable foundation on which every later colony mesh will be attached.

## Pipeline

```text
Portal Events
→ Evolution Engine
→ Reef Species Blueprint
→ Colony Layout / Substrate Occupancy
→ Substrate Geometry / Reef Foundation Mesh
→ future Colony Geometry
→ future Reef Materials
→ future Reef Life
→ Three.js Renderer
```

## Accepted topology

The default Reef grammar contains five radial bands and twenty-four azimuth sectors.

Phase 3 builds:

```text
121 top vertices
24 lower skirt vertices
1 bottom centre vertex
146 vertices total

216 top triangles
48 side triangles
24 bottom triangles
288 triangles total
```

The shell is closed:

- every top boundary edge is joined to the outer skirt;
- every skirt edge is joined to the bottom fan;
- no boundary edge remains open;
- no edge is shared by more than two triangles;
- degenerate triangles are rejected by acceptance tests.

## Stable identity

Every element receives a stable ID:

```text
reef:foundation-vertex:...
reef:foundation-triangle:...
reef:foundation-patch:...
reef:foundation-attachment:...
```

Each of the 120 Phase 2 substrate cells maps to one top patch:

```text
reef:substrate-cell:r{band}:a{sector}
→ reef:foundation-patch:r{band}:a{sector}
```

The innermost radial band uses one triangle per cell. All outer bands use two triangles per cell.

## Colony attachments

Every accepted Phase 2 colony receives one foundation attachment.

The attachment preserves without modification:

- colony ID;
- substrate cell ID;
- position;
- surface normal;
- facing direction;
- footprint radius;
- target height.

Phase 3 does not move colonies and does not resolve new collisions. Phase 2 remains the source of truth for occupancy.

## Surface contract

The top mesh samples the same deterministic analytical substrate used by Phase 2:

- radial mound;
- shelf relief;
- seeded radial and cross ripples;
- current-facing slope bias;
- finite-difference surface normals.

The formula is regression-locked. A future change must version the layout and foundation rules together so colony anchors cannot silently detach from the substrate.

## Renderer contract

Phase 3 publishes pure data:

- vertex positions;
- normalized vertex normals;
- UV coordinates;
- triangle records;
- flat renderer-ready index buffer;
- logical patches;
- colony attachments.

It does not create `THREE.BufferGeometry`, materials, meshes, scene objects or animation callbacks yet.

## Mobile budget

```text
maximum vertices: 256
maximum triangles: 512
estimated future foundation draw calls: 1
material slots: 1
per-frame updates: 0
```

Accepted default topology:

```text
146 vertices
288 triangles
```

The geometry is never silently truncated. An invalid or reduced budget is reported through `geometryBudgetExceeded` while preserving deterministic topology.

## Boundaries

Phase 3 adds:

```text
0 coral geometry instances
0 materials
0 textures
0 shaders
0 runtime draw calls today
0 per-frame updates
0 Supabase reads
0 Supabase writes
```

Crystal and Tree pipelines are unchanged. The Home Reef slot remains a truthful placeholder until a renderer adapter and visible reef composition exist.

## Acceptance

Tests verify:

- deterministic output and input immutability;
- exact default topology counts;
- closed-shell edge incidence;
- normalized normals and bounded UVs;
- valid renderer indices;
- no degenerate triangles;
- one stable top patch for every Phase 2 cell;
- one exact attachment for every accepted colony;
- append-only preservation of earlier attachments;
- provenance validation;
- explicit geometry budget reporting.

## Next phase

**Reef Phase 4 — Colony Geometry Grammar / Morphotype Skeletons**

The next phase will convert colony anchors into renderer-independent geometry instructions for branching, massive, plating, encrusting, soft-coral and sea-fan colonies without materials or life animation.
