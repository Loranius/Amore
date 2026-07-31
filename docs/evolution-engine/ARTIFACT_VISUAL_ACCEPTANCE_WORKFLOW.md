# Artifact Visual Acceptance Workflow

Applies to every visual improvement of the production **Crystal**, **Tree** and **Reef** artifacts.

## Mandatory sequence

1. Capture a **before** screenshot from the current `main` implementation before changing visual code.
2. Use the same device profile, viewport, portal data, selected artifact, camera framing and screenshot scope for both captures.
3. Implement the code change in a dedicated branch.
4. Pass typecheck, unit tests, production build and artifact-specific runtime budgets.
5. Capture an **after** screenshot from the final PR head.
6. Compare before and after visually against the stated goal.
7. Do not merge merely because CI is green: the change must also produce a visible improvement and must not introduce a new regression.
8. Preserve both screenshots and report the concrete visual differences when the phase is completed.

## Required acceptance report

Every completed visual phase must state:

- what changed in code;
- what remained unchanged in identity and performance budgets;
- what is visibly better in the after screenshot;
- any visual target that was not achieved;
- links or attachments for both before and after captures.

## Consistency rules

- Baseline screenshot comes from the exact commit that the feature branch is based on.
- After screenshot comes from the exact commit that is approved or merged.
- Pixel 8 Pro remains the canonical mobile viewport unless a phase explicitly targets another device.
- Camera or framing changes must be declared; otherwise they should remain stable so the comparison is honest.
- Crystal, Tree and Reef follow the same evidence standard.
