# Tree Species — Phase 10: Root Geometry Integration Lab

## Purpose

Phase 10 turns the accepted append-only `TreeRootArchitectureState` into real indexed sweep geometry without changing root identity, placement, taper or history.

The root mesh is intentionally rendered outside the animated `Tree Life` transform. Roots stay anchored while the trunk and foliage sway.

## Pipeline

```text
Portal Events
→ Evolution Engine
→ Tree Species
→ Organic Skeleton
→ Curve Frames
→ Tree Composition
→ Root Architecture
→ Root Geometry
→ Foliage Architecture
→ Leaf Geometry
→ Tree Material
→ Tree Life
→ Three.js Renderer
```

## Renderer-independent state

`TreeRootGeometryState` contains:

- source Root Architecture version and rules version;
- artifact seed and selected LOD;
- one indexed `OrganicSweepMesh` containing all accepted roots;
- exact root, vertex and triangle counts;
- dedicated per-LOD budgets;
- provenance diagnostics;
- an explicit `anchoredToGround: true` contract.

No Three.js classes are stored in the engine state.

## Geometry rules

- Root IDs remain `tree:root:<sequence>`.
- Mesh branch IDs must exactly match accepted root IDs.
- No root is regenerated or reordered during meshing.
- Root starts remain open where they meet the trunk and future soil interface.
- Root tips receive terminal caps.
- LOD changes only sweep density, never logical root identity.

## LOD budgets

| LOD | Radial segments | Axial stride | Max vertices | Max triangles |
| --- | ---: | ---: | ---: | ---: |
| high | 8 | 1 | 800 | 1,200 |
| medium | 6 | 1 | 650 | 950 |
| low | 4 | 2 | 400 | 600 |

Publication fails if the selected root geometry exceeds its dedicated budget or if mesh provenance differs from accepted root IDs.

## Three.js integration

The thin renderer adapter creates one `BufferGeometry` and adds root diagnostics to `geometry.userData`.

Tree Lab now renders:

1. one static root bark mesh;
2. one animated trunk/branch bark mesh;
3. one animated instanced foliage mesh.

The two-material contract remains unchanged:

- one shared bark material for roots and branches;
- one shared foliage material for all leaf instances.

The mobile draw-call budget becomes three because the anchored roots cannot share the same object transform as the moving trunk without shader deformation.

## Acceptance

Automated coverage verifies:

- deterministic root geometry;
- exact ID provenance;
- high → medium → low complexity monotonicity;
- upstream Root Architecture immutability;
- dedicated budget rejection;
- valid Three.js indexed geometry and bounds;
- fixture Pixel 8 Pro root metrics;
- total Tree Lab budget of at most 16,000 triangles and three draw calls.

## Architectural boundary

This phase does not add:

- soil or terrain;
- root textures or material variants;
- root/trunk boolean blending;
- collisions;
- weathering;
- root animation;
- production Home rollout;
- Supabase writes.

## Next phase

**Tree Ground Contact Lab** should define a renderer-independent ground/contact state: ground level, burial depth, visible root fraction, trunk contact collar and future terrain binding, without changing accepted root curves or Tree Life.
