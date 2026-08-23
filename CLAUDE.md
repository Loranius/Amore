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
6. Before changing a product module, read `docs/MODULE_STATUS.md` — it states what each module's current state is, what "done" means, and which defects CI already knows about. Update it in the same change whenever a module's state changes; a status file nobody updates is worse than none.
7. Before changing anything a couple sees, read `PRODUCT.md` and `DESIGN.md`. `PRODUCT.md` is the north star — who this is for, what "успіх" means on each screen, and what the owner has marked immutable. `DESIGN.md` is the committed visual world, and its named rules (Two Accents, Rare Colour, Fredoka Restraint, Shadow Is A Shadow, One Blur) are binding on new UI, not advisory. `.impeccable/design.json` is its machine-readable sidecar: keep the two in step, and never edit the sidecar alone.
8. Read every upstream volume contract used by the task.

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
8. For any change a couple would see, verify it on the running portal with `npm run live -- <route>` before claiming it works, and report what was measured. Read `scripts/live/README.md` first: it lists seven ways a live screenshot has already lied in this project — a stale service worker, missing CORS on textures, no WebGL, an unspoofed device tier, screenshots taken before the scene settles, the React Query devtools button covering the dock so a `--tap` reports success and does nothing, and time itself running about twenty times slow under SwiftShader. The first six are closed in the harness; the seventh cannot be closed, so never make a frame-rate or duration claim from that sandbox.

   Extend that harness rather than writing a second one. A fresh browser context is always a *first* visit, so any behaviour that depends on memory between visits needs `--seed=<key>=<value>`; without it the screenshot shows a screen on which everything is correctly silent.
9. Report changed files, satisfied requirement IDs, commands executed, results, and remaining risks.

## Prohibitions

- No architectural redesign without an accepted ADR.
- No hidden global mutable state.
- No wall-clock dependence, locale-dependent sorting, unordered iteration in canonical output, `NaN`, `Infinity`, or implicit nondeterministic IDs.
- **Nondeterminism has exactly one address.** In `src/engine/**` there is none at all — no `Math.random()`, and no import of `@/lib/entropy` to reach it indirectly. Everywhere else in `src/`, `Math.random()` is called only inside `src/lib/entropy.ts`, where every draw carries a named reason; modules take a function whose name says why the coin is thrown. `src/lib/noRawRandom.test.ts` enforces both halves.

  This replaces a blanket ban on `Math.random()`. That ban could not be obeyed — rolling a random dish *is* the button, confetti without randomness is not confetti, and storage filenames must not collide — so it was not obeyed: fourteen call sites had accumulated under it, each looking innocent. A rule that cannot be followed is not a rule, it is a fiction that hides its own violations. Prefer a boundary someone can check over a prohibition nobody can keep.
- No production placeholders, fake implementations, silent fallbacks, swallowed errors, or tests that assert only that code runs.
- No direct database/network calls inside deterministic evaluation functions.
- No mutation after publication.
- No generated mesh inside Volumes I–IV and no material evaluation inside Volumes I–V.
- No child crystal base cap or internal face may remain externally visible, including from the underside.
- No child material may break through an unrelated host region.

## Completion Standard

A task is not complete until the relevant checklist passes and the implementation report matches `docs/06_TEMPLATES/IMPLEMENTATION_REPORT_TEMPLATE.md`.
