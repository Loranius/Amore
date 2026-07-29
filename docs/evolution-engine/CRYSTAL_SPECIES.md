# Crystal Species — Phase 3

## Purpose

Crystal Species translates the species-neutral `ArtifactBlueprint` into a deterministic crystal-specific blueprint.

It decides **what crystal morphology should grow**, but it does not decide final spatial attachment, collisions, meshes, materials or rendering.

```text
ArtifactBlueprint
  -> Crystal Species
  -> CrystalSpeciesBlueprint
  -> Universal Growth Engine (next phase)
  -> Composition / Geometry / Material / Life
```

## Architectural boundary

`src/engine/species/crystal` may import the Evolution Engine, but it must not import:

- React;
- Three.js or React Three Fiber;
- Supabase;
- application hooks;
- UI components;
- geometry or shader code;
- the current renderer implementation.

The only dependency on the current renderer is a one-way compatibility adapter in:

`src/features/home/artifact/compat/evolutionV2Bridge.ts`

Legacy fields never leak back into the new Species contract.

## Crystal pressures

Universal channels are projected into crystal behavior:

| Evolution channel | Primary crystal reaction |
|---|---|
| `exploration` | outward expansion, branching and surface complexity |
| `remembrance` | refinement and internal luminosity |
| `culture` | warmth, blade/fan/tabular morphology and color mixing |
| `stability` | cohesion, buried attachment and body density |
| `significance` | dominant spires, brilliance and emphasis |
| `achievement` | energetic satellites, twins and intergrown formations |

All pressure functions are saturating and versioned. Raw counts never scale linearly forever.

## Mother crystal

Every artifact has exactly one mother instruction:

- stable ID: `crystal:mother`;
- tier: `king`;
- seed derived only from the artifact seed;
- archetype derived only from that seed;
- direction and identity never change;
- maturity grows from the relationship start date using the explicit `asOf` clock.

The mother may become visually larger or more mature later, but it must never be replaced or re-seeded.

## Event formations

Every normalized event with non-zero pressure creates one stable instruction:

`crystal:event:<evolution-event-id>`

The instruction contains:

- source event and episode identity;
- relationship epoch;
- dominant channel;
- formation kind;
- hierarchy tier;
- archetype;
- emphasis;
- weight;
- maturity;
- seeded azimuth/elevation/radial bias;
- attachment depth preference.

It does **not** contain a final anchor or mesh transform. Those belong to the Growth Engine.

### Formation kinds

- `event-spire` — large-significance event;
- `satellite` — achievement, exploration or ordinary significance;
- `inclusion` — remembrance, culture and stability layers;
- `mother` — the single central formation.

### Hierarchy

- `king` — mother only;
- `support` — emphasized event;
- `family` — strong ordinary event;
- `companion` — medium event;
- `micro` — small everyday contribution.

## Colonies

Formations are grouped by:

`relationship epoch + dominant channel`

A colony owns only stable sector metadata and a list of formation IDs. It is not itself a mutable geometry body.

This prevents a new event from moving or re-seeding old formations. The later Growth Engine will place new members within the same stable sector.

## Append-only rules

Adding a later event may change global material pressure and colony totals, but it must not change any existing formation's:

- ID;
- seed;
- channel;
- formation kind;
- hierarchy tier;
- archetype;
- azimuth;
- elevation;
- radial bias;
- attachment depth.

Advancing explicit `asOf` may change maturity only.

Future events are diagnosed and excluded from current pressure, state and formation output.

## Compatibility bridge

`projectCrystalToLegacyPressures()` maps the new species pressures to the current renderer contract:

- `exploration` -> legacy exploration;
- `remembrance` -> legacy memory;
- `stability + significance` -> legacy connection;
- `culture` -> legacy creation;
- `achievement` -> legacy future.

The current scene is not switched in this phase. The bridge exists so a later integration can change pressure sources without rewriting proven geometry/material code in the same commit.

## Acceptance tests

Phase 3 is accepted when tests prove:

- event-order determinism;
- one stable mother;
- stable hierarchy and colony IDs;
- append-only existing formation instructions;
- time changes maturity without changing morphology;
- future facts cannot affect today's state;
- zero-pressure facts do not grow bodies;
- compatibility projection remains within current renderer ranges.
