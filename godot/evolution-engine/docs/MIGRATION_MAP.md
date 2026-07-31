# Three.js → Godot migration map

## Preserved source

The complete accepted implementation remains available on `archive/threejs-evolution-engine-2026-07-31` at commit `0b9fda4187aa2d1e9bf80f4b0c56c296ea0e5480`.

## Layer mapping

| Existing responsibility | Godot destination | Migration rule |
| --- | --- | --- |
| Evolution Events and Artifact blueprint | React/Supabase boundary payload | Preserve schema semantics; no Godot-owned history |
| Artifact DNA / deterministic seed | `scripts/core/evolution_model.gd` | Immutable runtime input |
| Species translation | `scripts/species/` | No mesh or renderer objects |
| Growth competition and acceptance | `scripts/growth/` | Deterministic, append-only state |
| Crystal/Tree/Reef geometry | `scripts/geometry/` | Build Godot Mesh resources from accepted instructions |
| Three.js materials | Godot materials/shaders | Presentation only; never change identity |
| React Three Fiber scene | Godot scene tree | Runtime rendering and interaction only |
| Existing visual acceptance | Web export + Pixel 8 Pro workflow | Same fixed camera/data comparison discipline |

## Sequence

### Bootstrap — current branch

- archive accepted Three.js state;
- create Godot 4.7.1 project;
- encode canonical contracts;
- build deterministic crystal vertical slice;
- add headless determinism smoke test.

### Crystal validation

- import canonical Amore event payload;
- reproduce mother/child hierarchy and collision fields;
- implement organic base merging;
- establish material, camera and mobile budgets;
- export to Web and embed behind a feature flag;
- compare Pixel 8 Pro baseline against the accepted Three.js crystal.

### Tree migration

- port branch skeleton and surface attachment logic;
- construct continuous trunk/branch meshes;
- add foliage MultiMesh and wind as presentation-only Life behavior;
- validate front-face winding, normals and LOD.

### Reef migration

- port foundation, colony attachments and six morphotype rules;
- preserve accepted Phase 9 production identity and later presentation passes;
- use MultiMesh where repeated polyps or small structures are beneficial;
- validate material language, foundation silhouette and ambient current.

### Cutover

The old React Three Fiber renderer is removed from production routing only after Godot Web passes deterministic tests, performance budgets and manual visual acceptance for all three species. The archive branch remains permanent.
