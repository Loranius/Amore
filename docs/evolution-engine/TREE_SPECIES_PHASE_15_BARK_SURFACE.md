# Tree Species — Phase 15: Bark Detail / Surface Character Lab

## Purpose

Phase 15 gives the accepted tree a bounded bark identity without replacing or deforming accepted geometry.

The layer adds:

- deterministic bark-tone variation;
- darker, rougher cues near the mature trunk base;
- lighter cues on younger generated branches;
- restrained longitudinal variation;
- radial groove character;
- procedural roughness modulation through a vertex attribute and the existing bark shader path.

No image textures, normal maps or downloaded atlases are required.

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
→ Soil Surface
→ Bark Surface Character
→ Ground Detail
→ Tree Life
→ Three.js Renderer
```

Bark Surface is built after Soil Surface because the merged static root/collar/terrain geometry already has an accepted color range. The Bark layer modifies only the root/collar prefix and preserves the terrain tint exactly.

## Stable identity

The layer publishes stable semantic IDs:

```text
tree:bark:surface-character
tree:bark:vertex-tint
tree:bark:roughness-character
tree:bark:branch-sweep
tree:bark:root-collar-sweep
```

The output signature depends only on:

- Bark Surface rules version;
- artifact seed;
- accepted LOD;
- accepted branch/static vertex counts;
- bounded tint count;
- published roughness-character range.

## Renderer-independent state

`TreeBarkSurfaceState` contains:

- exact source Species, Curve Frames, Sweep Mesh, Root Geometry, Soil Surface and Tree Material provenance;
- one RGB multiplier per branch/trunk sweep vertex;
- one roughness-character value per branch/trunk sweep vertex;
- one soil-aware RGB multiplier per static root/collar/terrain vertex;
- one roughness-character value per static vertex;
- branch-generation, trunk and tint-budget diagnostics;
- no React, Three.js, WebGL, browser or Supabase objects.

## Age cues

The accepted branch ranges are matched back to their Curve Frame generation.

The visual contract is:

- `organic:trunk` is treated as the oldest surface;
- generation-zero/root-contact surfaces receive mature bark character;
- newer branch generations are slightly lighter and smoother;
- the trunk base is darker than the upper trunk;
- geometry, branch IDs and range offsets never change.

This is a visual age cue only. It does not rewrite history or mutate Tree Species instructions.

## Surface variation

Every accepted bark vertex receives a deterministic tone derived from:

- artifact-seed phase;
- local position;
- local normal direction;
- branch generation;
- longitudinal position along the branch;
- bounded radial groove wave.

Tone values are reduced to eight logical bands and RGB channels are quantized to sixteen published values.

The default combined bark-plus-soil tint budget is:

```text
96 unique RGB multipliers maximum
```

Publication fails if the budget is exceeded.

## Procedural roughness

Each bark vertex also receives:

```text
barkCharacter: float
```

The attribute is quantized and bounded inside `0..1`.

The existing `MeshStandardMaterial` bark shader reads the value and modulates the accepted roughness factor within a narrow range. It does not add:

- another material;
- another mesh;
- another draw call;
- a texture lookup;
- a per-frame update.

Both moving branch geometry and static root/collar geometry expose the attribute. Terrain vertices receive a stable neutral rough character while retaining Soil Surface colors.

## Soil preservation

The merged static mesh is split logically by the existing Soil Surface boundary:

```text
[ roots + collar ][ terrain ]
```

Phase 15:

- applies bark variation only to the first prefix;
- leaves every terrain RGB value byte-for-byte equal to Soil Surface;
- does not move the prefix boundary;
- does not alter terrain normals, positions, UVs or indices.

## Performance contract

Phase 15 adds:

```text
0 vertices
0 triangles
0 draw calls
0 materials
0 textures
0 per-frame matrix updates
```

The complete Tree Lab ceiling remains:

```text
3 materials total
4 draw calls maximum
12,000 shared/static vertices maximum
16,000 rendered triangles maximum
80 ms deterministic build maximum
```

## Acceptance

Automated coverage verifies:

- deterministic Bark Surface state;
- complete branch and static attribute lengths;
- exact branch-range coverage;
- trunk and generated-branch diagnostics;
- quantized tint/roughness bounds;
- tint-budget enforcement;
- Soil Surface terrain tint preservation;
- upstream mesh, root, soil and material immutability;
- provenance rejection;
- Three.js branch/static color attributes;
- Three.js branch/static `barkCharacter` attributes;
- bark-only shader binding;
- unchanged two-material Tree Material state;
- zero additional draw calls and materials;
- Pixel 8 Pro visual and runtime acceptance.

## Architectural boundary

This phase does not add:

- downloaded bark textures;
- normal, displacement or parallax maps;
- geometry displacement;
- cracks that modify topology;
- bark particles;
- damage, carving or user painting;
- seasonal bark replacement;
- moisture or weather simulation;
- Supabase writes;
- changes to Ground Detail IDs;
- changes to Tree Life motion.

## Next phase

A later **Tree Canopy Depth / Crown Volume Lab** may improve crown layering, near/far leaf density and internal negative space while preserving accepted Bark Surface, Ground Detail and mobile budgets.
