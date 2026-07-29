# Tree Species — Phase 3: Read-only Portal Adapter

## Purpose

Tree Lab can now consume the same normalized Evolution history that already feeds
the controlled Crystal preview. The production Home renderer is still unchanged.

## Explicit preview modes

```text
?engine=tree-lab&treeSource=fixture&treeLod=medium
?engine=tree-lab&treeSource=portal&treeLod=medium
```

- `fixture` is the default deterministic regression baseline;
- `portal` is an explicit read-only path through real Amore module rows;
- invalid or missing `treeSource` values resolve to `fixture`;
- legacy Home and `?engine=evolution` are untouched.

## Portal data path

```text
Calendar events
Plans
Pair-wide fulfilled wishlist archive
Visited map places
Memories + source links
Bought shopping items
        ↓
EvolutionSourceSnapshot
        ↓
buildArtifactFromSnapshot()
        ↓
ArtifactBlueprint
        ↓
Tree Species
        ↓
Organic skeleton → curve frames → shared-LOD sweep mesh
```

The adapter reads existing hooks and the sanitized pair-wide wishlist RPC. It does
not write to Supabase, alter module rows, or expose wishlist titles, descriptions,
prices, URLs, media, reactions, or private gift state.

## Determinism boundary

- the fixed fixture and its counts remain unchanged;
- the generic artifact-to-tree builder accepts an explicit `asOf`, LOD and rules version;
- Tree Species never reads system time internally;
- Growth and geometry still consume the same append-only contracts;
- portal history can change only when the underlying normalized module history changes.

## Failure boundary

If portal assembly fails, Tree Lab renders the fixed fixture as an explicit
`fixture-fallback` and exposes the error through `data-tree-lab-error`. It never
silently labels fallback geometry as portal data.

## Acceptance attributes

The preview exposes stable attributes for automated checks:

- source mode and couple ID;
- normalized Evolution event count;
- adapter diagnostic count;
- Tree Species stage and instruction counts;
- attractor and truncation counts;
- branch, junction, vertex and triangle counts;
- mobile-budget status and runtime draw calls.

Pixel 8 Pro visual acceptance covers both the deterministic fixture and the real
portal adapter. This phase does not roll Tree Species into production Home.
