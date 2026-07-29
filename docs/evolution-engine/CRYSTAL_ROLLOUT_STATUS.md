# Crystal Rollout Status

Controlled preview rollout is implemented behind `?engine=evolution`.

Current validation sequence:

1. strict TypeScript;
2. full unit and integration tests;
3. production build and PWA/base-path checks;
4. Pixel 8 Pro visual preview;
5. measured WebGL draw-call and triangle acceptance;
6. restore stacked base on Phase 6 and mark PR ready only after all gates pass.

The legacy CrystalScene and SVG fallback remain the production defaults.
