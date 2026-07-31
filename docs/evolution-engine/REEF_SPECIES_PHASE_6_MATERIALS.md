# Reef Species — Phase 6: Reef Materials / Morphotype Surface Language

## Purpose

Phase 6 converts the accepted Phase 3 foundation mesh and Phase 5 colony mesh batches into deterministic renderer-independent material assignments.

It defines how reef surfaces should react to light without creating Three.js materials, textures, shaders, animation callbacks or Home UI.

## Pipeline

```text
Portal Events
→ Evolution Engine
→ Reef Species Blueprint
→ Colony Layout / Substrate Occupancy
→ Substrate Geometry / Reef Foundation Mesh
→ Colony Geometry Grammar / Morphotype Skeletons
→ Colony Mesh Geometry / Morphotype Meshing
→ Reef Materials / Morphotype Surface Language
→ future Reef Life
→ Three.js Renderer
```

## Material-slot contract

Phase 6 publishes exactly one bounded material slot for the foundation and one for each morphotype:

```text
slot 0  reef:material:foundation
slot 1  reef:material:colony:branching
slot 2  reef:material:colony:massive
slot 3  reef:material:colony:plating
slot 4  reef:material:colony:encrusting
slot 5  reef:material:colony:soft-coral
slot 6  reef:material:colony:sea-fan
```

Default total:

```text
7 material slots
7 future draw calls
0 textures
0 custom shader programs
0 per-frame updates
```

Per-colony variation does not allocate new material slots. Every Phase 5 range receives a stable tint binding that a future renderer can consume as a vertex attribute or equivalent batched input.

## Foundation surface language

The foundation uses one substrate-rock material with bounded modifiers for its existing Phase 3 surfaces:

- top: slightly lighter and less rough;
- side: darker and rougher;
- bottom: darkest and roughest.

The modifiers do not alter topology, indices, normals or UVs.

## Morphotype surface language

- Branching: warm calcified coral with moderate roughness, restrained clearcoat and low subsurface response.
- Massive: dense, matte calcified mass with the highest roughness among living hard-corals and very low transmission.
- Plating: slightly smoother calcified plates with stronger edge response and modest transmission through thin sections.
- Encrusting: low, rough calcified coverage with restrained gloss so it remains visually attached to the substrate.
- Soft coral: soft-tissue response with stronger sheen, subsurface intent and bounded transmission.
- Sea fan: thin gorgonian tissue with moderate sheen and transmission while remaining opaque at the contract level.

## Palette contract

Every palette publishes bounded linear RGB intent: base, highlight, shadow and subsurface colors.

The couple seed applies one small stable hue shift to the entire reef. Each colony seed applies a smaller stable local tint variation. Later history only appends new bindings; previous material profiles and bindings remain byte-identical.

No palette term reads camera state, renderer state, `Date.now()` or `Math.random()`.

## Surface-response contract

Every material publishes bounded renderer-independent PBR intent: roughness, zero metalness, clearcoat, sheen, transmission, thickness, IOR, opaque alpha, subsurface strength and zero emission.

Phase 6 deliberately adds no glow. Any future living light belongs to Reef Life, not the material layer.

## Stable identity

```text
reef:materials
reef:material:foundation
reef:material:colony:{morphotype}
reef:material-binding:colony:{colonyId}
```

Bindings reference the exact Phase 5 mesh range they decorate.

## Budget behavior

```text
maximum material slots: 7
maximum colony range bindings: 512
```

Output is never silently truncated. Diagnostics report budget violations while preserving every deterministic assignment and binding.

## Acceptance

Tests verify deterministic output, input immutability, all seven material slots, bounded colors and PBR values, one binding per mesh range, append-only preservation, provenance, explicit budgets and zero textures, shaders or per-frame updates.

## Boundaries

Phase 6 adds zero vertices, triangles, index changes, textures, custom shaders, Three.js objects, animation callbacks, Home draw calls, Supabase reads or Supabase writes.

Crystal and Tree are unchanged. Home Reef remains a truthful placeholder until renderer integration.

## Next phase

**Reef Phase 7 — Reef Life / Ambient Colony Motion**

The next phase may add bounded current response, polyp motion and reduced-motion behavior without changing historical topology or material identity.
