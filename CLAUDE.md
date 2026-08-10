# Evolution Engine — Claude Code Project Instructions

## Mission

This repository implements the Evolution Engine defined in `docs/`. The specification is normative. Code is correct only when its behavior is traceable to a documented requirement and verified by tests.

## Required Reading

Before changing code:

1. Read `docs/00_GOVERNANCE/AI_EXECUTION_REQUIREMENTS.md`.
2. Read `docs/00_GOVERNANCE/REFERENCE_IMPLEMENTATION_PROFILE_TYPESCRIPT.md`.
3. Read `docs/01_CONTRACTS/DETERMINISM_STANDARD.md` and `docs/01_CONTRACTS/TESTING_VALIDATION_STRATEGY.md`.
4. Read the current volume in `docs/02_VOLUMES/` and its checklist in `docs/03_CHECKLISTS/`.
5. For Amore crystal work, read `docs/01_CONTRACTS/CRYSTAL_ATTACHMENT_INTEGRITY_PROFILE.md`.
6. Read every upstream volume contract used by the task.

Do not load every document without need. Read the index, then open only the relevant normative files.

## Non-Negotiable Architecture

- Volume boundaries are fixed.
- Dependencies point from lower-numbered volumes to their contracts; no volume reads another volume's private mutable state.
- Published states are immutable, versioned, validated, serializable, and hashable.
- Identical canonical inputs, versions, configuration, and seeds produce identical canonical outputs.
- Core packages do not import React, React Three Fiber, browser UI code, Supabase clients, Cloudinary clients, Auth0 clients, or application components.
- Three.js and React Three Fiber belong in adapters and visualization packages only. Existing Amore renderer code SHALL be adapted in place; reference package names do not justify duplicate implementations.
- Current live reactions from product modules into Evolution Engine remain unchanged until the owner explicitly starts the integration phase.
- For fused crystal colonies, raw overlap of independently closed meshes is non-compliant; junction zones, hidden-face removal, sealed external shell, and material isolation are mandatory.
- Supabase/PostgreSQL persist published snapshots and metadata; they are not the authoritative in-memory simulation state.
- Diagnostics and performance timing never affect authoritative hashes or decisions.

## Work Protocol

For every implementation task:

1. Inspect the repository and current git diff.
2. Identify requirement IDs affected.
3. Produce a concise implementation plan before edits.
4. Implement the smallest complete vertical slice.
5. Add or update tests in the same change.
6. Run format, lint, typecheck, unit, contract, determinism, serialization, and build gates that apply.
7. Run `python scripts/validate_documentation.py` when documentation changes.
8. For any change a couple would see, verify it on the running portal with `npm run live -- <route>` before claiming it works, and report what was measured. Read `scripts/live/README.md` first: it lists five ways a live screenshot has already lied in this project — a stale service worker, missing CORS on textures, no WebGL, an unspoofed device tier, and screenshots taken before the scene settles. Do not hand-roll a new harness; the traps are closed in that one.
9. Report changed files, satisfied requirement IDs, commands executed, results, and remaining risks.

## Prohibitions

- No architectural redesign without an accepted ADR.
- No hidden global mutable state.
- No `Math.random()`, wall-clock dependence, locale-dependent sorting, unordered iteration in canonical output, `NaN`, `Infinity`, or implicit nondeterministic IDs.
- No production placeholders, fake implementations, silent fallbacks, swallowed errors, or tests that assert only that code runs.
- No direct database/network calls inside deterministic evaluation functions.
- No mutation after publication.
- No generated mesh inside Volumes I–IV and no material evaluation inside Volumes I–V.
- No child crystal base cap or internal face may remain externally visible, including from the underside.
- No child material may break through an unrelated host region.

## Completion Standard

A task is not complete until the relevant checklist passes and the implementation report matches `docs/06_TEMPLATES/IMPLEMENTATION_REPORT_TEMPLATE.md`.
