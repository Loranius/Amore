# Tree Species — Phase 19: Micro-Variation / Leaf Orientation Lab

## Purpose

Phase 19 breaks up repeated leaf-card orientation while preserving the accepted canopy structure, colors, leaf identities and Tree Life rules.

The layer adds small deterministic local rotations to every accepted leaf:

- tilt across the card;
- fan rotation around the local crown-facing axis;
- twist around the leaf direction;
- stronger but still bounded variation on the outer crown.

No browser clock, camera direction or mutable random source is used.

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
→ Leaf Orientation / Micro-Variation
→ Soil Surface
→ Bark Surface
→ Ground Detail
→ Tree Life
→ Three.js Renderer
```

Leaf Orientation is built after Phenology so accepted color profiles remain authoritative. Tree Life captures the already oriented instance matrices and applies only its existing subtle motion.

## Stable identity

The layer publishes:

```text
tree:leaf-orientation:micro-variation
tree:leaf-orientation:instance-profile
tree:leaf-orientation:instance-matrix
```

Every profile ID is derived from the accepted leaf ID. Leaf, cluster, branch and crown-cell IDs are not rewritten.

## Layer bounds

The default maximum local rotations are:

```text
inner   tilt 0.08 · fan 0.10 · twist 0.12 rad
middle  tilt 0.11 · fan 0.15 · twist 0.17 rad
outer   tilt 0.15 · fan 0.21 · twist 0.23 rad
```

Outer leaves receive the strongest silhouette breakup. The values remain below 0.35 radians per axis and are quantized into 17 signed bands.

## Renderer contract

The Three.js adapter continues to use:

```text
1 shared leaf geometry
1 foliage material
1 InstancedMesh
1 leaf draw call
```

The accepted matrix order is:

```text
base leaf basis
× local orientation micro-rotation
× Canopy Depth scale
+ Canopy Depth render position
```

Phenology and Canopy Light continue to provide the final `instanceColor`. Leaf Orientation changes no colors.

## Performance contract

Phase 19 adds:

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

The complete mobile ceiling remains:

```text
3 materials total
4 draw calls maximum
12,000 shared/static vertices maximum
16,000 rendered triangles maximum
80 ms deterministic build maximum
```

## Acceptance

Automated coverage verifies:

- deterministic orientation state;
- one profile per accepted leaf;
- stable leaf order and LOD identity;
- bounded inner, middle and outer rotations;
- unchanged Canopy Depth, Canopy Light and Phenology provenance;
- unchanged instance count and color values;
- one existing Three.js leaf InstancedMesh;
- changed matrices for non-zero profiles;
- unchanged material and draw-call budgets;
- Pixel 8 Pro render and runtime acceptance.

## Architectural boundary

This phase does not add billboarding, camera-facing leaves, leaf removal, new crown cells, transparency, alpha sorting, geometry deformation, weather simulation, new materials, Supabase writes or new per-frame rules.

## Next phase

**Tree Crown Silhouette Polish / Negative Space Acceptance** may audit the complete crown outline and internal openings using the accepted leaf set, without adding instances or changing stable IDs.
