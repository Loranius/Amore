# Tree Species — Phase 11: Tree Ground Contact Lab

## Purpose

Phase 11 defines how the accepted tree meets a future terrain surface without rewriting Root Architecture, Tree Species history or Tree Life.

It introduces an explicit renderer-independent ground/contact state with:

- a stable ground level;
- deterministic burial depth;
- visible root prefixes;
- a trunk contact collar;
- a future terrain binding contract.

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
→ Root Geometry
→ Foliage Architecture
→ Leaf Geometry
→ Tree Material
→ Tree Life
→ Three.js Renderer
```

Ground Contact is inserted between Root Architecture and Root Geometry because the accepted canonical root curves must remain immutable. Root Geometry consumes only the derived visible prefixes.

## Ground plane

`TreeGroundContactState.ground` publishes:

- stable ID `tree:ground:contact-plane`;
- explicit `levelY`;
- upward normal `(0, 1, 0)`;
- future binding ID `tree:terrain:future`.

The ground level depends on the stable tree base radius and configured burial limits. It does not depend on the number of later roots, so existing root contact does not move when the tree ages.

## Burial and visible roots

Accepted root curves are never edited.

For every root, Ground Contact creates a derived visible prefix:

1. retain canonical samples above the ground level;
2. interpolate one stable crossing sample exactly at the ground plane;
3. stop the rendered curve at that crossing;
4. retain the original root ID `tree:root:<sequence>`.

The state records:

- source and visible sample counts;
- source and visible path lengths;
- visible path fraction;
- buried canonical sample IDs.

Older visible root prefixes remain byte-stable when later roots are appended.

## Trunk contact collar

The contact collar has stable ID `tree:ground:trunk-collar` and describes a three-ring tapered transition between:

- the future soil level;
- the root flare;
- the accepted trunk base.

Root Geometry merges the collar vertices and triangles into the existing static root `OrganicSweepMesh`.

Consequences:

- no extra draw call;
- no extra material;
- roots and collar use the existing bark material;
- the collar stays outside the animated Tree Life group;
- the two-material contract remains unchanged.

## LOD

Collar radial segments:

| LOD | Segments |
| --- | ---: |
| high | 12 |
| medium | 8 |
| low | 6 |

LOD changes only geometry density. Ground level, burial depth, root IDs and contact meaning remain unchanged.

## Acceptance

Automated coverage verifies:

- deterministic contact state;
- explicit positive burial depth;
- visible path fraction between zero and one;
- all rendered root samples at or above the ground plane;
- root termination exactly at the ground plane;
- append-only stability as the tree ages;
- upstream Species and Root Architecture immutability;
- merged collar geometry and renderer metadata;
- zero additional draw calls and materials;
- exactly two material roles;
- at most three Tree Lab draw calls;
- Pixel 8 Pro fixture acceptance.

## Architectural boundary

This phase does not add:

- a visible soil or terrain mesh;
- terrain height sampling;
- root/terrain collision;
- root boolean subtraction;
- soil textures or a third material;
- weathering or moisture;
- root animation;
- production Home rollout;
- Supabase writes.

## Next phase

**Tree Terrain Binding Lab** may provide a renderer-independent heightfield adapter and visual ground surface while preserving `tree:ground:contact-plane`, existing root IDs and the two-material tree contract where possible.
