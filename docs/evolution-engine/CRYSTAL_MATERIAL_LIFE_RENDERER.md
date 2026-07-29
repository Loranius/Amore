# Crystal Material, Life and Renderer Bridge

## Scope

Phase 6 converts the stable Crystal Species, Composition and Geometry states into:

1. `CrystalMaterialState` — deterministic physical and shader parameters.
2. `CrystalLifeState` — deterministic restrained ambient life.
3. A thin Three.js bridge that creates render objects without making domain decisions.

The current production `CrystalScene` remains on the legacy renderer until the new data-orchestration hook and visual acceptance pass are complete.

## Material boundary

The Material Engine is renderer-independent. It receives:

- `CrystalSpeciesBlueprint`;
- `CrystalCompositionState`;
- `CrystalGeometryState`;
- an explicit versioned quality configuration.

It publishes one material recipe per rendered body:

- base and emissive colors;
- roughness and metalness;
- clearcoat and clearcoat roughness;
- IOR and reflectivity;
- restrained emissive intensity;
- optional iridescence;
- procedural Fresnel/sky reflection parameters;
- deterministic internal-inclusion parameters;
- a stable complete material signature.

### Transmission policy

`transmission` is permanently `0` in this pipeline.

The existing transparent-canvas failure has already shown that Three.js transmission creates a dedicated render pass whose clear behavior can produce a white rectangle on real devices. Phase 6 therefore creates a glass-like reading through:

- clearcoat;
- Fresnel edge light;
- procedural sky/ground reflection;
- controlled iridescence;
- strong facet normals;
- restrained internal inclusions.

Materials are always opaque, depth-writing shells:

- `opacity = 1`;
- `transparent = false`;
- `depthWrite = true`.

## Quality tiers

Four deterministic tiers exist:

- `high` — full procedural reflection, inclusions and iridescence;
- `balanced` — default mobile profile;
- `low` — no iridescence, reduced reflection and inclusions;
- `fallback` — simple opaque physical material with no custom optical terms.

`resolveCrystalRendererQuality()` uses an explicit capability snapshot. Unknown hardware is never promoted to `high`.

## Life boundary

Life Engine never changes:

- topology;
- positions;
- directions;
- attachment;
- LOD;
- material identity;
- historical growth state.

It publishes only:

- slow group rotation;
- tiny X/Z tilt;
- gentle levitation;
- very small group breathing;
- deterministic per-body glow phases;
- bounded sparkle count and speed;
- a short interaction glow pulse.

The renderer passes explicit `elapsedSeconds`. Life Engine never reads `Date.now()` or `performance.now()`.

### Reduced motion

When reduced motion is enabled:

- rotation is zero;
- tilt is zero;
- levitation is zero;
- scale breathing is zero;
- sparkles are disabled.

A touch may still produce a subtle emissive response, but no transform animation.

## Three.js bridge

The bridge performs mechanical translation only:

- `CrystalMeshData` -> `THREE.BufferGeometry`;
- `CrystalBodyMaterial` -> `THREE.MeshPhysicalMaterial`;
- shader recipe -> `onBeforeCompile` uniforms and fragment terms;
- `CrystalLifeFrame` -> group transforms and emissive multipliers.

It does not know about relationship events, channels, species rules, composition scoring or growth placement.

The bridge uses no environment render target, transmission pass or postprocessing requirement.

## Preview boundary

`EvolutionCrystalObject` is a reusable R3F object for a prepared Phase 1-6 state bundle. The explicit preview query contract is:

```text
?engine=evolution
```

The query helper exists now, but the production scene does not switch automatically until real module-row orchestration and side-by-side visual acceptance are completed. The legacy renderer remains the safe default.

## Acceptance criteria

- deterministic material and life states;
- transmission permanently disabled;
- valid Three.js geometry attributes and indices;
- renderer state does not mutate upstream states;
- fallback tier disables expensive optical terms and motion;
- reduced motion freezes every continuous transform;
- all render resources expose a deterministic disposal path;
- current production scene and SVG fallback remain intact.
