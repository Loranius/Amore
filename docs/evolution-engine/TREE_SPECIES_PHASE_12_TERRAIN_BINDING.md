# Tree Species — Phase 12: Terrain Binding Lab

## Purpose

Phase 12 fulfils the stable terrain slot published by `TreeGroundContactState` and adds a visible bounded heightfield around the tree without changing the accepted contact plane, root IDs or Tree Life.

The surface is merged into the existing anchored root geometry. The renderer therefore keeps the same two materials and the same three-draw-call mobile contract.

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
→ Tree Life
→ Three.js Renderer
```

## Renderer-independent state

`TreeTerrainBindingState` contains:

- stable binding ID `tree:terrain:binding`;
- fulfilled source slot `tree:terrain:future`;
- stable surface ID `tree:terrain:surface`;
- stable heightfield ID `tree:terrain:heightfield`;
- source Ground Contact provenance;
- explicit LOD;
- stable center and ground level;
- surface and root-safe plateau radii;
- indexed positions, normals, UVs and triangles;
- dedicated terrain budgets and diagnostics.

No Three.js classes, DOM state or implicit clocks are stored in this layer.

## Heightfield rules

The visible terrain is a deterministic polar grid:

1. one center vertex;
2. a fixed number of rings selected by LOD;
3. a fixed number of radial segments selected by LOD;
4. a flat central plateau covering the complete accepted visible root footprint;
5. restrained deterministic relief only outside that plateau.

The relief phase depends only on the artifact seed. It cannot reorder roots or change the stable ground plane.

## Ground and root invariants

- `groundLevelY` exactly equals `tree:ground:contact-plane.levelY`.
- `plateauRadius >= rootCoverageRadius`.
- Every accepted visible root remains inside the flat contact plateau.
- Root IDs remain `tree:root:<sequence>`.
- Ground Contact and canonical root curves remain immutable.
- LOD changes mesh density only, not terrain identity, radius or ground level.

## Mobile terrain budgets

| LOD | Radial segments | Rings | Max vertices | Max triangles |
| --- | ---: | ---: | ---: | ---: |
| high | 32 | 7 | 240 | 440 |
| medium | 24 | 6 | 170 | 300 |
| low | 16 | 4 | 80 | 140 |

Publication fails when a selected terrain surface exceeds its dedicated budget.

## Static geometry integration

The terrain arrays are appended to the same static `OrganicSweepMesh` that already contains:

- visible root sweeps;
- the trunk contact collar.

All terrain indices are offset into the combined vertex buffer. Root branch ranges and root provenance remain unchanged because terrain vertices do not create synthetic root branch IDs.

The combined anchored object uses the existing bark material.

## Renderer budget

Tree Lab remains:

1. one static root + collar + terrain bark mesh;
2. one animated trunk/branch bark mesh;
3. one animated instanced foliage mesh.

Consequently:

- terrain additional draw calls: `0`;
- terrain additional materials: `0`;
- total material programs: `2`;
- total draw-call budget: `3`.

## Acceptance

Automated coverage verifies:

- deterministic terrain output;
- stable binding IDs;
- exact Ground Contact level preservation;
- complete root-footprint plateau coverage;
- LOD identity stability and complexity monotonicity;
- upstream Tree Species and Ground Contact immutability;
- terrain-specific budget rejection;
- merged root/collar/terrain renderer geometry;
- unchanged two-material and three-draw-call contracts;
- Pixel 8 Pro fixture acceptance and screenshot output.

## Architectural boundary

This phase does not add:

- arbitrary external terrain data;
- runtime terrain streaming;
- collisions or physics;
- soil textures or a third material;
- moisture, seasons or erosion;
- terrain deformation by roots;
- production Home rollout;
- Supabase writes.

## Next phase

**Tree Soil Surface Lab** should define a renderer-independent soil appearance treatment using the current material budget, including controlled vertex tint or procedural shading, without adding texture downloads or changing root identity.
