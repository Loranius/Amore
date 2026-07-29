# Tree Species — Phase 7: Tree Material Lab

## Status

Implemented behind the existing opt-in Tree Lab renderer.

## Purpose

Tree Material Lab converts accepted Tree Species, Composition, Foliage and Leaf Geometry state into exactly two renderer-independent material recipes:

1. `bark` for the organic sweep mesh;
2. `foliage` for every instanced leaf card.

The stage does not change skeleton topology, curve frames, composition, foliage clusters, leaf transforms or mesh data.

## Pipeline

```text
ArtifactBlueprint
→ Tree Species
→ Organic Skeleton
→ Curve Frames
→ Tree Composition
→ Foliage Architecture
→ Leaf Geometry
→ Tree Material State
→ Three.js adapters
```

## Published contracts

`TreeMaterialState` contains:

- source-version provenance;
- artifact seed;
- quantized bark and foliage palette;
- one stable recipe per material role;
- explicit branch and leaf bindings;
- strict budget diagnostics.

Each `TreeMaterialRecipe` contains only renderer-neutral values:

- stable ID and role;
- deterministic signature;
- RGB color;
- roughness and metalness;
- emissive fallback values;
- opacity, transparency and depth-write policy;
- flat-shading and side policy.

## Palette derivation

The palette is deterministic and based on existing accepted state:

- bark uses root stability, memory density, trunk maturity and composition balance;
- foliage uses foliage potential, crown spread, asymmetry, foliage maturity and negative space;
- artifact seed introduces only stable low-amplitude hue variation.

No wall clock, browser state, Supabase read or random runtime source participates.

## Quantization

Each RGB channel is quantized to 16 published values.

This prevents tiny floating-point differences from creating visually indistinguishable material variants or extra GPU programs. Material identity remains the same across `high`, `medium` and `low` geometry LOD.

## Material budget

The published budget is permanently fixed to two materials:

- one bark material;
- one foliage material.

The Tree Lab render path therefore remains inside the existing two-draw-call target:

- one draw call for trunk and branches;
- one draw call for all instanced leaves.

## Renderer boundary

`createThreeTreeMaterialPair()` is a thin Three.js adapter. It resolves the two accepted recipes and creates two `MeshStandardMaterial` instances.

Three.js does not choose colors, roughness, roles, palette steps or bindings.

## Tests

The phase locks:

- deterministic output;
- exactly two roles and bindings;
- RGB quantization;
- LOD-independent material identity;
- upstream-state immutability;
- rejection of any budget other than two;
- Three.js role and side mapping;
- Pixel 8 Pro fixture and portal acceptance.

## Explicit exclusions

This phase does not include:

- bark textures or normal maps;
- leaf alpha textures;
- seasonal palettes;
- wind deformation;
- wetness, snow, flowers or fruit;
- Life Engine material animation;
- production Home rollout.

## Next phase

Tree Life Lab should add a read-only time frame for subtle branch sway and leaf flutter while preserving the accepted skeleton, leaf transforms, two-material budget and append-only history.
