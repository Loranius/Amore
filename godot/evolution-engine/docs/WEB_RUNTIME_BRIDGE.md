# Godot Web runtime bridge

## Status

Phase 11 promotes the bridge from an isolated vertical slice to a production-capable Crystal cutover with an automatic Three.js fallback.

Activation is controlled through:

```bash
VITE_EVOLUTION_GODOT=disabled
VITE_EVOLUTION_GODOT=preview
VITE_EVOLUTION_GODOT=production
```

`disabled` keeps the accepted Three.js renderer. `preview` enables the Godot path without declaring a production cutover. `production` selects Godot only while the iframe reaches a valid accepted state; fatal failures immediately render the existing Three.js Evolution scene.

## Build output

The `Web` export preset produces:

```text
index.html
index.js
index.wasm
index.pck
```

CI stages these files at:

```text
public/godot/evolution-engine/
```

before the Vite production build. The build is rejected unless all four files are present and non-empty under `dist/godot/evolution-engine/`.

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
                      └─ amore:godot:state source=portal
                           ├─ valid identity/events/history bounds → accepted Godot renderer
                           └─ mismatch/error/timeout → Three.js fallback
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
- `amore:godot:activate`;
- `amore:godot:error`.

The accepted state message includes species, seed, canonical instruction count, rendered instruction count, input-event count, canonical history count, motion mode, phase and deterministic snapshot signature.

Only a state with `source: portal` can enter production acceptance. The locally generated demo state may exist briefly before the JavaScript queue delivers the portal payload; the React host ignores that state without accepting it and without triggering fallback.

`input_events` counts only the portal Evolution Events received in the current payload. `history` is the complete append-only canonical history and may additionally include genesis records, so it must be equal to or greater than `input_events`.

`amore:godot:activate` restores the portal action inside the iframe. A short tap or Enter/Space emits one activation; orbit drags and zoom gestures emit none.

## Acceptance validation

React does not trust a message solely because its `type` is known. Phase 11 validates the complete message shape and then verifies the runtime state against the payload:

- source equals `portal`;
- species equals payload species;
- seed equals payload seed;
- input-event count equals payload event count;
- canonical history count is no smaller than input-event count;
- canonical instruction count is positive;
- rendered instruction count cannot exceed canonical instruction count;
- signature is present and bounded to the expected deterministic format.

Lifecycle status is monotonic. A late `booting` or `engine-started` message cannot downgrade an already accepted runtime or overwrite a fatal fallback state.

## Controlled fallback

The host resolves to `three-fallback` after:

1. iframe load failure;
2. explicit Godot runtime error;
3. startup timeout before accepted state;
4. portal-state identity, input-event or history-bound mismatch.

This fallback changes only the renderer. It does not mutate Artifact DNA, Evolution Events, append-only history or Supabase state.

## Web compatibility choices

The Web preset uses:

- Compatibility renderer;
- GDScript;
- thread support disabled;
- extension support disabled;
- adaptive canvas sizing;
- both desktop and mobile texture compression variants.

Keeping threads and extensions disabled avoids requiring SharedArrayBuffer and cross-origin isolation during the first production mobile pass.

## Cutover gate

The Godot renderer may remain selected in the production Crystal route only after all of these pass:

1. Godot parser and every Phase 1–11 smoke test;
2. release Web export;
3. same-origin bridge test;
4. strict portal-only accepted-state validation;
5. production Vite build containing HTML, JavaScript, WASM and PCK files;
6. Pixel 8 Pro load/FPS/memory review;
7. full-motion and reduced-motion visual acceptance;
8. canvas-tap activation proof;
9. rollback path through both live Three.js fallback and the archive branch.
