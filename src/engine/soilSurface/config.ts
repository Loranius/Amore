import type { TreeSoilSurfaceConfig } from './types';

export const DEFAULT_TREE_SOIL_SURFACE_CONFIG: TreeSoilSurfaceConfig = {
  rulesVersion: 'tree-soil-surface-v1.1.0',
  quantizationSteps: 16,
  maximumUniqueTints: 64,
  radialTintBands: 6,
  variationTintBands: 5,
  // Множники до заробленого кольору кори, а не власна фарба — тому земля
  // лишається землею цієї пари, а не спільним бежевим для всіх.
  //
  // Були 0.82/0.72/0.62 і давали в залі світлу піщану оладку: камінь подіуму
  // і плити навколо стоять на яскравості близько 24, а диск світився в рази
  // яскравіше за них. Земля не буває найсвітлішим предметом у нічному храмі.
  // Край темніший за середину навмисно: так обвід диска гасне в подіум,
  // замість того щоб окреслювати себе світлим кільцем.
  plateauTint: { r: 0.34, g: 0.3, b: 0.26 },
  reliefTint: { r: 0.28, g: 0.25, b: 0.22 },
  edgeTint: { r: 0.22, g: 0.23, b: 0.2 },
  radialVariationStrength: 0.1,
  heightVariationStrength: 0.12,
};
