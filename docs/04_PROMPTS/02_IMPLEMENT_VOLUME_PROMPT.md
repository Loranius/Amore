# Prompt — Implement One Volume

Implement the approved slice of Volume `<NUMBER>` only. Reuse the existing Amore owner for that responsibility; do not create a parallel package solely to match a reference path.

Before editing:

- read its specification and checklist;
- read all direct upstream contracts;
- inspect current implementation and tests;
- list applicable requirement IDs;
- identify forbidden dependencies;
- identify enabled species/profile contracts, including Crystal Attachment Integrity when applicable;
- confirm which live product reactions are deferred and must remain unchanged;
- provide a bounded plan.

Then implement the smallest complete vertical slice that advances the volume toward its exit gate. Define public contracts before infrastructure. Keep deterministic domain code pure. Add tests in the same change. Do not create downstream behavior.

Run all applicable quality gates and report:

- requirement IDs moved to VERIFIED;
- files and public symbols changed;
- tests added and their purpose;
- commands run and results;
- fixture/hash changes;
- unresolved risks;
- next safe task.

Do not claim the volume is complete until every checklist item is evidenced.
