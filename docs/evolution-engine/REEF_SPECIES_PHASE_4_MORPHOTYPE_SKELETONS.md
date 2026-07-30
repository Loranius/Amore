# Reef Species — Phase 4: Colony Geometry Grammar / Morphotype Skeletons

## Purpose

Phase 4 converts every accepted Phase 2 colony anchor and Phase 3 foundation attachment into a stable renderer-independent structural skeleton.

It does not create final coral mesh geometry yet. It defines the exact logical structure that later geometry adapters must follow.

## Pipeline

```text
Portal Events
→ Evolution Engine
→ Reef Species Blueprint
→ Colony Layout / Substrate Occupancy
→ Substrate Geometry / Reef Foundation Mesh
→ Colony Geometry Grammar / Morphotype Skeletons
→ future Colony Mesh Geometry
→ future Reef Materials
→ future Reef Life
→ Three.js Renderer
```

## One skeleton per colony

Each accepted colony receives exactly one:

```text
reef:colony-skeleton:{colonyId}
```

The skeleton preserves:

- colony ID;
- foundation attachment ID;
- morphotype;
- role and tier;
- maturity;
- footprint radius;
- target height;
- deterministic seed;
- chronological sequence.

Earlier skeletons remain byte-identical when later portal history appends new colonies.

## Local coordinate basis

Every skeleton is rooted in an orthonormal basis derived from the Phase 3 attachment:

```text
origin  = foundation attachment position
up      = normalized substrate normal
forward = projected colony facing direction
right   = cross(up, forward)
```

Skeleton node positions use local coordinates:

```text
x = right
y = up
z = forward
```

This prevents Phase 4 from duplicating world transforms and allows later geometry to attach precisely to the foundation surface.

## Stable primitives

Phase 4 publishes three logical primitive groups.

### Nodes

```text
root
axis
junction
tip
rim
lobe
control
```

Each node has a stable ID, parent reference, local position, radius and influence.

### Segments

```text
trunk
branch
rib
stalk
lobe
boundary
```

Each segment references existing start and end node IDs and carries start/end radii.

### Surfaces

```text
massive-envelope
plate-disc
encrusting-patch
soft-lobe-envelope
fan-membrane
```

Surfaces reference stable node loops or control sets. They are instructions, not triangles.

## Morphotype grammar

### Branching

- central segmented axis;
- 3–7 radial branches;
- bounded branch reach;
- optional mature twigs;
- no prebuilt surface primitive.

### Massive

- root and apex axis;
- 6–9 radial control nodes;
- root and apex ribs;
- one massive envelope instruction.

### Plating

- short central stalk;
- 8–11 rim nodes;
- radial spokes;
- closed rim boundary;
- one plate-disc instruction.

### Encrusting

- substrate root;
- 8–11 low boundary nodes;
- radial ribs and closed perimeter;
- one encrusting-patch instruction.

### Soft coral

- two-stage flexible stalk;
- 4–8 lobes;
- two logical segments per lobe;
- one soft-lobe envelope instruction per lobe.

### Sea fan

- planar vertical spine;
- paired lateral branches;
- transverse ribs;
- one fan membrane perimeter.

The sea-fan local plane is already oriented from the Phase 2 current-aware facing intent.

## Determinism

Variation is derived only from:

```text
artifact DNA
+ stable colony seed
+ stable skeleton ID
+ versioned rules
```

There is no `Math.random()`, `Date.now()`, camera dependency or renderer state.

Angular variation is quantized to 24 stable directions.

## Logical budget

Default ceilings:

```text
maximum nodes: 3,200
maximum segments: 4,000
maximum surfaces: 720
```

The output is never silently truncated. A reduced or invalid budget sets `logicalBudgetExceeded` while preserving all deterministic skeletons.

Phase 4 adds:

```text
0 renderer vertices
0 renderer triangles
0 renderer instances
0 materials
0 textures
0 shaders
0 draw calls
0 per-frame updates
0 Supabase reads
0 Supabase writes
```

## Acceptance

Tests verify:

- deterministic output;
- Phase 1–3 input immutability;
- exactly one skeleton per accepted colony;
- all six morphotype grammars;
- orthonormal attachment bases;
- valid node, segment and surface references;
- stable positive radii and spans;
- append-only preservation after later history;
- explicit logical budget reporting;
- provenance rejection;
- zero renderer/runtime budgets.

## Home boundary

The Home Reef slot remains a truthful placeholder. Phase 4 still publishes no final coral vertices, triangles, materials or Three.js objects.

## Next phase

**Reef Phase 5 — Colony Mesh Geometry / Morphotype Meshing**

The next phase will convert these skeleton primitives into bounded renderer-independent vertex/index buffers while preserving colony IDs, foundation attachments and mobile budgets.
