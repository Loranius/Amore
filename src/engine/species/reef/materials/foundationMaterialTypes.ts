import type { ReefFoundationMeshState, ReefFoundationSurface } from '../foundation';
import type { ReefMaterialColor, ReefMaterialPalette } from './materialColorTypes';
import type { ReefSurfaceResponse } from './materialSurfaceTypes';

export interface ReefFoundationSurfaceModifier {
  surface: ReefFoundationSurface;
  colorMultiplier: ReefMaterialColor;
  roughnessOffset: number;
}

export interface ReefFoundationMaterialAssignment {
  id: 'reef:material:foundation';
  slot: 0;
  sourceMeshId: ReefFoundationMeshState['descriptor']['id'];
  role: 'substrate-rock';
  palette: ReefMaterialPalette;
  response: ReefSurfaceResponse;
  surfaceModifiers: ReefFoundationSurfaceModifier[];
}
