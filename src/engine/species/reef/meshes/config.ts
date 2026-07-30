import type { ReefColonyMeshConfig } from './types';

export const DEFAULT_REEF_COLONY_MESH_CONFIG: ReefColonyMeshConfig = {
  rulesVersion: 'reef-colony-meshes-v1.0.0',
  tubeRadialSegments: 5,
  minimumSegmentLength: 0.002,
  maximumVertices: 24_000,
  maximumTriangles: 36_000,
};
