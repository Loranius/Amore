# Godot Web runtime bridge

## Status

This bridge is an isolated vertical slice. It is not routed into the production Crystal/Tree/Reef switcher yet.

Activation is opt-in through:

```bash
VITE_EVOLUTION_GODOT=1
```

The feature flag defaults to disabled, so missing Web export files cannot break the current Three.js production renderer.

## Build output

The `Web` export preset produces:

```text
index.html
index.js
index.wasm
index.pck
```

CI uploads these files as a temporary workflow artifact. A later cutover phase will copy an accepted build to:

```text
public/godot/evolution-engine/
```

Vite/Workbox deliberately excludes this directory from precache because the `.wasm` and `.pck` files are large. The files use a separate CacheFirst runtime cache.

## Security boundary

The React host and Godot iframe must be same-origin.

Both directions validate that boundary:

- React accepts messages only when `event.origin === window.location.origin` and `event.source` is the expected iframe window;
- the custom Godot shell accepts payloads only from `window.parent` with the current origin;
- payload messages contain canonical data only, never Supabase credentials or access tokens;
- Godot cannot write relationship history or call Supabase directly.

## Message flow

```text
React host
  └─ amore:godot:payload
       └─ custom HTML shell queue
            └─ JavaScriptBridge polling
                 └─ deterministic Godot rebuild
                      └─ amore:godot:state
                           └─ React acceptance state
```

### Host → Godot

```ts
{
  type: 'amore:godot:payload',
  payload: {
    dna: {
      seed: 582013,
      species: 'crystal',
      engine_version: 'godot-0.1.0',
      traits: {},
    },
    events: [],
  },
}
```

### Godot → host

The runtime emits:

- `amore:godot:booting`;
- `amore:godot:progress`;
- `amore:godot:engine-started`;
- `amore:godot:ready`;
- `amore:godot:state`;
- `amore:godot:error`.

The accepted state message includes species, seed, instruction/history counts and a deterministic snapshot signature.

## Web compatibility choices

The first Web preset uses:

- Compatibility renderer;
- GDScript;
- thread support disabled;
- extension support disabled;
- adaptive canvas sizing;
- both desktop and mobile texture compression variants.

Keeping threads and extensions disabled avoids requiring SharedArrayBuffer and cross-origin isolation during the first GitHub Pages and mobile validation pass.

## Cutover gate

The Godot renderer may replace the current Three.js Crystal route only after all of these pass:

1. Godot parser and deterministic smoke tests;
2. release Web export;
3. same-origin bridge test;
4. Pixel 8 Pro load/FPS/memory review;
5. fixed-camera visual acceptance;
6. rollback path through the Three.js archive branch.
