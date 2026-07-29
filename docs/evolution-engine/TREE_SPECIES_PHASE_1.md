# Tree Species — Phase 1: Evolution Translation

## Purpose

Tree Species is the first non-crystal Species Layer implementation in Amore. It proves that the
Evolution Engine can stay unchanged while the same relationship history is translated into a different
natural system.

```text
ArtifactBlueprint
  -> Tree Species pressures and life state
  -> stable structure DNA
  -> annual and event branch instructions
  -> transitional Organic Growth adapter
  -> OrganicAttractor[] + OrganicSkeletonConfig
```

Tree Species decides what tree growth means. The organic Growth Lab still decides hosts, paths,
generations and final branch topology.

## Boundaries

The species implementation is pure TypeScript. It does not import React, Three.js, Supabase, geometry,
materials or UI.

It receives only:

- the species-neutral `ArtifactBlueprint`;
- an explicit `asOf` clock;
- an explicit Tree Species rules version.

It produces:

- tree-specific pressure interpretation;
- current life stage and maturity values;
- stable baseline structure DNA;
- annual bough instructions;
- event branch instructions;
- diagnostics for future and zero-pressure facts.

## Stable structure DNA

`TreeStructureInstruction` contains the adult analytical envelope used by Growth:

- trunk height and segment step;
- branch step;
- crown radius and height;
- base radius and radius decay;
- upward bias, direction memory and lateral jitter.

These values depend only on the artifact seed. Later events, pressure totals and the current clock never
resize or reorient the historical structure.

## Annual growth

Every completed relationship anniversary appends one `annual-bough` instruction. Its ID is
`tree:annual:<epoch>`. Existing annual instructions remain byte-stable when another year is completed.

Annual growth is derived from the official relationship start, IANA time zone and leap-day policy from
the Evolution Engine blueprint.

## Event translation

Every non-zero current event creates one stable instruction based on its dominant Evolution channel:

| Evolution channel | Tree reaction |
| --- | --- |
| achievement | crown branch |
| remembrance | memory branch |
| exploration | outward explorer branch |
| culture | ornamental lateral branch |
| stability | structural support branch |
| significance | landmark branch |

High-significance events may create a compact group of three attractors. Medium events create two;
small events create one. This count and every direction preference depend only on the event and artifact
seed, never on later global pressure totals.

Maturity may increase with the explicit clock, but it does not move the instruction's seeded morphology.
It is reserved for later foliage and Life Engine behavior.

## Organic adapter

`treeToOrganicField()` is a transitional Species-to-Growth adapter. It converts abstract branch intent
into deterministic attractor points while preserving the Organic Growth Lab as the owner of topology.

The adapter:

- maps the seed-only structure into `OrganicSkeletonConfig`;
- derives attractor positions from each instruction independently;
- processes instructions in stable chronological order;
- enforces explicit `maxAttractors` and `maxNodes` budgets;
- truncates newest growth first without deleting or rewriting old attractors;
- never uses current global pressures to move historical points.

The default laboratory cap is 32 attractors and 320 skeleton nodes.

## Guarantees tested

- event source order does not change the blueprint;
- anniversaries and channel reactions are deterministic;
- appending a later event leaves old instructions byte-stable;
- advancing time adds annual growth and maturity without moving old morphology;
- future and zero-pressure events are diagnosed but do not grow branches;
- later organic attractors append after old attractors;
- later organic skeleton nodes append after old nodes;
- explicit budgets truncate only the newest instructions.

## Explicitly not included

- production Tree renderer rollout;
- reading real portal modules or Supabase directly;
- leaves, flowers, fruit or roots geometry;
- bark or annual-ring materials;
- Composition Framework passes;
- Life Engine animation;
- replacing the existing Crystal Species;
- making Tree the default Home artifact.

## Next phase

Tree Species Phase 2 should feed this blueprint into the isolated Tree Lab preview. The preview must use
a deterministic fixture ArtifactBlueprint first, expose annual/event counts and diagnostics, and prove
that the same Phase 1–3 tree renderer accepts real Species output before any production data adapter is
connected.
