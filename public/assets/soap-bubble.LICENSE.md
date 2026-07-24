# Soap Bubble model

- Model: **soap-bubble**
- Author: **honoreo**
- Source: https://sketchfab.com/3d-models/soap-bubble-893be3cf512848ba842912b7c61566b1
- License: **CC BY 4.0** — https://creativecommons.org/licenses/by/4.0/

Before development and production builds, `scripts/prepare-soap-bubble.mjs`
reconstructs `public/assets/soap-bubble.glb` from the supplied model geometry and
soap-film texture. The Wishlist renderer then loads that GLB directly through
Three.js `GLTFLoader`.
