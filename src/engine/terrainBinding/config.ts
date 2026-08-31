import type { TreeTerrainBindingConfig } from './types';

export const DEFAULT_TREE_TERRAIN_BINDING_CONFIG: TreeTerrainBindingConfig = {
  rulesVersion: 'tree-terrain-binding-v1.1.0',
  radialSegmentsByLod: {
    high: 32,
    medium: 24,
    low: 16,
  },
  ringCountByLod: {
    high: 7,
    medium: 6,
    low: 4,
  },
  surfaceRadiusRootCoverageRatio: 1.22,
  minimumSurfaceRadiusBaseRatio: 6,
  plateauRootCoverageRatio: 1.05,
  reliefAmplitudeBaseRadiusRatio: 0.12,
  /*
   * Глибина «пелюсток» краю ґрунту. 0 — ідеальне коло, тобто килимок.
   *
   * Стеля 0.143 не з ока, а з умови, що кільця не поміняються місцями:
   * зовнішнє кільце сидить на 1.0 радіуса, сусіднє на 0.857 і не втягується
   * зовсім. За глибини 0.5 (перша спроба) зовнішнє заходило ВСЕРЕДИНУ
   * сусіднього, і на знімку з'явилась чорна складка з вивернутою нормаллю.
   */
  rimLobeDepth: 0.12,
  maximumVerticesByLod: {
    high: 240,
    medium: 170,
    low: 80,
  },
  maximumTrianglesByLod: {
    high: 440,
    medium: 300,
    low: 140,
  },
};
