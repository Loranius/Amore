# Amore Evolution Engine — Implementation Plan

## Scope

This is the Evolution Engine that grows one of three living artifacts from a couple's history:

- Crystal
- Tree
- Coral reef

The engine is autonomous. There is no memory currency and no manual artifact upgrade flow.

## Final pipeline

```text
Relationship data
  -> Module Event Adapters
  -> Evolution Engine
  -> ArtifactBlueprint
  -> Species Layer (Crystal | Tree | Coral)
  -> Growth Engine
  -> Composition Framework
  -> Geometry Engine
  -> Material & Shader Engine
  -> Life Engine
  -> Renderer
```

## Layer responsibilities

### Evolution Engine

Knows only relationship history.

- validates and normalizes events;
- assigns events to anniversary-based epochs;
- deduplicates repeated episodes;
- replaces historical estimates with verified records without double growth;
- accumulates normalized pressures;
- derives a stable seed from `coupleId + engineVersion`;
- produces a deterministic species-neutral `ArtifactBlueprint`;
- emits diagnostics instead of silently hiding bad input.

It must not import React, Three.js, React Three Fiber, drei, Supabase, UI, routes, geometry or materials.

### Species Layer

Translates one `ArtifactBlueprint` into species-specific growth instructions.

- Crystal Species: nucleation, facets, colonies, twins, dominant formations.
- Tree Species: trunk, roots, branch hierarchy, foliage sites.
- Coral Species: reef base, colonies, branching forms, polyps and occupied surface zones.

Only this layer changes when the selected artifact changes.

### Growth Engine

Species-agnostic structural simulation.

- growth sites;
- surface map;
- attachment;
- competition;
- density and stress;
- colony hierarchy;
- generation order;
- append-only Growth State.

### Composition Framework

Turns correct growth into a beautiful natural composition.

- hierarchy and one focal point;
- silhouette;
- density and negative space;
- balance and visual rhythm;
- competition and colonies;
- composition scoring;
- never moves historical dominant structures.

### Geometry Engine

Converts Growth State into deterministic procedural meshes.

- profiles and extrusion;
- smooth fusion and buried bases;
- species geometry;
- details;
- LOD and instancing;
- mobile topology budget.

It never decides why or where growth happens.

### Material & Shader Engine

Controls physical appearance and light interaction.

- surface and internal layers;
- roughness, clearcoat and anisotropy;
- transparency and transmission;
- reflection and refraction;
- inclusions and internal structures;
- restrained emission;
- quality tiers and fallbacks.

### Life Engine

Adds subtle life without changing history or topology.

- breathing light;
- occasional sparkle waves;
- tiny ambient movement;
- reduced-motion support;
- no permanent heavy animation.

### Renderer

Displays the result only. It does not contain evolution, species or growth decisions.

## Deterministic contract

Identical input and identical versioned configuration must always produce an identical blueprint and later an identical artifact.

Required rules:

- stable seed from `coupleId + engineVersion`;
- stable event ordering independent of database response order;
- relationship years are anniversary-based, not calendar-year buckets;
- explicit leap-day policy for 29 February;
- IANA time-zone aware date assignment;
- `episodeId` deduplication;
- verified records replace matching historical estimates;
- append-only historical growth;
- diagnostics are part of the output;
- all configuration is versioned.

## Normalized evolution channels

The universal core exposes six species-neutral pressure channels:

- `achievement`
- `remembrance`
- `exploration`
- `culture`
- `stability`
- `significance`

It also tracks normalized `portalActivity` separately.

Module adapters decide how real Amore records map into these channels. The core must not import module tables directly.

## Migration rule

The current Crystal scene must continue working throughout migration.

- Phase 1 adds the new core without changing Home or Crystal rendering.
- A compatibility bridge is added only after the core contract is stable.
- Crystal Species is implemented before Tree and Coral.
- The current crystal is replaced incrementally, never through a destructive rewrite.

## Delivery phases

### Phase 1 — Evolution Core

- public types;
- stable seed;
- anniversary timeline;
- event validation and normalization;
- historical/verified reconciliation;
- episode deduplication;
- pressure ledger;
- deterministic `ArtifactBlueprint`;
- unit tests.

### Phase 2 — Module Event Adapters

- adapter contract;
- current Amore module audit;
- mapping rules per module;
- stable event IDs and episode IDs;
- diagnostics for incomplete legacy data;
- no renderer integration yet.

### Phase 3 — Crystal Species + compatibility bridge

- translate blueprint pressures into crystal growth instructions;
- bridge those instructions into the current Crystal DNA/scene;
- verify that existing users do not lose their current artifact;
- snapshot determinism tests.

### Phase 4 — Universal Growth Engine

- Growth Sites;
- Surface Map;
- Attachment Solver;
- Competition Solver;
- Colony and Generation solvers;
- immutable/append-only Growth State.

### Phase 5 — Crystal Composition and Geometry

- dominant mother crystal;
- support/family/companion hierarchy;
- organic attachment from the shared body;
- collision checks and direction correction;
- no visible bases, seams or texture penetration;
- LOD and mobile budgets.

### Phase 6 — Crystal Material and Life

- physically believable crystal material;
- internal inclusions and restrained glow;
- device quality tiers;
- reduced-motion and WebGL fallback;
- mobile performance acceptance tests.

### Phase 7 — Tree Species

Reuse the same Evolution Core, Growth Engine and renderer pipeline. Add only tree-specific translation, composition presets, geometry profiles and materials.

### Phase 8 — Coral Species

Reuse the same universal pipeline. Add reef-specific translation, surface occupation, colony presets, coral geometry and underwater material/life presets.

## Current implementation status

Phases 1–4 are implemented in stacked branches.

Phase 5 now provides immutable crystal composition analysis, deterministic indexed geometry, junction integrity, hidden-face removal and append-only mobile topology budgeting.

The current Home page and production Crystal scene are intentionally untouched until the renderer bridge is separately validated.
