# Prompt — Amore Crystal Attachment Integrity

Use this prompt from the existing Amore repository root.

---

Audit and improve the existing Amore crystal implementation. Do not rebuild the whole Evolution Engine, do not create duplicate volume packages, and do not connect new live reactions from Wishlist, Memories, or other product modules during this task.

Read:

- `CLAUDE.md`;
- `docs/01_CONTRACTS/CRYSTAL_ATTACHMENT_INTEGRITY_PROFILE.md`;
- Volumes III–VI and their checklists;
- the current crystal Growth, Composition, Geometry, Material, renderer, and test code.

Current scope:

1. Map existing code to `V3-REQ-013..015`, `V4-REQ-013..015`, `V5-REQ-013..016`, `V6-REQ-013..015`, and `CAI-REQ-001..012`.
2. Reuse and patch existing modules rather than creating parallel implementations.
3. Preserve current product behavior and deterministic seeds unless a versioned migration is required.
4. Keep Evolution Engine reaction wiring to product data exactly as it is for now. Add only contracts or extension points required by the attachment fix.
5. Ensure module crystals grow organically from the host/mother crystal with deterministic sector balance, volumetric clearance, and outward flow.
6. Ensure intersections occur only inside explicit attachment junction zones.
7. Replace raw overlap of independently closed meshes with compliant local junction processing: trim/clip, hidden-face removal, child base-cap removal, and sealed welding or transition geometry.
8. Ensure child texture/material never appears through the host underside or unrelated host faces.
9. Validate all published LODs.

Before editing, report:

- exact existing symbols and files that own placement, attachment, geometry creation, caps, materials, and rendering;
- confirmed causes of current underside breakthrough and neighbor clipping;
- the smallest safe implementation plan;
- expected deterministic fixture changes;
- exact commands and visual/probe cases to run.

Required tests:

- fixed-seed 360-degree geometry fixture;
- strict underside and oblique underside probes;
- child base-cap absence;
- hidden/internal face visibility rejection;
- intersection-outside-junction rejection;
- minimum-spacing neighboring children;
- thin-host/thick-child stress case;
- maximum supported module count;
- material-region ownership and no texture breakthrough;
- LOD integrity;
- replay/determinism and serialization tests.

Do not claim completion from screenshots alone. Provide geometry/topology evidence, test output, changed files, satisfied requirement IDs, remaining risks, and before/after render fixtures.

---
