# Tree Species — Phase 14: Ground Detail Lab

## Purpose

Phase 14 adds a restrained vocabulary of small details around the accepted tree:

- stones;
- fallen leaves;
- moss chips.

The layer is deterministic, renderer-independent and bounded by an explicit mobile instance budget. It consumes the accepted Terrain Binding and Soil Surface but does not mutate either one.

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
→ Ground Detail
→ Tree Life
→ Three.js Renderer
```

Ground Detail is built after Soil Surface because it needs the final accepted terrain identity and appearance provenance. It remains outside Tree Life because all ground instances are anchored.

## Stable identity

The layer publishes stable semantic IDs:

```text
tree:ground-detail:field
tree:ground-detail:shared-chip
tree:ground-detail:material
```

Each logical instance has a deterministic ID:

```text
tree:ground-detail:stone:<sequence>
tree:ground-detail:fallen-leaf:<sequence>
tree:ground-detail:moss:<sequence>
```

The candidate order is fixed by artifact seed. Lower LODs expose a strict logical prefix of the higher LOD candidate stream.

## Renderer-independent state

`TreeGroundDetailState` contains:

- source Tree Species, Terrain Binding and Soil Surface versions;
- artifact seed and selected LOD;
- stable field, template and material IDs;
- one shared low-poly closed chip template;
- deterministic instances with kind, position, terrain normal, yaw, scale and quantized color;
- exact source terrain vertex provenance;
- per-kind and total instance diagnostics;
- shared-template and rendered-triangle diagnostics;
- draw-call and material estimates.

No React, Three.js, browser or Supabase types are stored in this state.

## Shared template

All three detail kinds use one small faceted hexagonal prism:

```text
12 shared vertices
20 shared triangles
```

The semantic kind is expressed through instance transforms:

- stones are compact and thick;
- fallen leaves are narrow, long and nearly flat;
- moss elements are broad and very flat.

This avoids separate geometry batches for each kind.

## Placement

Instances are distributed between 30% and 92% of the accepted terrain radius.

Placement uses:

- a stable artifact-seed phase;
- golden-angle ordering;
- deterministic radial samples;
- bounded radial jitter;
- nearest accepted terrain vertex for height and normal;
- a small kind-specific vertical offset to avoid z-fighting.

The central trunk/root-contact area is intentionally kept clear.

## Palette

Each instance publishes a quantized RGB color:

- stone: muted warm grey;
- fallen leaf: ochre-brown;
- moss: restrained green.

Channels are quantized to 16 values by default. Variation is deterministic and bounded.

## Mobile instance budgets

The default per-kind budgets are:

```text
high:   36 stones + 36 leaves + 36 moss = 108
medium: 24 stones + 24 leaves + 24 moss = 72
low:    12 stones + 12 leaves + 12 moss = 36
```

Budgets are monotonic. Publication is rejected when per-kind budgets are invalid or the shared template exceeds its explicit vertex/triangle limits.

## Renderer contract

The Three.js adapter creates:

```text
1 BufferGeometry
1 MeshStandardMaterial
1 InstancedMesh
```

Per-instance matrices align the shared chip to the accepted terrain normal and apply stable yaw/scale. Per-instance colors distinguish stones, leaves and moss.

Ground details are rendered outside the Tree Life group, so they never sway with the trunk or canopy.

## Performance contract

Phase 14 adds:

```text
1 draw call
1 material
12 shared vertices
20 shared triangles
medium: 72 instances / 1,440 rendered triangles
```

The complete Tree Lab mobile ceiling becomes:

```text
3 materials total
4 draw calls maximum
12,000 shared/static vertices maximum
16,000 rendered triangles maximum
80 ms deterministic build maximum
```

The accepted two-material Tree Material state remains unchanged. The third material belongs only to the independent Ground Detail layer.

## Acceptance

Automated coverage verifies:

- deterministic state;
- exact medium per-kind budget;
- stable low → medium → high logical ID prefixes;
- unique stable IDs;
- placement inside the accepted terrain radius;
- positive terrain-facing normals and scales;
- exact source terrain vertex provenance;
- upstream state immutability;
- provenance rejection;
- template-budget rejection;
- one Three.js InstancedMesh;
- one instance color per instance;
- one ground-detail draw call;
- Pixel 8 Pro instance, triangle, material and draw-call budgets.

## Architectural boundary

This phase does not add:

- grass blades or dense particle fields;
- downloaded textures or atlases;
- wind animation for ground elements;
- physics, collision or picking;
- seasonal replacement;
- moisture, decay or weathering;
- terrain streaming;
- Supabase writes;
- changes to accepted roots, terrain, soil, canopy, materials or Tree Life.

## Next phase

A later **Tree Bark Detail / Surface Character Lab** may add bounded bark variation, branch-age cues or procedural roughness while preserving accepted geometry, Ground Detail IDs and mobile budgets.
