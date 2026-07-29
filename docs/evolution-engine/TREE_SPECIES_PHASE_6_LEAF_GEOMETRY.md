# Tree Species — Phase 6: Leaf Geometry Lab

Status: implemented behind the isolated Tree Lab preview.

## Purpose

Phase 5 produced stable renderer-independent foliage clusters. Phase 6 turns
those accepted clusters into a bounded set of leaf-card instance transforms and
one shared indexed card topology per LOD.

The layer does not regenerate the crown, move branches, read Supabase, choose a
season or introduce the Tree Material/Life engines.

## Pipeline

```text
TreeFoliageState
  -> TreeLeafGeometryState
  -> shared leaf-card BufferGeometry
  -> one THREE.InstancedMesh
```

The branch sweep remains a separate indexed mesh. The full preview therefore
uses at most two draw calls:

1. branch/trunk sweep;
2. all visible leaf cards.

## Pure geometry state

`TreeLeafGeometryState` contains:

- selected `high`, `medium` or `low` LOD;
- one shared normalized card template;
- stable per-leaf instance IDs;
- cluster and branch provenance;
- position, direction and normal;
- length, width and roll;
- instance and triangle budgets;
- deterministic truncation diagnostics.

No Three.js classes are stored in the engine state.

## Stable identity

A leaf instance ID is derived only from its accepted cluster and local logical
index:

```text
tree:leaf:<cluster-id>:<local-index>
```

Higher LODs represent more logical leaves, but an ID present in multiple LODs
keeps the same placement and size. Later clusters cannot change earlier leaf
transforms. A constrained budget truncates only later candidates.

## Shared card topology

Every rendered leaf in a selected LOD instances one card topology:

- low: three profile rows;
- medium: four profile rows;
- high: six profile rows.

The card is normalized in local space:

- `+Y` — leaf direction;
- `+Z` — front normal;
- `+X` — width.

The renderer computes one indexed BufferGeometry, then applies stable instance
matrices. Geometry is never expanded into hundreds of duplicated vertex arrays.

## Published budgets

| LOD | Logical share | Max instances |
| --- | ---: | ---: |
| high | 100% | 900 |
| medium | 58% | 520 |
| low | 30% | 260 |

The Pixel 8 Pro acceptance still uses the global Tree Lab limits:

- no more than 12,000 uploaded vertices;
- no more than 16,000 rendered triangles;
- no more than 2 draw calls;
- no more than 80 ms deterministic build time.

Instancing means the shared card vertices are uploaded once. Rendered triangle
work is calculated as shared card triangles multiplied by the emitted instance
count.

## Renderer boundary

The Tree Lab uses a temporary fixed green `MeshStandardMaterial` only to make
geometry visible during validation. It is not the future Tree Material Engine.

Not included:

- bark materials;
- leaf textures or alpha masks;
- seasonal palettes;
- wind or Life Engine animation;
- flowers, fruit or falling leaves;
- production Home rollout.

## Validation

The phase includes:

- deterministic state tests;
- LOD topology and identity tests;
- immutable foliage-input test;
- constrained append-only budget test;
- Three.js card and instance-matrix tests;
- fixture and portal Pixel 8 Pro acceptance;
- runtime draw-call and total-triangle checks.

## Next phase

Tree Material Lab should introduce renderer-independent bark and foliage
material roles, palette quantization and a strict two-material budget while
leaving the accepted skeleton, composition, foliage and leaf transforms intact.
