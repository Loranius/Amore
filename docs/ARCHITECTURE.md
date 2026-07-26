# Evolution Engine Architecture Overview

Evolution Engine is a deterministic pipeline of seven isolated volumes:

```text
World inputs + events
        ↓
I   Core Simulation Engine        → WorldState
        ↓
II  Species Framework             → SpeciesProfile
        ↓
III Unified Growth Engine         → GrowthState
        ↓
IV  Composition Framework         → CompositionState
        ↓
V   Geometry Engine               → GeometryState
        ↓
VI  Material Engine               → MaterialState
        ↓
VII Integration Framework         → EngineState
```

Volume VII orchestrates but does not absorb the responsibilities of Volumes I–VI.

Every arrow crosses a public, runtime-validated, versioned, immutable contract. External systems connect through ports and adapters. Three.js/R3F render published geometry; Supabase persists published snapshots; neither is part of deterministic domain evaluation.

The canonical source of truth is the latest globally validated published EngineState and its referenced immutable volume states.
