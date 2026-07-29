# Tree Species — Phase 8: Tree Life Lab

## Purpose

Tree Life adds subtle deterministic presence after accepted Tree Material State.
It must never rewrite relationship history, growth topology, branch mesh, leaf
placement or material identity.

```text
Evolution history
→ Tree Species
→ Organic Growth
→ Composition
→ Foliage Architecture
→ Leaf Geometry
→ Tree Material
→ Tree Life
→ Three.js renderer
```

## Pure life state

`buildTreeLifeState()` consumes:

- `TreeSpeciesBlueprint`;
- `TreeCompositionState`;
- `TreeLeafGeometryState`;
- `TreeMaterialState`;
- explicit `TreeLifeConfig`.

It produces stable motion identities only:

- one whole-tree branch sway profile;
- one motion profile per accepted leaf instance;
- stable phase, speed, pitch amplitude and roll amplitude;
- a published LOD motion scale;
- diagnostics for profile and per-frame update budgets.

No clock is read while the state is built. No random API is used.

## Sampled time frames

`sampleTreeLifeFrame()` is a pure function of:

- accepted `TreeLifeState`;
- explicit elapsed seconds;
- optional reduced-motion override.

The same state and elapsed time always return the same frame.
Invalid or negative elapsed values resolve safely to zero.

A frame contains:

- root sway on X and Z;
- a very small root twist on Y;
- renderer-local leaf pitch and roll deltas.

## Renderer boundary

The Three.js adapter captures the initial instance matrices once and applies
sampled motion only to renderer-owned objects:

- the existing branch/leaf group receives subtle root rotation;
- existing leaf instance matrices receive local flutter deltas;
- branch geometry buffers are not edited;
- accepted leaf transforms remain available as immutable base transforms;
- material recipes are not modified;
- no additional mesh or material is created.

Tree Life therefore adds **zero draw calls**. Tree Lab remains limited to:

1. one branch sweep draw call;
2. one instanced foliage draw call.

## Accessibility

`prefers-reduced-motion` is resolved by the Tree Lab UI and passed as a runtime
override. Reduced motion returns exact zero sway and zero leaf deltas while
keeping the same accepted Tree Life state.

## LOD policy

Motion identity is independent from LOD for every shared logical leaf ID.
Only the published motion scale changes:

- high: `1.00`;
- medium: `0.72`;
- low: `0.46`.

The lower LOD therefore preserves the same motion character with less visible
amplitude and fewer accepted leaf instances.

## Mobile budget

- maximum motion profiles: 900;
- medium preview ceiling: 520 profiles;
- matrix updates per frame: one per emitted profile;
- additional draw calls: 0;
- geometry and material budgets remain unchanged.

When a profile budget is constrained, only later leaf instances are truncated.
Existing profile IDs and formulas do not move or redistribute.

## Tests

Phase 8 locks:

- deterministic state generation;
- deterministic frame sampling;
- exact reduced-motion zero frame;
- stable shared profile identities across LOD;
- no mutation of species, composition, leaf geometry or material state;
- later-only profile truncation;
- renderer application and restoration of base matrices;
- fixture and portal Pixel 8 Pro acceptance;
- unchanged two-draw-call ceiling.

## Excluded

This phase does not add:

- non-repeatable wind randomness;
- skeletal regeneration;
- per-branch topology deformation;
- textures or normal maps;
- weather, rain or wetness;
- seasonal color changes;
- falling leaves;
- flowers or fruit;
- production Home rollout;
- Supabase writes.

## Next phase

**Tree Root Architecture Lab**: deterministic surface and near-surface root
instructions derived from root stability, with append-only IDs and the same
mobile acceptance discipline before any terrain or weathering work.
