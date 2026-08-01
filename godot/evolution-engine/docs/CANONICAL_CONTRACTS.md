# Canonical Evolution Engine contracts

These contracts survive the Three.js → Godot migration. Godot changes the renderer and runtime implementation, not the meaning of growth.

## 1. Determinism

The same engine version, Artifact DNA, seed, ordered event history and configuration must rebuild the same artifact state. Visual ambient motion may vary with time, but it must never change canonical geometry or history.

## 2. Immutable DNA

Artifact DNA is created once and treated as immutable input. DNA defines species, seed and stable traits. Rendering code must not rewrite it.

## 3. Append-only history

Evolution Events are evidence from Amore modules. Events are sorted by their canonical key and appended to history. Existing events are never silently edited or removed by the 3D engine.

## 4. Renderer-independent growth

The canonical pipeline remains:

```text
Evolution Events
  → Evolution pressure
  → Species translation
  → Growth Instructions
  → Growth State
  → Geometry
  → Material / Life / Renderer
```

Geometry, shaders and Godot nodes are projections of canonical state. They are not the source of truth.

## 5. Surface-based attachment

New structures attach to an existing accepted surface or parent structure. They inherit parent direction, surface normal and species-specific forces. Floating growth is invalid unless a species explicitly defines it.

## 6. Parent/child generations

Every generated structure has a stable ID, generation and parent ID. The mother structure is generation zero. New events may create children or descendants without rewriting accepted ancestors.

## 7. Organic merging

Child bases must visually and spatially merge into their parent or foundation. Geometry must avoid exposed internal caps, obvious intersections and detached-looking attachments.

## 8. Competition and growth shadows

Growth candidates compete for available space. Accepted structures create exclusion fields and growth shadows. Collision resolution must be deterministic and bounded.

## 9. Species neutrality of history

One event history can be translated into Crystal, Tree or Reef growth. Events do not contain renderer-specific vertices, Three.js objects or Godot nodes.

## 10. Memory-driven evolution

Verified portal actions and memories create Evolution Events. Example semantic outcomes remain:

- Crystal: a new crystal or cluster;
- Tree: a new branch, shoot, leaf group or structural thickening;
- Reef: a new colony, branch, plate or encrusting patch.

The exact form is decided by DNA, species rules, existing state and available space.

## 11. Mobile-first budgets

The runtime must degrade gracefully on mobile. LOD, instance density, shadows, particles and shader complexity may change. Identity, event history and canonical growth state may not.

## 12. Life Engine boundary

Life and ambient motion may animate accepted geometry but must not mutate history, DNA, canonical growth instructions, material identity or serialized state.

## 13. No forced final form

The artifact is an evolving organism-like structure. It has no mandatory final shape. Growth is continuous, deterministic and reconstructable from canonical inputs.
