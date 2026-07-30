# Tree Species — Phase 21: Production Acceptance / Pipeline Consolidation

## Purpose

Phase 21 closes the first complete Tree Species implementation as one production-published pipeline.

It does not add another visual effect. Instead it:

- publishes one renderer-independent production acceptance contract;
- verifies every accepted phase in canonical order;
- verifies the complete leaf-identity chain;
- verifies ground, terrain, soil, bark, negative-space and Ground Detail preservation;
- centralizes the mobile budget used by build and runtime acceptance;
- stabilizes portal-history `asOf` across reloads during the same relationship-local day;
- removes the temporary practice of attaching Phenology, Orientation and Crown Silhouette states to Canopy Light;
- keeps fixture mode as an explicit regression baseline and portal fallback;
- keeps all accepted visuals, geometry, materials and Tree Life rules unchanged.

## Canonical production pipeline

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
→ Crown Silhouette / Negative Space
→ Soil Surface
→ Bark Surface Character
→ Ground Detail
→ Tree Life
→ Three.js Renderer
```

The pure production contract records the twenty engine phases from Tree Species through Tree Life. The Three.js adapter and real draw-call count are verified by runtime acceptance after WebGL warmup.

## Stable contract identity

Phase 21 publishes:

```text
tree:production-acceptance:contract
tree:production-pipeline:v1
tree:production-runtime:mobile
tree:production-identity:leaf-chain
```

`TreeProductionAcceptanceState` contains:

- couple ID;
- artifact seed;
- accepted LOD;
- stable `asOf` and its policy;
- one ordered checkpoint per phase;
- one deterministic phase fingerprint per checkpoint;
- one leaf-chain identity signature;
- static preservation diagnostics;
- static mobile-budget diagnostics;
- deterministic production signature;
- static pass/fail status and violations.

The contract contains no React, Three.js, WebGL, browser query state or Supabase client values.

## Phase order acceptance

The order is append-only and explicit:

```text
01 tree-species
02 organic-skeleton
03 curve-frames
04 tree-composition
05 root-architecture
06 ground-contact
07 terrain-binding
08 root-geometry
09 foliage-architecture
10 leaf-geometry
11 tree-material
12 canopy-depth
13 canopy-light
14 phenology
15 leaf-orientation
16 crown-silhouette
17 soil-surface
18 bark-surface
19 ground-detail
20 tree-life
```

Publication reports failure when:

- a phase is missing;
- a phase appears in another position;
- a rules version is empty;
- a phase fingerprint is empty.

## Leaf identity chain

The accepted leaf order must remain identical through:

```text
Leaf Geometry
= Canopy Depth
= Canopy Light
= Phenology
= Leaf Orientation
= Crown Silhouette
```

Tree Life is allowed to animate only its mobile profile budget. Its leaf IDs must therefore be an exact prefix of accepted Leaf Geometry IDs.

The contract publishes:

```text
leafIdentityChainPreserved
lifeLeafPrefixPreserved
identitySignature
```

No renderer may reorder the accepted instance sequence.

## Static preservation acceptance

The contract requires all of the following:

- Crown Silhouette negative-space acceptance passed;
- roots remain anchored to the published ground contact;
- terrain remains merged into static root geometry;
- Soil Surface terrain tint remains preserved by Bark Surface;
- branch and static bark geometry ranges remain unchanged;
- Ground Detail remains anchored to terrain;
- Ground Detail keeps its stable low → medium → high prefix.

A failed condition is published as an explicit violation instead of silently degrading the tree.

## Central mobile budget

The production source of truth is:

```text
TREE_PRODUCTION_MOBILE_BUDGET
```

Limits:

```text
12,000 shared/static vertices
16,000 rendered triangles
80 ms deterministic build
4 runtime draw calls
3 materials
```

Static acceptance verifies:

- vertices;
- triangles;
- estimated draw calls;
- materials;
- Tree Life matrix updates do not exceed accepted leaf instances.

Runtime acceptance adds:

- measured build time;
- measured WebGL draw calls after warmup.

Runtime states:

```text
warming
pass
fail
```

The old Tree Lab budget API remains only as a compatibility wrapper for older phase tests.

## Reload-stable portal history

Previously the portal adapter used the exact mount timestamp:

```text
new Date().toISOString()
```

Two reloads a few seconds apart could therefore publish different `asOf` values despite identical relationship history.

Production portal builds now use:

```text
resolveTreeProductionAsOf(now, "Europe/Kyiv")
```

The resolver maps every instant of one Kyiv relationship-local day to one stable timestamp:

```text
YYYY-MM-DDT12:00:00.000Z
```

Policies:

```text
couple-day    portal history
fixed-fixture regression fixture
```

The tree changes when accepted history changes or when the relationship-local day changes, not merely because the page was reloaded a few seconds later.

## Renderer consolidation

Earlier phases temporarily attached downstream states to a cloned Canopy Light object:

```text
canopyLight.phenology
canopyLight.leafOrientation
canopyLight.crownSilhouette
```

Phase 21 removes that hidden dependency.

`TreeLabObject` now receives explicit independent states:

```text
canopyDepth
canopyLight
phenology
leafOrientation
crownSilhouette
```

The renderer adapter still receives the same ordered state chain and creates the same result:

```text
1 shared leaf geometry
1 foliage material
1 InstancedMesh
1 leaf draw call
```

Tree Life captures the already polished base matrices exactly as before.

## Portal and fallback behavior

Production Home continues to request portal history for the Tree artifact.

Possible sources:

```text
portal
fixture-fallback
fixture
```

- `portal` uses the read-only normalized relationship snapshot and `couple-day` policy;
- `fixture-fallback` is explicit when portal data cannot be assembled;
- `fixture` remains the deterministic technical baseline.

Fallback is never presented as portal history. The source and `asOf` policy are published in diagnostics.

## Runtime diagnostics

The rendered tree publishes:

```text
data-tree-production-acceptance
data-tree-production-contract-id
data-tree-production-pipeline-id
data-tree-production-runtime-id
data-tree-production-static-status
data-tree-production-runtime-status
data-tree-production-signature
data-tree-production-identity-signature
data-tree-production-as-of
data-tree-production-as-of-policy
data-tree-production-phase-count
data-tree-production-phase-order
data-tree-production-leaf-chain
data-tree-production-life-prefix
data-tree-production-negative-space
data-tree-production-ground-anchored
data-tree-production-terrain-merged
data-tree-production-soil-preserved
data-tree-production-bark-preserved
data-tree-production-ground-detail-anchored
data-tree-production-ground-detail-prefix
```

Legacy `data-tree-lab-*` diagnostics remain available for existing regression tests and technical preview links.

## Acceptance coverage

Automated coverage verifies:

- deterministic production state and signature;
- exact twenty-phase order;
- non-empty rules versions and fingerprints;
- exact leaf identity chain;
- Tree Life prefix identity;
- all preservation conditions;
- all three LODs pass the static production contract;
- low leaf IDs remain an ordered subset of medium and medium remain an ordered subset of high;
- fixture wrapper and generic build remain equal;
- couple-day `asOf` is stable across reloads;
- runtime warming/pass/fail behavior;
- Pixel 8 Pro fixture contract survives reload with the same signature;
- portal history or explicit fixture fallback remains accepted after reload;
- measured draw calls and build time remain inside the published mobile budget.

## Architectural boundary

Phase 21 does not add:

- new tree geometry;
- new leaves;
- new materials or textures;
- new draw calls;
- new shaders or post-processing;
- new Tree Life motion;
- history mutation;
- Supabase writes;
- automatic pruning;
- weather or time-of-day simulation;
- Reef implementation.

## Production status

After Phase 21, the first Tree Species pipeline is production-accepted as a complete deterministic renderer path.

Further Tree work should be treated as a new versioned capability rather than another unfinished foundational phase.

The next major species track can now begin with **Reef Species Phase 1: Domain Model / Growth Grammar**, while Tree growth integration with live Evolution events remains a separate explicitly versioned track.
