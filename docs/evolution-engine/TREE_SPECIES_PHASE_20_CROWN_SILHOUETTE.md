# Tree Species — Phase 20: Crown Silhouette Polish / Negative Space Acceptance

## Purpose

Phase 20 gives the accepted crown its final bounded silhouette polish without adding or removing leaves.

The phase:

- nudges only accepted outer leaves toward the published silhouette envelope;
- preserves inner and middle leaf positions exactly;
- preserves accepted crown cells, vertical bands and empty outer sectors;
- reduces or preserves average outer-envelope error;
- keeps Phenology colors, Canopy Light, Leaf Orientation and Tree Life unchanged;
- adds no geometry, materials, textures, draw calls or per-frame work.

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
→ Canopy Light Response
→ Seasonal Accent / Phenology
→ Leaf Orientation / Micro-Variation
→ Crown Silhouette Polish / Negative Space Acceptance
→ Soil Surface
→ Bark Surface Character
→ Ground Detail
→ Tree Life
→ Three.js Renderer
```

Crown Silhouette runs after Leaf Orientation because it publishes the final accepted base matrix used by Tree Life.

## Stable identity

The layer publishes:

```text
tree:crown-silhouette:polish
tree:crown-silhouette:instance-profile
tree:crown-silhouette:instance-matrix
tree:crown-silhouette:negative-space
```

Every profile keeps the accepted leaf ID:

```text
tree:crown-silhouette:<accepted-leaf-id>
```

Leaf IDs, sequence, branch IDs, cluster IDs and crown-cell IDs remain unchanged.

## Envelope model

The accepted `TreeComposition.silhouette` selects a bounded vertical envelope:

- `columnar` keeps a narrower, more even crown;
- `oval` uses the broadest middle section;
- `umbrella` emphasizes the upper-middle crown;
- `windswept` keeps a slightly broader upper reach.

The target is evaluated from the accepted crown height and radius. No camera, clock, random frame value or browser state participates.

## Bounded correction

Only `outer` Canopy Depth profiles may change.

Default maximums:

```text
radial position correction: 3.5% of accepted crown radius
additional leaf scale delta: 4%
envelope response: 58%
```

The correction moves along the existing horizontal radial direction. It cannot change azimuth sector or vertical band.

Inner and middle leaves publish:

```text
renderPosition = Canopy Depth renderPosition
scaleMultiplier = 1
```

This keeps the accepted internal gaps intact.

## Negative-space acceptance

The pure state records outer-leaf occupancy across 16 azimuth sectors and five vertical bands.

Publication requires:

- exact preservation of empty outer-sector indices;
- no previously empty outer sector becoming occupied;
- exact preservation of vertical bands;
- exact preservation of crown-cell provenance;
- unchanged leaf count and order;
- average outer-envelope error not increasing.

A failed preservation condition throws before renderer publication.

## Renderer contract

The Three.js adapter continues to create:

```text
1 shared leaf geometry
1 foliage material
1 InstancedMesh
1 leaf draw call
```

The final leaf matrix combines:

```text
Leaf Geometry basis
× Leaf Orientation rotation
× Canopy Depth scale
× Crown Silhouette scale
+ Crown Silhouette render position
```

Phenology and Canopy Light continue to own `instanceColor`.

Tree Life captures the final polished base matrices and applies only its existing bounded motion.

## Performance contract

Phase 20 adds:

```text
0 vertices
0 triangles
0 leaf instances
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

## Acceptance coverage

Automated coverage verifies:

- deterministic state;
- one profile per accepted leaf;
- stable leaf IDs, order and LOD transforms;
- bounded radial correction and scale delta;
- untouched inner and middle profiles;
- preserved empty sectors, vertical bands and crown cells;
- non-increasing envelope error;
- upstream immutability and provenance rejection;
- one existing Three.js leaf InstancedMesh;
- unchanged final instance colors;
- unchanged mobile material and draw-call ceilings;
- Pixel 8 Pro visual/runtime acceptance.

## Architectural boundary

This phase does not add leaf deletion, leaf creation, alpha trimming, camera-facing cards, dynamic pruning, branch topology changes, weather simulation, shadow maps, post-processing, Supabase writes or new Tree Life rules.

## Next phase

The next phase is **Tree Production Acceptance / Pipeline Consolidation**: audit the complete Tree Species pipeline, remove temporary Lab-only assumptions where safe, verify portal-history behavior and publish the production acceptance contract.
