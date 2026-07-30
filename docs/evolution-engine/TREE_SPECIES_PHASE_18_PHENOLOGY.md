# Tree Species — Phase 18: Seasonal Accent / Phenology Lab

## Purpose

Phase 18 adds bounded seasonal accents to the accepted canopy while preserving leaf identity, Canopy Depth, Canopy Light, Tree Life and mobile budgets.

The phase is state-driven: the accepted `asOf` timestamp selects a stable phenology phase.

```text
March–May      → spring
June–August    → summer
September–November → autumn
December–February  → winter
```

No browser clock, frame time or mutable random source is used.

## Pipeline

```text
Portal Events
→ Evolution Engine
→ Tree Species
→ Organic Skeleton
→ Curve Frames
→ Tree Composition
→ Root Architecture
→ Ground Contact
→ Terrain Binding
→ Root + Collar + Terrain Geometry
→ Foliage Architecture
→ Leaf Geometry
→ Tree Material
→ Canopy Depth
→ Canopy Light
→ Seasonal Accent / Phenology
→ Soil Surface
→ Bark Surface
→ Ground Detail
→ Tree Life
→ Three.js Renderer
```

## Stable identity

The layer publishes:

```text
tree:phenology:seasonal-accent
tree:phenology:instance-profile
tree:phenology:instance-tint
```

Every profile ID is derived from the accepted leaf ID. Leaf, cluster and branch IDs are not rewritten.

## Accent rules

Each accepted leaf remains either:

```text
base
accent
```

Accent selection depends only on:

- artifact seed;
- accepted leaf ID;
- resolved phenology phase.

Default accent shares are bounded:

```text
spring  34%
summer  22%
autumn  48%
winter  16%
```

The exact emitted share may differ slightly because selection is deterministic per leaf rather than forced by sorting.

## Color projection

Phenology multiplies the already accepted Canopy Depth × Canopy Light tint.

- spring adds fresh yellow-green accents;
- summer adds restrained warm green accents;
- autumn adds bounded amber accents;
- winter adds muted cool green accents.

Accent strength is limited to a narrow deterministic range. RGB values are quantized to 16 steps and the combined tint budget is capped at 96.

## Renderer contract

The Three.js adapter continues to use:

```text
1 shared leaf geometry
1 foliage material
1 InstancedMesh
1 leaf draw call
```

Phenology writes only the final `instanceColor` values. Canopy Depth matrices and Tree Life base transforms remain unchanged.

## Performance contract

Phase 18 adds:

```text
0 vertices
0 triangles
0 instances
0 draw calls
0 materials
0 textures
0 shaders
0 additional matrix updates per frame
```

The full mobile ceiling remains:

```text
3 materials total
4 draw calls maximum
12,000 shared/static vertices maximum
16,000 rendered triangles maximum
80 ms deterministic build maximum
```

## Acceptance

Automated coverage verifies:

- deterministic state;
- one profile per accepted leaf;
- stable leaf order and LOD prefixes;
- valid phase resolution for all seasons;
- accent presence and bounded tint budget;
- unchanged draw-call/material estimates;
- one existing Three.js leaf InstancedMesh;
- final instance colors and renderer metadata.

## Architectural boundary

This phase does not add leaf removal, topology changes, weather simulation, dynamic calendar polling, pollen particles, flowers, fruit geometry, extra materials, transparency, Supabase writes or per-frame phenology rebuilding.

## Next phase

A later **Tree Micro-Variation / Leaf Orientation Lab** may improve small orientation differences and silhouette breakup while preserving Phenology, Canopy Light, Tree Life and the current mobile budget.
