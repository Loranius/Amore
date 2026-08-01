# Crystal Phase 11 — Production portal cutover

Phase 11 moves the accepted Crystal Web runtime from an isolated opt-in preview into a production-capable Amore route while preserving the complete Three.js rollback path.

The phase does not change Artifact DNA, Evolution Events, append-only history, species translation, growth hierarchy, colony accumulation, collision decisions, canonical geometry or Phase 10 visual output.

## Runtime modes

`VITE_EVOLUTION_GODOT` has three explicit modes:

- unset, `disabled`, `0`, `false` — render the accepted Three.js implementation;
- `preview`, `1`, `true`, `on`, `enabled` — render Godot as an opt-in preview;
- `production`, `prod`, `cutover` — route the Crystal through Godot with automatic Three.js fallback.

No mode deletes or mutates the Three.js implementation.

## Production handshake

React accepts a Godot runtime only after a same-origin message sequence reaches a valid `amore:godot:state` response.

The accepted state must contain:

1. Godot version;
2. runtime source exactly equal to `portal`;
3. supported species;
4. the exact canonical DNA seed sent by React;
5. non-negative canonical instruction, input-event and history counts;
6. input-event count equal to the payload event count;
7. canonical history count no smaller than the input-event count because genesis history is retained;
8. rendered instruction count no greater than canonical instruction count;
9. a deterministic snapshot signature of at least eight characters.

A partial, malformed or mismatched state can never mark the renderer as accepted. Local demo state is ignored while the portal payload is still entering the Godot queue; it is neither accepted nor treated as a production failure.

Handshake status is monotonic. Late shell messages such as `amore:godot:engine-started` cannot downgrade an already accepted or failed runtime.

## Controlled fallback

The host switches to the existing Three.js Evolution renderer when any fatal cutover condition occurs:

- iframe load failure;
- Godot runtime error;
- startup acceptance timeout;
- portal-state identity, input-event or history-bound mismatch.

Fallback is local to presentation. It does not rewrite portal data, canonical history or renderer-independent state.

The DOM exposes the selected renderer and failure reason through:

```text
data-evolution-renderer="godot-4.7.1 | three | three-fallback"
data-evolution-godot-failure=""
```

## Portal activation bridge

Godot owns orbit and zoom input inside the iframe, so Phase 11 restores the portal action that previously lived on the React Three Fiber object.

A short tap or keyboard activation emits:

```json
{
  "type": "amore:godot:activate",
  "source": "tap"
}
```

React receives this message and opens the existing random Memory modal.

Input separation rules:

- short tap activates;
- orbit drag never activates;
- wheel and pinch zoom never activate;
- Enter and Space remain keyboard-accessible activation paths.

## Deployment contract

The Godot Web export remains generated in CI rather than committed as changing binary output. Before a production Vite build, CI stages the accepted export at:

```text
public/godot/evolution-engine/
```

The production build must contain non-empty:

```text
dist/godot/evolution-engine/index.html
dist/godot/evolution-engine/index.js
dist/godot/evolution-engine/index.wasm
dist/godot/evolution-engine/index.pck
```

## Acceptance gates

Phase 11 requires all of the following:

1. every Phase 1–10 parser and smoke test still passes;
2. portal tap emits exactly one activation;
3. orbit drag emits no activation;
4. Enter emits one keyboard activation;
5. React bridge validators reject malformed messages;
6. only `source: portal` can enter production acceptance;
7. state identity, seed, input-event and history-bound mismatches are rejected;
8. local demo state is ignored rather than accepted or treated as fatal;
9. late lifecycle messages cannot downgrade accepted or failed status;
10. every fatal cutover reason resolves to `three-fallback`;
11. full production TypeScript and Vite build succeeds with `VITE_EVOLUTION_GODOT=production`;
12. built output contains the Godot HTML, JavaScript, WASM and PCK files;
13. Pixel 8 Pro Playwright proof reaches accepted full-motion state;
14. reduced-motion browser proof remains accepted and static;
15. a real canvas click reaches the React activation handler;
16. no Supabase credential or write capability enters the iframe payload;
17. the Three.js archive and runtime fallback remain intact.
