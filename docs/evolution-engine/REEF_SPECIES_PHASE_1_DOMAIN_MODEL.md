# Reef Species — Phase 1: Domain Model / Growth Grammar

## Purpose

Phase 1 starts the Reef Species track without inventing renderer output.

It translates the species-neutral Evolution Engine artifact into deterministic reef intent:

- one stable substrate and water-current baseline;
- one explicit growth grammar;
- append-only annual, Schedule and event-driven colony instructions;
- stable colony morphotypes, roles, tiers and IDs;
- bounded radial and vertical placement bands for later adapters;
- an explicit colony-intent budget;
- no positions, mesh, materials, animation or UI state.

The production Reef Layout, Geometry, Material, Life and Three.js adapters consume this domain model without moving portal logic into the renderer.

## Pipeline boundary

```text
Allowed Portal Facts + Shared Schedule Days
→ Evolution Engine ArtifactBlueprint
→ Reef Species Phase 1
  → ReefStructureInstruction
  → ReefGrowthGrammar
  → ReefGrowthInstruction[]
→ Reef Colony Layout
→ Reef Geometry / Material / Life
→ Three.js Renderer
```

Reef Species consumes the same normalized history as Crystal and Tree, but translates it independently through a reef-specific source allow-list.

It does not import Tree Species and does not reuse Tree geometry assumptions.

## Stable identity

The blueprint publishes:

```text
species = reef
speciesBlueprintVersion = 1
reef:structure
reef:growth-grammar
reef:annual:<relationship-year>
reef:schedule:<relationship-year>
reef:event:<accepted-event-id>
```

Structure and grammar depend only on the artifact deterministic seed.

Appending a later event cannot change:

- existing instruction IDs;
- existing morphotypes;
- existing roles or tiers;
- existing radial or vertical bands;
- existing seeds;
- substrate shape;
- water-current direction;
- growth grammar.

Only maturity may increase with a later explicit `asOf`.

## Life stages

The relationship age maps to:

```text
settlement
juvenile
developing
established
ancient
```

The state also publishes:

- age in days;
- completed relationship years;
- epoch, accepted event and shared-days-off counts;
- substrate maturity;
- colony maturity;
- biodiversity maturity.

The clock is always explicit through `ReefSpeciesConfig.asOf`. Reef Species never reads `Date.now()`.

## Colony morphotypes

Accepted morphotypes are:

```text
encrusting
massive
branching
plating
soft-coral
sea-fan
```

They are domain intent, not geometry templates.

A later Geometry phase may create multiple LOD-specific representations while preserving the same accepted colony IDs and morphotypes.

## Evolution channel translation

Default event translation:

```text
achievement  → branching / framework
remembrance  → massive / memory
exploration  → plating / frontier
culture      → soft-coral / ornamental
culture + landmark significance → sea-fan / landmark
stability    → encrusting / foundation
significance → massive / landmark
```

High-significance events become anchor-tier landmark colonies.

Lower-weight events become primary, companion or micro colony intent without being discarded.

Zero-pressure events remain diagnostics and do not create colonies.

Future events remain diagnostics until their accepted timestamp is reached.

## Portal source boundary

Only committed facts from these modules can create event instructions or contribute pressure:

```text
calendar
plans
wishlist
map
memories
media
```

`schedule` is a separate additive input: past dates when both partners marked a day off create at most one low-profile encrusting foundation per relationship year. Schedule facts strengthen substrate maturity, substrate coverage, encrusting potential and resilience, but never inflate portal activity or Evolution channel shares.

The reef rejects all unknown sources by default. In particular, `game`, `culinary`, `where-to`, `shopping` and `piggybank` cannot affect pressures, state or growth, even if a legacy adapter puts such an event into the neutral artifact.

## Annual recruitment

Each completed relationship year publishes:

```text
reef:annual:<year-index>
```

Annual recruitment uses stable foundation morphotypes:

- encrusting;
- massive;
- soft-coral.

The selected morphotype and all intent values derive from the artifact seed and annual ID.

Annual instructions are sorted chronologically with event instructions. Later years append new recruitment without rewriting old instructions.

Schedule instructions use stable epoch IDs and seeds. Additional recorded days can fill out that epoch's foundation or add one bounded recruit; they cannot create one colony per database row.

## Growth grammar

The stable grammar publishes:

```text
id: reef:growth-grammar
radial bands: 5
vertical bands: 4
minimum spacing ratio: 0.065
annual recruitment count: 2
maximum accepted colonies: 144
```

Canonical morphotype order:

```text
encrusting
massive
branching
plating
soft-coral
sea-fan
```

The grammar is renderer-independent. It gives later layout phases stable limits and ordering but does not choose coordinates.

## Per-instruction intent

Each `ReefGrowthInstruction` publishes:

- stable ID and seed;
- explicit source module;
- source event and episode IDs;
- epoch and chronological sequence;
- dominant Evolution channel;
- morphotype;
- colony role and tier;
- landmark emphasis;
- bounded weight and maturity;
- preferred azimuth;
- radial and vertical bands;
- footprint intent;
- height intent;
- branching intent;
- recruitment count.

All continuous normalized intent values remain in `[0, 1]`.

Radial and vertical bands remain inside the grammar limits.

## Species pressures

Reef Species derives bounded pressures for later phases:

```text
substrateCoverage
verticalComplexity
branchPotential
platePotential
encrustingPotential
softCoralPotential
resilience
diversity
currentBias
```

It also publishes:

- dominant channel;
- dominance share;
- normalized channel shares.

These pressures do not mutate the Evolution ledger. Schedule support is applied after the allowed event ledger is rebuilt, so excluded modules have no indirect effect.

## Structure baseline

`ReefStructureInstruction` publishes deterministic baseline intent:

- substrate radius;
- reef height;
- shelf count;
- colony spacing;
- vertical relief;
- slope bias;
- current direction;
- current strength.

This phase does not create a terrain surface or water simulation.

## Budget behavior

Phase 1 publishes colony intent only.

```text
maximum accepted colony intents: 144
```

When source history would exceed the budget, diagnostics report:

```text
colonyBudgetExceeded = true
```

Phase 1 does not silently delete history. A later Colony Layout adapter must apply an explicit append-only truncation strategy and report the omitted newest instruction IDs.

Phase 1 adds:

```text
0 vertices
0 triangles
0 renderer instances
0 materials
0 textures
0 shaders
0 draw calls
0 per-frame updates
```

## Diagnostics

The blueprint reports:

```text
emptyHistory
excludedEventIds
zeroPressureEventIds
futureEventIds
invalidSharedDayOffDates
duplicateSharedDayOffDates
futureSharedDayOffDates
preRelationshipSharedDayOffDates
acceptedEventCountByModule
sharedDaysOffCount
annualInstructionCount
eventInstructionCount
scheduleInstructionCount
emittedColonyIntentCount
maximumAcceptedColonies
colonyBudgetExceeded
```

## Acceptance coverage

Automated tests verify:

- deterministic output regardless of source event order;
- stable structure and grammar;
- channel-to-morphotype translation;
- all accepted colony morphotypes;
- append-only existing colony intent after later events;
- annual recruitment growth through explicit time;
- maturity changes without morphology changes;
- future and zero-pressure diagnostics;
- hard source exclusion with no direct or indirect pressure changes;
- deterministic Schedule normalization, epoch grouping and bounded growth;
- bounded normalized values and band indices;
- input artifact immutability;
- rejection of invalid `asOf` and empty rules versions.

Existing application CI and Pixel 8 Pro visual acceptance must remain green even though the Reef placeholder is unchanged.

## Architectural boundary

Phase 1 does not add:

- colony coordinates;
- overlap resolution;
- substrate mesh;
- coral mesh or polyps;
- materials or textures;
- water, particles or caustics;
- Life animation;
- camera-facing cards;
- Reef UI replacement;
- Supabase reads or writes;
- changes to Tree or Crystal.

## Next phase

The next phase is **Reef Species Phase 2: Colony Layout / Substrate Occupancy**.

It should consume the accepted Reef Species blueprint and place stable colony anchors across deterministic substrate cells while preserving append-only colony identity and explicit mobile budgets.
