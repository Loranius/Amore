# Tree Species — Phase 17: Light Response / Canopy Shading Lab

## Purpose

Phase 17 gives the accepted layered crown a stable directional-light response without adding geometry, materials, textures or draw calls.

The layer adds:

- a published primary light direction;
- deterministic crown-side exposure;
- double-sided leaf-facing exposure;
- height and Canopy Depth layer influence;
- shade, transition and sunlit classifications;
- quantized per-instance light tint;
- one final combined tint per accepted leaf.

The result is a crown with a readable lit side, a softer transition zone and a cooler shaded side.

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
→ Soil Surface
→ Bark Surface Character
→ Ground Detail
→ Tree Life
→ Three.js Renderer
```

Canopy Light is built after Canopy Depth because its final instance tint multiplies the accepted depth tint. Tree Life remains later and captures the already depth-adjusted transforms. Light response itself adds no per-frame work.

## Stable identity

The layer publishes:

```text
tree:canopy-light:response
tree:canopy-light:instance-profile
tree:canopy-light:instance-tint
tree:canopy-depth:volume
```

Every profile is derived from the accepted leaf ID:

```text
tree:canopy-light:<accepted-leaf-id>
```

Leaf IDs, cluster IDs, branch IDs, instance sequence and crown-cell identity are preserved.

## Renderer-independent state

`TreeCanopyLightState` contains:

- Composition, Leaf Geometry, Canopy Depth and Tree Material provenance;
- artifact seed and accepted LOD;
- normalized primary light direction;
- one profile per accepted leaf;
- rolled world-space leaf normal;
- crown-side exposure;
- double-sided surface-facing exposure;
- normalized crown height;
- accepted Canopy Depth layer exposure;
- final quantized exposure;
- shade, transition or sunlit band;
- light-only tint multiplier;
- final combined depth-plus-light tint;
- mobile and preservation diagnostics.

It contains no React, Three.js, WebGL, browser or Supabase values.

## Primary light direction

The default published direction is based on the existing Tree Lab primary light position:

```text
{ x: 4, y: 7, z: 5 }
```

The pure state normalizes this vector. The Tree Lab renderer places its primary directional light along the same normalized direction, so the precomputed tonal response and the real Three.js light agree.

Changing camera angle does not regenerate the response.

## Exposure model

Exposure is derived from four bounded factors:

```text
48% crown-side exposure
22% leaf-surface facing
12% normalized crown height
18% Canopy Depth layer exposure
```

The model also applies a small deterministic exposure-band variation and a limited inner/middle layer shadow penalty.

The ambient floor is:

```text
0.68
```

This prevents shaded foliage from becoming black or unreadable on mobile displays.

## Canopy layer contribution

Canopy Depth remains authoritative:

```text
inner:  0.32 layer exposure
middle: 0.68 layer exposure
outer:  1.00 layer exposure
```

Additional shadow penalties are bounded:

```text
inner:  0.06
middle: 0.02
outer:  0.00
```

This deepens the accepted inner crown without filling negative space or moving instances.

## Exposure bands

Exposure is reduced to eight deterministic values.

The visual classification is:

```text
shade:      exposure <= 0.76
transition: 0.76 < exposure < 0.90
sunlit:     exposure >= 0.90
```

The classification changes only tint. It does not change topology, alpha, scale or animation.

## Light tint

The default band multipliers are:

```text
shade:      { r: 0.76, g: 0.82, b: 0.84 }
transition: { r: 0.90, g: 0.93, b: 0.90 }
sunlit:     { r: 1.00, g: 0.98, b: 0.92 }
```

Shade is slightly cooler, transition remains close to the accepted foliage color and sunlit foliage is subtly warmer.

The light tint is multiplied by the existing Canopy Depth tint and quantized to sixteen RGB steps.

The final published budget is:

```text
72 unique combined instance tints maximum
```

Publication fails if the limit is exceeded.

## Surface orientation

The pure layer reconstructs the accepted rolled leaf normal with an axis-angle rotation around the accepted leaf direction.

Because foliage is rendered double-sided, surface-facing exposure uses the absolute light-normal dot product. This avoids incorrectly darkening the back face of a valid leaf card.

## Renderer contract

The Three.js adapter continues to create:

```text
1 shared leaf geometry
1 foliage material
1 InstancedMesh
1 leaf draw call
```

Canopy Light writes the final combined tint into the already existing `InstancedMesh.instanceColor` buffer.

Canopy Depth still supplies the instance matrices. Canopy Light does not alter those matrices.

Tree Life captures the same depth-adjusted base transforms and continues to apply only its accepted subtle motion.

## Performance contract

Phase 17 adds:

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

The full Tree Lab ceiling remains:

```text
3 materials total
4 draw calls maximum
12,000 shared/static vertices maximum
16,000 rendered triangles maximum
80 ms deterministic build maximum
```

## Acceptance

Automated coverage verifies:

- deterministic Canopy Light state;
- one light profile per accepted leaf;
- exact leaf, Canopy Depth and crown-cell order;
- normalized primary direction;
- bounded crown-side, facing, height and layer exposure;
- bounded final exposure;
- shade, transition and sunlit accounting;
- final RGB bounds;
- combined-tint budget enforcement;
- lower-LOD identity prefix preservation;
- upstream state immutability;
- provenance rejection;
- unchanged Canopy Depth matrices;
- one existing leaf InstancedMesh;
- one final instance color per leaf;
- unchanged draw-call and material budgets;
- Pixel 8 Pro visual and runtime acceptance.

## Architectural boundary

This phase does not add:

- dynamic sun movement;
- time-of-day simulation;
- shadow maps;
- ambient occlusion textures;
- screen-space effects;
- transparency or alpha sorting;
- new leaf geometry;
- new foliage materials;
- per-frame light-profile rebuilding;
- changes to Tree Life rules;
- changes to Bark Surface or Ground Detail IDs;
- Supabase writes.

## Next phase

A later **Tree Seasonal Accent / Phenology Lab** may add bounded state-driven leaf accent changes while preserving accepted leaf IDs, Canopy Depth, Canopy Light and the current material/draw-call budget.
