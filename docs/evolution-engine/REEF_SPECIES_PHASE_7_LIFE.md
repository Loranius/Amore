# Reef Species — Phase 7: Reef Life / Ambient Colony Motion

## Purpose

Phase 7 adds deterministic renderer-independent life behavior to the accepted reef geometry and material bindings.

It defines how the reef should respond to a slow underwater current, how living tissue and polyps should move, and how the same scene becomes fully static when reduced motion is requested.

Phase 7 does not create animation loops, Three.js objects, shaders, new geometry, new material identities or Home UI.

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
→ Reef Life / Ambient Colony Motion
→ future Three.js Renderer
```

## Global current contract

The reef publishes one stable current field:

```text
reef:life:current
```

It contains:

- a normalized world-space direction;
- bounded strength and turbulence;
- a slow cycle duration;
- a deterministic phase offset.

The current depends only on the couple artifact seed and versioned Phase 7 rules. It does not read the clock, camera, device frame rate or renderer state.

## Per-colony motion contract

Every accepted Phase 5 mesh range and Phase 6 material binding receives exactly one life binding:

```text
reef:life:motion-binding:colony:{colonyId}
```

Each binding references:

- the exact colony mesh range;
- the exact colony material binding;
- a world-space pivot and normalized growth axis;
- a current-projected response direction;
- sway amplitude, frequency, phase and bend exponent;
- polyp coverage, extension and pulse profile;
- an explicit reduced-motion profile.

No colony creates a new draw call, geometry batch or material slot.

## Morphotype behavior

### Branching

Semi-rigid calcified branches receive very small current sway. Most visible life comes from restrained polyp pulsing rather than whole-colony bending.

### Massive

Massive colonies remain effectively fixed. Their motion language is limited to subtle surface polyp activity.

### Plating

Plates receive a small controlled flex response while preserving their rigid silhouette.

### Encrusting

Encrusting colonies remain attached to the substrate and do not visibly sway. Only low-amplitude polyp activity is described.

### Soft coral

Soft coral receives a flexible response with visibly stronger current influence, slow sway and the strongest soft-tissue polyp pulse.

### Sea fan

Sea fan receives the strongest current response. Its profile is membrane-like, slow and broad rather than fast or noisy.

## Motion bounds

Default ceilings:

```text
maximum motion bindings: 512
maximum sway amplitude: 0.18 radians
maximum polyp pulse amplitude: 0.12
current cycle: 8–14 seconds
```

The output is never silently truncated. If accepted colonies exceed the binding budget, diagnostics report the violation while preserving every deterministic binding.

## Reduced motion

Every colony publishes a fully static reduced-motion profile:

```text
mode: static
sway amplitude: 0
polyp pulse amplitude: 0
time scale: 0
```

The future renderer can select this profile from `prefers-reduced-motion` without rebuilding species, layout, geometry or materials.

## Stable identity and append-only behavior

Current identity depends only on the couple artifact seed. Colony motion identity depends only on the stable colony seed and accepted Phase 2 placement.

Appending later portal history:

- does not change the current field;
- does not change previous colony bindings;
- appends bindings only for newly accepted colonies.

There is no `Math.random()`, `Date.now()`, frame-dependent seed or camera-dependent motion profile.

## Diagnostics

Phase 7 verifies:

- one motion binding per mesh range;
- one source material binding per motion binding;
- no orphan material bindings;
- normalized axes and response directions;
- finite and bounded sway/polyp values;
- explicit binding budgets;
- a static reduced-motion profile for every colony;
- full Species → Layout → Foundation → Skeleton → Mesh → Material provenance.

## Boundaries

Phase 7 adds:

```text
0 vertices
0 triangles
0 geometry mutations
0 material identity mutations
0 new draw calls
0 renderer callbacks
0 Supabase reads
0 Supabase writes
```

Crystal and Tree are unchanged. Home Reef remains a truthful placeholder because the production Three.js scene is not connected yet.

## Next phase

**Reef Phase 8 — Three.js Renderer Integration / Production Reef Scene**

The next phase can consume the accepted foundation, colony batches, materials and life profiles in the portal while enforcing Pixel 8 Pro draw-call, memory, reduced-motion and frame-budget limits.
