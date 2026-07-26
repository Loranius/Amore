# Crystal Attachment Integrity Profile

Version: 1.0.0  
Applies to: Amore crystal species and any species that renders fused mineral colonies  
Status: Normative when enabled by the target product or SpeciesProfile

## 1. Purpose

This profile defines the cross-volume rules required for a mother crystal, module crystals, colony satellites, and micro-crystals to read as one organically fused mineral mass.

The profile closes a specific class of invalid implementations: placing multiple independently closed meshes inside each other and relying on visual overlap alone. Simple burial or mesh overlap without junction processing is non-compliant because hidden caps, internal faces, material leakage, z-fighting, or texture breakthrough may become visible from the underside or at oblique angles.

## 2. Terminology

- **Host Crystal**: the mother, central, or supporting crystal that owns the attachment surface.
- **Child Crystal**: a module crystal, colony satellite, companion, or micro-crystal attached to a host.
- **Crystal Colony**: a host and all descendants that visually form one mineral mass.
- **Attachment Junction**: the canonical semantic record describing the contact between one host and one child.
- **Junction Zone**: the only region in which controlled host/child volume overlap is permitted.
- **External Shell**: the surface visible from outside the final colony after hidden geometry is removed or classified as internal.
- **Texture Breakthrough**: any case where the child material or surface appears through an unrelated part of the host, including the underside.

## 3. Canonical Attachment Junction

Volume IV SHALL publish an attachment record semantically equivalent to:

```ts
interface AttachmentJunction {
  readonly junctionId: string;
  readonly hostComponentId: string;
  readonly childComponentId: string;
  readonly hostAnchorId: string;
  readonly childAnchorId: string;
  readonly localFrame: Readonly<{
    origin: readonly [number, number, number];
    normal: readonly [number, number, number];
    tangent: readonly [number, number, number];
    bitangent: readonly [number, number, number];
  }>;
  readonly contactRadius: number;
  readonly penetrationDepth: number;
  readonly clearanceRadius: number;
  readonly allowedIntersectionBounds: Readonly<{
    center: readonly [number, number, number];
    radius: number;
    halfDepth: number;
  }>;
  readonly trimPolicy: 'analytic-clip' | 'local-boolean' | 'junction-mesh';
  readonly seamPolicy: 'weld' | 'sealed-transition';
  readonly materialBlendWidth: number;
  readonly version: string;
}
```

Equivalent representations are allowed only when every field and invariant remains testable and serializable.

## 4. Volume III — Attachment-Safe Growth Placement

Growth SHALL treat every planned child crystal as a spatial body, not only as an anchor point.

Before publication, the Growth Engine SHALL:

- reserve a host-local junction zone;
- place the child origin on or slightly beneath the host surface;
- use deterministic stratified, Poisson-like, or blue-noise-like candidate selection to avoid clumping;
- enforce minimum angular separation around the host axis;
- enforce minimum surface and volumetric clearance from unrelated children;
- bias children outward from the host axis while preserving bounded natural variation;
- balance occupied sectors around the host without producing rigid radial symmetry;
- reject, redirect, shrink, or defer a child whose body would cross another body outside both junction zones;
- preserve deterministic output for identical seed, history, configuration, and prior state.

A point reservation that ignores the child radius, projected axis, and length is insufficient.

## 5. Volume IV — Semantic Junction Ownership

Composition SHALL preserve parent/child ownership and publish one explicit `AttachmentJunction` for every physical attachment.

The junction SHALL define:

- host and child ownership;
- contact frame and local orientation;
- penetration depth;
- contact radius;
- allowed overlap bounds;
- surrounding clearance;
- geometry trim and seam policy;
- material blend width;
- deterministic ordering and version.

A child MUST NOT be attached to more than one physical host unless the assembly explicitly declares a validated bridge/intergrowth topology.

## 6. Volume V — External-Shell Geometry

The Geometry Engine SHALL convert each valid junction into an external-shell-safe result.

For every host/child pair it SHALL:

1. generate provisional host and child geometry;
2. classify triangles or surface regions as external, junction, or internal;
3. clip or remove the child base cap and all child faces hidden inside the host;
4. remove or suppress host faces that become permanently internal to the junction where required;
5. prevent coplanar duplicate faces and z-fighting;
6. create a sealed transition by deterministic local welding, a junction mesh, or an exact local Boolean operation;
7. recompute affected normals, tangents, UV seams, region mappings, bounds, and topology metadata;
8. validate the result from all external directions before GeometryState publication.

A full-colony global CSG union is optional. A bounded local trim plus hidden-face removal plus sealed junction is sufficient when it satisfies every invariant below.

The following are explicitly non-compliant:

- leaving an independently closed child base cap inside the host;
- relying only on penetration depth or draw order;
- allowing internal child faces to remain externally visible;
- accepting uncontrolled intersections outside the junction zone;
- using transparency to hide invalid topology.

## 7. Volume VI — Material Continuity

Materials SHALL bind only to externally visible semantic regions and declared junction blend bands.

The Material Engine SHALL ensure:

- internal and removed faces receive no visible material binding;
- child color, texture, normal detail, emissive contribution, and procedural masks cannot appear through unrelated host regions;
- material transition occurs only inside the declared blend band around the external junction seam;
- host and child UVs, triplanar coordinates, or object-space patterns do not create discontinuous texture projection at the seam unless intentionally specified;
- the underside of the host never reveals the child material through a hidden cap or internal shell;
- material evaluation does not compensate for invalid geometry by opacity, depth bias, or nondeterministic render ordering.

## 8. Required Validation Views

Validation SHALL include deterministic geometry probes or render fixtures for:

- a complete 360-degree orbit around the colony;
- top view;
- side views at junction height;
- strict underside view directed toward the host base;
- oblique underside views;
- close-up views of every high-risk junction;
- maximum supported child count;
- a thin host with a comparatively thick child;
- two neighboring children at minimum allowed spacing;
- a mature host with newly grown children;
- representative mobile LODs.

Raster screenshots alone are not sufficient. Geometry tests SHALL also query triangle visibility, intersection bounds, caps, topology, and material-region ownership.

## 9. Cross-Volume Invariants

- Controlled overlap exists only inside a declared junction zone.
- No unrelated crystal bodies intersect after the geometry transaction.
- No child base cap is part of the visible external shell.
- No internal face is externally visible from the underside or any other view.
- No child material appears through an unrelated host region.
- Each physical child has exactly one validated host junction unless declared as a bridge/intergrowth.
- Junction generation is deterministic and versioned.
- Adding a new module does not move or re-texture unaffected existing junctions unless an explicit migration changes the versioned policy.
- Geometry remains valid under every published LOD.
- Failure of junction validation prevents publication of the new GeometryState or MaterialState.

## 10. Performance Policy

The implementation SHALL prefer bounded local work:

1. analytic clipping for known crystal profiles where practical;
2. local Boolean or signed-distance evaluation restricted to the junction bounds;
3. deterministic junction transition mesh;
4. local vertex welding and region recomputation;
5. cached results keyed by canonical host, child, junction, generator, and tolerance hashes.

The engine MUST NOT downgrade to raw closed-mesh overlap as a silent performance fallback. If no valid junction can be produced within configured limits, the child SHALL be rejected, reduced, redirected, deferred, or replaced by a documented lower-cost compliant strategy.

## 11. Requirement Registry

| ID | Requirement |
|---|---|
| `CAI-REQ-001` | Child placement reserves a volumetric junction and clearance region before creation. |
| `CAI-REQ-002` | Child distribution is deterministic, sector-balanced, and non-clumping without rigid symmetry. |
| `CAI-REQ-003` | Intersections are allowed only inside declared junction zones. |
| `CAI-REQ-004` | Every physical attachment publishes a versioned AttachmentJunction. |
| `CAI-REQ-005` | Child base caps and hidden child faces are removed or excluded from the external shell. |
| `CAI-REQ-006` | Junctions are sealed without coplanar duplicates, cracks, or z-fighting. |
| `CAI-REQ-007` | Unrelated crystal bodies do not intersect in published GeometryState. |
| `CAI-REQ-008` | Internal geometry is not externally visible from underside or oblique views. |
| `CAI-REQ-009` | Child material cannot break through unrelated host regions. |
| `CAI-REQ-010` | Junction material blending is limited to the declared external seam band. |
| `CAI-REQ-011` | All attachment integrity rules hold for every published LOD. |
| `CAI-REQ-012` | Invalid attachment geometry or material binding blocks state publication. |

## 12. Acceptance Gate

This profile is accepted only when all `CAI-REQ-*` records are `VERIFIED`, geometry and material fixtures pass, underside probes pass, deterministic hashes match across repeated runs, and no implementation relies solely on overlapping independently closed meshes.
