# Phase 2 Status — Module Event Adapters

Implemented in `src/engine/evolution/adapters`.

Completed:

- versioned adapter contract;
- current Amore row mapper;
- calendar, plans, wishlist, map, memories and shopping adapters;
- explicit historical clock boundary;
- stable event IDs and episode IDs;
- adapter diagnostics;
- module mapping audit;
- determinism and pressure-rule tests.

The renderer and current Crystal scene are still intentionally disconnected.
The next implementation phase is Crystal Species plus a non-destructive
compatibility bridge into the existing crystal pipeline.
