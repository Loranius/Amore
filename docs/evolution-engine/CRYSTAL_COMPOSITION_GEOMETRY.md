# Crystal Composition + Geometry

## Scope

Phase 5 converts the immutable `GrowthState` into two downstream products:

1. `CrystalCompositionState` — visual hierarchy, silhouette classification and composition score.
2. `CrystalGeometryState` — deterministic indexed mesh data, attachment junctions, hidden-face trimming and mobile topology accounting.

Neither layer imports React, Three.js, React Three Fiber, Supabase, routes or renderer code.

## Composition boundary

Composition is an immutable analysis pass. It does not move, rotate, resize, delete or reattach a historical body.

It publishes:

- exactly one focal body;
- roles: focal, support, family, companion and micro;
- silhouette classification: cathedral, fan or druse;
- sector occupancy and negative-space diagnostics;
- normalized hierarchy, flow, silhouette, density, balance, rhythm, negative-space and realism scores.

This deliberately differs from the legacy post-processing framework, which could bend or resize deposited bodies. In the new pipeline those transformations would violate append-only history.

## Geometry boundary

Geometry is a pure projection of `GrowthState`.

Each body receives:

- a versioned deterministic profile;
- an LOD level derived from its stable tier;
- indexed vertex and triangle buffers;
- generated normals;
- an analytical solid matching the profile;
- bounding information;
- trim statistics.

Logical growth coordinates remain untouched.

## Junction integrity

Attached meshes receive a local backward extension (`extraSink`). This extension changes only the derived shell and keeps the visible tip in the same place.

Every junction publishes:

- host and child IDs;
- contact frame;
- contact radius;
- penetration and clearance;
- trim and seam policies;
- material blend width;
- a `sealed` validation result.

The base cap of an attached child is never part of the external shell.

## Hidden-face removal

A triangle is removed only when all seven samples are inside another analytical solid:

- three vertices;
- centroid;
- three edge midpoints.

Vertex buffers remain stable. Only the visible index list changes. This preserves profile identity and avoids expensive global Boolean operations.

## Append-only geometry contract

Appending a later event must not change an old body's:

- profile signature;
- LOD;
- world vertex positions;
- source topology;
- growth transform;
- junction identity.

A later attachment may hide additional triangles of an older shell locally. That is a derived external-shell update, not a change to the historical body itself.

## Mobile budget

Budget decisions are processed in growth order.

- Existing meshes keep their LOD when later bodies are appended.
- A new body may be downgraded from high to medium or low.
- If even low LOD cannot fit, only that body and descendants depending on it are omitted from the geometry projection.
- Growth history remains complete in `GrowthState`; omission affects rendering only.

Default mobile budget:

- 18,000 vertices;
- 30,000 visible triangles.

## Acceptance criteria

Phase 5 is accepted only when:

- composition is deterministic and leaves `GrowthState` byte-for-byte unchanged;
- exactly one focal body is published;
- every emitted index references an existing finite vertex;
- attached bodies have no external base cap;
- every included attached body has one versioned junction;
- profile signatures and world vertices of old bodies remain stable after appending a later event;
- topology budgeting never downgrades an already emitted historical body because of a later event;
- the complete TypeScript, unit-test, production-build, PWA and Pixel 8 Pro workflows are green.

## Not included

- Three.js `BufferGeometry` adapter;
- production `CrystalScene` switch;
- material and shader parameters;
- Life Engine animation;
- Tree and Coral profiles;
- GPU instancing and final renderer batching.
