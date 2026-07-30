# Tree Species — Phase 13: Soil Surface Lab

## Purpose

Phase 13 gives the accepted Terrain Binding a visible soil appearance without adding a texture, a third material or another draw call.

The stage is intentionally renderer-independent. It publishes a deterministic RGB multiplier for every vertex in the existing static root/collar/terrain mesh. Roots and the contact collar retain a white multiplier, so their accepted bark appearance stays unchanged. Only the appended terrain range receives soil tint.

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
→ Tree Life
→ Three.js Renderer
```

## Stable identity

The soil layer publishes stable semantic IDs:

```text
tree:soil:surface
tree:soil:palette
tree:soil:vertex-tint
```

The source terrain remains:

```text
tree:terrain:surface
```

Soil Surface never replaces terrain identity, root IDs or the Ground Contact plane.

## Renderer-independent state

`TreeSoilSurfaceState` contains:

- exact source Tree Species, Terrain Binding, Root Geometry and Tree Material versions;
- artifact seed and selected LOD;
- stable soil, palette and tint-attribute IDs;
- a quantized plateau, relief and edge tint palette;
- a stable state signature;
- one RGB multiplier for every vertex in the merged static mesh;
- explicit terrain offset and terrain vertex count;
- unique-tint and material-budget diagnostics.

No Three.js classes are stored in this state.

## Prefix preservation

The static mesh layout is:

```text
visible roots
→ contact collar
→ terrain surface
```

The soil color buffer follows the exact same order.

All vertices before `terrainVertexOffset` receive:

```text
1, 1, 1
```

That white multiplier preserves the accepted bark recipe for roots and the collar.

Only the terrain suffix receives soil multipliers. The stage rejects publication when the terrain range does not exactly match the accepted Root Geometry and Terrain Binding diagnostics.

## Tint generation

The terrain tint is derived from:

- normalized distance from the tree center;
- the stable root-safe plateau radius;
- terrain height relative to the Ground Contact plane;
- deterministic artifact-seed variation;
- an explicit plateau, relief and edge palette.

Variation is bounded into a fixed number of radial and shade bands before RGB quantization. This prevents unbounded color diversity and keeps the mobile shader path predictable.

Default limits:

```text
16 RGB values per channel
6 radial tint bands
5 variation tint bands
64 unique terrain tints maximum
```

The configured band product is validated against the unique-tint budget before publication.

## Material contract

The accepted two-material contract remains unchanged:

1. `tree:material:bark`
2. `tree:material:foliage`

The bark `MeshStandardMaterial` enables standard vertex colors. The branch mesh has no authored tint and therefore uses the renderer's white default attribute. The static root mesh receives the explicit soil color attribute:

```text
color
```

This means:

- trunk and branches keep the bark recipe;
- roots and collar keep the bark recipe through white multipliers;
- terrain receives soil appearance through the same bark shader program;
- foliage remains on the independent foliage material.

## Performance contract

Soil Surface adds:

```text
0 geometry vertices
0 geometry triangles
0 draw calls
0 materials
```

The complete Tree Lab remains bounded to:

```text
2 materials
3 draw calls maximum
```

The only added runtime data is one static RGB attribute on the already existing root/collar/terrain mesh.

## Acceptance

Automated coverage verifies:

- deterministic soil state;
- exact one-color-per-static-vertex publication;
- white root/collar prefix preservation;
- complete terrain suffix tinting;
- RGB quantization;
- stable palette identity across LODs;
- decreasing tint sample density with terrain LOD;
- upstream state immutability;
- provenance rejection;
- tint-band budget rejection;
- Three.js color attribute count and range;
- bark material vertex-color support;
- Pixel 8 Pro material and draw-call limits.

## Architectural boundary

This phase does not add:

- downloaded soil textures;
- normal, roughness or displacement maps;
- a third soil material;
- terrain streaming;
- collision or physics;
- moisture or seasonal state;
- moss, stones, flowers or grass geometry;
- production Home rollout;
- Supabase writes.

## Next phase

**Tree Ground Detail Lab** should add a bounded, instanced ground-detail vocabulary such as stones, fallen leaves or small moss cards while preserving stable IDs and an explicit mobile instance budget. It must not modify accepted terrain, root geometry or soil tint history.
