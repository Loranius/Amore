# Implementation Roadmap

## Current Scope Control

This roadmap describes the complete architecture, but execution inside Amore is incremental.

- Existing compliant modules SHALL be reused.
- Reference package names do not require repository restructuring.
- The current approved slice is Crystal Attachment Integrity across Volumes III–VI.
- New live reactions from Wishlist, Memories, Goals, Creations, and other product modules are deferred.
- Volume VII product orchestration and Phase 9 product integration remain `DEFERRED_BY_SCOPE` until explicit owner approval.

## Phase 0 — Repository Audit and Baseline

Deliverables:

- repository inventory;
- dependency and lockfile analysis;
- current architecture mapped to Volumes I–VII;
- reusable existing code map;
- duplicate-risk and migration-risk report;
- baseline test and render/probe results;
- crystal pipeline map from placement to renderer;
- implementation status file.

Gate: no implementation begins with an unknown failing baseline or an unmapped existing owner.

## Phase 1 — Shared Contracts and Deterministic Kernel

Implement only missing shared foundations required by the approved slice:

- identifiers and version types;
- canonical serializer and hashing;
- deterministic comparator and PRNG abstraction;
- immutable state helpers;
- result/error and validation types;
- fixtures and test vectors.

Gate: required foundations match on supported environments. Existing working equivalents count when verified.

## Phase 2 — Volume I

Audit existing timeline, events, replay, and pressure/history logic. Patch only confirmed gaps required by the approved slice.

Gate: relevant replay hashes match. Unrelated expansion may remain deferred.

## Phase 3 — Volume II

Audit the existing crystal SpeciesProfile and constraints. Add only the profile fields or versioning needed by the attachment slice.

Gate: crystal profile generation and constraint serialization are reproducible.

## Phase 4 — Volume III: Attachment-Safe Growth

Implement or patch:

- volumetric child reservations;
- deterministic sector-balanced, non-clumping placement;
- minimum angular/surface/volume clearance;
- outward organic direction flow;
- collision rejection outside junction zones;
- stable replay and append behavior.

Gate: `V3-REQ-013..015` and `CAI-REQ-001..003` are verified.

## Phase 5 — Volume IV: Attachment Junctions

Implement or formalize:

- canonical `AttachmentJunction` records;
- host/child ownership;
- contact frame, penetration, radius, clearance, allowed-overlap bounds;
- trim, seam, and material-blend policies;
- deterministic ordering and serialization.

Gate: `V4-REQ-013..015` and `CAI-REQ-004` are verified.

## Phase 6 — Volume V: External-Shell Geometry

Implement or patch:

- provisional junction geometry classification;
- child base-cap removal;
- hidden/internal face removal;
- local trim/Boolean/junction transition;
- sealed welding without z-fighting;
- topology, underside, intersection, and LOD validation.

Gate: `V5-REQ-013..016` and `CAI-REQ-005..008`, `CAI-REQ-011..012` are verified.

## Phase 7 — Volume VI: Material Integrity

Implement or patch:

- external-region-only bindings;
- seam-band blend masks;
- texture/normal/emissive isolation;
- underside no-breakthrough validation;
- LOD-consistent material ownership.

Gate: `V6-REQ-013..015` and `CAI-REQ-009..012` are verified.

## Phase 8 — Volume VII

Status for current task: `DEFERRED_BY_SCOPE`.

Do not expand scheduler, event routing, save/load orchestration, or live module reactions unless a later owner-approved task explicitly starts this phase.

## Phase 9 — Adapters and Product Integration

Status for current task: existing adapters may be patched only as needed to display and test the approved crystal slice. New product-module reaction wiring is deferred.

Optional future adapters include:

- Three.js geometry adapter;
- React Three Fiber visualization/inspector;
- Supabase persistence adapter;
- Cloudinary delivery adapter;
- Auth0 application identity adapter;
- telemetry adapter.

Gate: adapter failures cannot corrupt authoritative core state.

## Phase 10 — Release Audit

Run the final release audit, cross-platform deterministic fixtures, geometry/material integrity fixtures, performance baselines, security review, documentation validation, and clean-room restore test.
