import type { ReefColonyMorphotype, ReefColonyRole, ReefColonyTier } from '../types';
import type { ReefMaterialColor, ReefMaterialPalette } from './materialColorTypes';
import type { ReefMaterialRole } from './materialRoleTypes';
import type { ReefSurfaceResponse } from './materialSurfaceTypes';

export interface ReefColonyMaterialBinding {
  id: string;
  sourceRangeId: string;
  colonyId: string;
  sequence: number;
  morphotype: ReefColonyMorphotype;
  colonyRole: ReefColonyRole;
  colonyTier: ReefColonyTier;
  emphasized: boolean;
  tintColor: ReefMaterialColor;
  tintStrength: number;
  roughnessOffset: number;
  subsurfaceOffset: number;
}

export interface ReefColonyMaterialAssignment {
  id: string;
  slot: number;
  sourceBatchId: string;
  morphotype: ReefColonyMorphotype;
  role: Exclude<ReefMaterialRole, 'substrate-rock'>;
  palette: ReefMaterialPalette;
  response: ReefSurfaceResponse;
  bindings: ReefColonyMaterialBinding[];
}
