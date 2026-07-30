# Tree Species — Phase 16: Canopy Depth / Crown Volume Lab

## Purpose

Phase 16 turns the accepted leaf-card cloud into a layered crown with readable depth while preserving accepted leaf identities, branch geometry, Bark Surface and Ground Detail.

The layer adds:

- stable inner, middle and outer canopy profiles;
- bounded view-independent outward offsets;
- layer-specific leaf scale;
- quantized per-instance foliage tint;
- explicit preservation of existing crown cells and internal negative space.

No additional leaf cards are created.

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
→ Canopy Depth / Crown Volume
→ Soil Surface
→ Bark Surface Character
→ Ground Detail
→ Tree Life
→ Three.js Renderer
```

Canopy Depth is built after Tree Material because it publishes foliage tint multipliers against the accepted foliage material role. Tree Life remains later in the pipeline and captures the depth-adjusted leaf matrices as its renderer-only base transforms.

## Stable identity

The layer publishes:

```text
tree:canopy-depth:volume
tree:canopy-depth:instance-profile
tree:canopy-depth:instance-tint
tree:leaf:instances
```

Every profile has a stable ID derived from the accepted leaf ID:

```text
tree:canopy-depth:<accepted-leaf-id>
```

Leaf IDs, cluster IDs, branch IDs and instance count are never rewritten.

## Renderer-independent state

`TreeCanopyDepthState` contains:

- exact Composition, Foliage, Leaf Geometry and Tree Material provenance;
- artifact seed and accepted LOD;
- one profile per accepted leaf;
- depth layer and normalized depth;
- source position, bounded offset and final render position;
- scale multiplier;
- quantized RGB tint multiplier;
- original crown-cell provenance;
- mobile and negative-space diagnostics.

It contains no React, Three.js, WebGL, browser or Supabase values.

## Crown layers

Each accepted leaf is assigned to one of three stable layers:

```text
inner
middle
outer
```

Layer assignment combines the accepted local leaf index with a deterministic seed phase. This guarantees that a sufficiently populated crown contains all three layers without relying on frame time, camera position or non-repeatable randomness.

Normalized depth remains bounded by two published thresholds:

```text
inner:  depth <= 0.38
middle: 0.38 < depth < 0.70
outer:  depth >= 0.70
```

## Volume projection

Depth is expressed only through renderer transforms:

- inner leaves remain at their accepted position and are slightly smaller;
- middle leaves receive a very small outward offset;
- outer leaves receive the largest bounded outward offset;
- offsets follow the stable vector from the accepted crown center to the leaf;
- maximum offset is 12% of the source cluster radius.

The accepted `TreeLeafGeometryState` is not mutated.

## Internal negative space

Phase 16 never creates a new leaf or moves a leaf into another logical crown cell.

Every profile retains the source cluster `crownCellId`. Therefore:

- existing occupied cells remain the only occupied cells;
- previously empty cells remain empty;
- Composition negative-space scoring remains authoritative;
- no camera-dependent hole filling occurs.

## Depth tint

The existing foliage material is multiplied by one quantized instance tint:

- inner leaves are darker and slightly muted;
- middle leaves remain close to the accepted foliage color;
- outer leaves are lighter and more exposed.

The default contract uses:

```text
16 RGB quantization steps
8 deterministic variation bands per layer
24 unique tint multipliers maximum
```

The adapter stores colors in the existing `InstancedMesh.instanceColor` buffer.

## Renderer contract

The Three.js adapter continues to create:

```text
1 shared leaf geometry
1 foliage material
1 InstancedMesh
1 leaf draw call
```

Canopy Depth modifies only the instance matrices and instance colors before Tree Life captures the renderer base transforms.

Tree Life then applies its accepted subtle motion on top of those transforms without rebuilding depth profiles per frame.

## Performance contract

Phase 16 adds:

```text
0 vertices
0 triangles
0 instances
0 draw calls
0 materials
0 textures
0 additional per-frame matrix updates
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

- deterministic state;
- one profile per accepted leaf;
- exact leaf ID and sequence preservation;
- all three depth layers;
- threshold bounds;
- crown-cell provenance;
- no previously empty cells filled;
- offset, scale and tint bounds;
- tint-budget enforcement;
- lower-LOD leaf identity preservation;
- upstream state immutability;
- provenance rejection;
- one Three.js leaf InstancedMesh;
- one instance color per leaf;
- depth-adjusted transforms;
- unchanged draw-call and material budgets;
- Pixel 8 Pro visual and runtime acceptance.

## Architectural boundary

This phase does not add:

- camera-facing depth sorting;
- transparency or alpha blending;
- new leaf geometry;
- additional foliage materials;
- billboarding;
- occlusion queries;
- volumetric fog;
- seasonal color replacement;
- wind changes;
- changes to Tree Life rules;
- changes to Bark Surface or Ground Detail IDs;
- Supabase writes.

## Next phase

A later **Tree Light Response / Canopy Shading Lab** may add bounded sun-exposure cues and crown-side tonal response while preserving Canopy Depth profiles, one leaf draw call and the existing material budget.
