import type { OrganicSurfaceConfig } from './surfaceTypes';

export const DEFAULT_ORGANIC_SURFACE_CONFIG: OrganicSurfaceConfig = {
  curveSamplesPerSegment: 4,
  minimumRadius: 0.004,
  junctionInsetRatio: 0.24,
  junctionSurfaceRatio: 0.98,
  junctionFlare: 1.56,
  junctionSegmentsByLod: {
    high: 4,
    medium: 5,
    low: 3,
  },
  // Raised with the bark relief. A ring of ten described the lobes badly enough
  // that they aliased into a gear on the trunk; the relief needs roughly four
  // vertices per lobe, and the trunk carries three lobes plus an overtone.
  radialSegmentsByLod: {
    high: 14,
    medium: 13,
    low: 7,
  },
  axialStrideByLod: {
    high: 1,
    medium: 1,
    low: 3,
  },
  bark: {
    lobeCount: 3,
    overtoneCount: 5,
    swellFrequency: 7.4,
    // Виміряно, а не підібрано: стовбур несе 37 кілець на ~2.8 одиниці, тобто
    // крок кільця 0.082. При частоті 41 хвиля смуги виходила 0.153 — 1.9 кільця
    // на хвилю, нижче за Найквіста, і смуги просто зникали в аліасингу. На 19
    // хвиля 0.33, тобто чотири кільця на хвилю: геометрія її вже описує, і
    // амплітуду можна дати помітну.
    striationFrequency: 19,
    striationDepthRatio: 0.26,
    twist: 4.6,
    depth: 0.14,
    fadeRadius: 0.06,
  },
};
