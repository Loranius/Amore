# Tree Lab — Phase 2: Organic Surface

## Purpose

Phase 2 converts the stable append-only skeleton from Phase 1 into renderer-independent surface data.
It does not regenerate growth and does not change production Home or Crystal rendering.

```text
OrganicSkeletonState
  -> Catmull-Rom branch curves
  -> parallel-transport frames
  -> deterministic parent/child junction anchors
  -> embedded organic collars
  -> low-poly sweep rings
  -> high / medium / low LOD meshes
```

## Research boundary

The phase keeps the useful architectural lessons from `dgreenheck/ez-tree`: generate the skeleton once,
keep meshing free of randomness, preserve endpoints while reducing detail, and derive every LOD from the
same stable structure. The Amore curve, frame and collar implementations are original TypeScript and do
not copy the reference generator.

## Curve frames

Each skeleton branch is reconstructed in stable sequence order. Non-trunk branches prepend their
existing parent node as a geometric anchor, so the curve begins inside its host branch rather than
floating beside it.

Every sampled curve point stores:

- stable sample ID and source node ID;
- position and interpolated radius;
- unit tangent;
- transported normal and binormal;
- normalized distance along the branch.

Frames use parallel transport: the previous normal is projected onto the plane perpendicular to the
new tangent. This avoids the sudden twisting commonly produced by independently rebuilding a local
basis at every point.

## Organic junction collars

Every child curve resolves a deterministic junction against the existing frame of its parent branch:

1. find the parent frame closest to the immutable parent node;
2. project the child direction into the parent's cross-section plane;
3. derive stable inset and surface contact positions;
4. flare the child radius into a compact collar;
5. skip the original centerline section hidden inside the parent;
6. connect the collar to the unchanged child curve.

The first collar ring sits inside the parent surface, the next ring reaches the parent surface, and the
remaining rings bend into the child branch. Child roots remain uncapped and embedded, so there is no
floating gap or flat disk between parent and child.

This is a deterministic mobile-friendly geometric junction, not a destructive boolean union. The
parent mesh remains unchanged and the collar overlaps it internally. A future true manifold fusion can
replace only this local meshing step without changing the Phase 1 skeleton or Phase 2 frames.

## Sweep mesh

The mesh builder emits plain arrays without importing Three.js:

- positions;
- normals;
- UV coordinates;
- triangle indices;
- stable per-branch vertex and index ranges;
- per-branch junction ring counts.

The trunk receives a closed base cap. Every terminal branch receives a separate flat-shaded end cap.
Branch roots use embedded collars and never receive root caps.

## Shared-skeleton LOD

All LOD tiers consume exactly the same `OrganicCurveFrameState`:

| LOD | Junction rings | Radial segments | Axial stride |
| --- | ---: | ---: | ---: |
| high | 3 | 10 | 1 |
| medium | 2 | 7 | 2 |
| low | 1 | 5 | 4 |

Changing LOD reduces only local collar rings, radial segments and axial samples. It never reruns
attractor growth, changes branch IDs or moves historical nodes.

## Determinism and append-only guarantees

Tests cover:

- deterministic frame and junction generation;
- no mutation of the source skeleton;
- orthonormal tangent/normal/binormal frames;
- inset collar roots inside the parent envelope;
- stable surface contact distance;
- byte-stable historical branch curves and junctions after later attractors are appended;
- finite vertex attributes and valid indices;
- preserved junctions at every LOD;
- monotonically smaller medium and low LOD meshes;
- identical branch ordering across every LOD tier.

## Explicitly not included

- Three.js `BufferGeometry` adapters;
- production renderer integration;
- destructive boolean or voxel manifold fusion;
- bark displacement or materials;
- leaves, flowers or fruit;
- wind animation;
- Tree Species event mapping;
- Coral Species.

## Next milestone

Phase 2 closes the planned geometry milestone: smooth curves, stable frames, low-poly sweep meshes,
organic parent/child junctions and shared-skeleton LOD. The next safe step is an isolated Tree Lab visual
preview and mobile performance acceptance before any Tree Species or production renderer integration.
