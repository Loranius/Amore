# Tree Lab — Phase 2: Organic Surface

## Purpose

Phase 2 converts the stable append-only skeleton from Phase 1 into renderer-independent surface data.
It does not regenerate growth and does not change production Home or Crystal rendering.

```text
OrganicSkeletonState
  -> Catmull-Rom branch curves
  -> parallel-transport frames
  -> low-poly sweep rings
  -> high / medium / low LOD meshes
```

## Curve frames

Each skeleton branch is reconstructed in stable sequence order. Non-trunk branches prepend their
existing parent node as a geometric anchor, so the branch surface begins inside its host branch rather
than floating beside it.

Every sampled curve point stores:

- stable sample ID and source node ID;
- position and interpolated radius;
- unit tangent;
- transported normal and binormal;
- normalized distance along the branch.

Frames use parallel transport: the previous normal is projected onto the plane perpendicular to the
new tangent. This avoids the sudden twisting commonly produced by independently rebuilding a local
basis at every point.

## Sweep mesh

The mesh builder emits plain arrays without importing Three.js:

- positions;
- normals;
- UV coordinates;
- triangle indices;
- stable per-branch vertex and index ranges.

The trunk receives a closed base cap. Every terminal branch receives a separate flat-shaded end cap.
Branch roots stay open and overlap their parent surface; proper manifold junction blending remains a
separate later phase.

## Shared-skeleton LOD

All LOD tiers consume exactly the same `OrganicCurveFrameState`:

| LOD | Radial segments | Axial stride |
| --- | ---: | ---: |
| high | 10 | 1 |
| medium | 7 | 2 |
| low | 5 | 4 |

Changing LOD reduces only surface sampling. It never reruns attractor growth, changes branch IDs or
moves historical nodes.

## Determinism and append-only guarantees

Tests cover:

- deterministic frame generation;
- no mutation of the source skeleton;
- orthonormal tangent/normal/binormal frames;
- byte-stable historical branch curves after later attractors are appended;
- finite vertex attributes and valid indices;
- monotonically smaller medium and low LOD meshes;
- identical branch ordering across every LOD tier.

## Explicitly not included

- Three.js `BufferGeometry` adapters;
- production renderer integration;
- manifold branch junction blending;
- bark displacement or materials;
- leaves, flowers or fruit;
- wind animation;
- Tree Species event mapping;
- Coral Species.

## Next phase

Phase 3 should solve organic branch junctions over this shared surface pipeline. It must preserve the
Phase 1 skeleton and Phase 2 frames, adding only deterministic local junction geometry and validation
against self-intersection or visible seams.
