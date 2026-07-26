# Master Build Prompt for Claude Code

Use the following prompt from the existing Amore repository root.

---

You are the lead implementation agent for Evolution Engine inside Amore.

Your mission is to bring the existing implementation into conformance with `CLAUDE.md` and the normative documents under `docs/` while preserving working code, deterministic identity, and current product behavior.

## Current Amore Scope — Mandatory

- The repository already contains substantial Evolution, Species, Growth, Composition, and crystal rendering code. Audit and reuse it. Do not create parallel replacements merely because the SAS uses reference package names.
- Do not migrate the repository into a new monorepo or `packages/` layout unless the owner explicitly approves an ADR demonstrating that in-place conformance is impossible.
- Do not reconnect, redesign, or expand live Evolution Engine reactions to Wishlist, Memories, Goals, Creations, or other product modules in this task. Preserve current wiring and add only stable contracts or extension points. Product reaction integration is deferred until the modules are complete and the owner explicitly starts that phase.
- Do not implement Volume VII product orchestration or Phase 9 adapters merely to satisfy the complete roadmap. Mark genuinely deferred work `DEFERRED_BY_SCOPE` with evidence.
- The first implementation priority is the existing Amore crystal attachment path across Volumes III–VI and `docs/01_CONTRACTS/CRYSTAL_ATTACHMENT_INTEGRITY_PROFILE.md`.
- Raw overlap of independently closed crystal meshes is not an acceptable final junction strategy.

## Operating Rules

- Begin with the repository audit in `docs/04_PROMPTS/01_REPOSITORY_AUDIT_PROMPT.md`.
- Do not write engine code until you understand the existing repository, package manager, test runner, TypeScript configuration, current architecture, and current crystal pipeline.
- Map existing modules to Volumes I–VII before proposing new modules.
- Treat Volumes I–VII as fixed responsibility boundaries, not a command to duplicate already compliant code.
- Implement the smallest complete vertical slice inside the existing architecture.
- Do not start downstream work unrelated to the approved slice.
- Use immutable published state and explicit ports between deterministic core logic and external systems.
- Never use wall-clock time, `Math.random()`, locale-sensitive ordering, network I/O, database I/O, React state, or Three.js runtime objects inside deterministic evaluation functions.
- Add tests with every implementation change.
- Never state that work is complete unless the required commands and geometry/material acceptance probes were executed and reported.

## Required Initial Output

Before editing code, produce:

1. repository inventory;
2. existing implementation mapped to Volumes I–VII;
3. gap analysis against the SAS and Crystal Attachment Integrity Profile;
4. exact files and symbols responsible for growth placement, attachment, geometry caps, materials, and rendering;
5. detected conflicts and duplicate-risk areas;
6. bounded implementation plan that preserves existing modules;
7. first safe vertical slice;
8. exact verification commands and fixtures.

## First Safe Vertical Slice

Unless the audit proves a prerequisite is missing, begin with the focused prompt in `docs/04_PROMPTS/05_AMORE_CRYSTAL_INTEGRITY_PROMPT.md`.

The vertical slice SHALL:

- create or formalize attachment-junction data;
- enforce deterministic sector-balanced child placement and volumetric clearance;
- constrain overlap to junction zones;
- remove child base caps and hidden/internal faces;
- seal the external shell locally without z-fighting;
- prevent material/texture breakthrough through the host;
- add underside, intersection, topology, material-region, LOD, and determinism tests.

## Implementation Loop

For each approved slice:

1. Read its specification, profile, and checklist.
2. List applicable requirement IDs.
3. Confirm whether compliant code already exists.
4. Define or extend public contracts only where a real gap exists.
5. Patch pure deterministic domain logic before adapters.
6. Add unit, property, contract, serialization, replay, geometry, and integration tests as applicable.
7. Run the slice exit gate.
8. Update traceability and implementation status.
9. Produce an implementation report.

## Quality Bar

The engine must be deterministic, replayable, versioned, serializable, validated, observable, and safe to extend. Crystal colonies must read as one organic mineral mass from every direction, including from beneath. No production placeholder, silent fallback, architecture leak, mutable published state, uncontrolled mesh intersection, visible hidden cap, internal material breakthrough, or nondeterministic canonical output is acceptable.

Continue autonomously through safe tasks. Stop only for a genuine specification conflict, destructive migration requiring owner approval, missing secret/access, or a decision that changes the fixed architecture. When blocked, complete all unrelated safe work and provide the exact blocker.

---
