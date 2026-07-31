import type { ReefSpeciesBlueprint } from '../types';
import type { ReefColonyLayoutState } from '../layout';
import type { ReefFoundationMeshState } from '../foundation';
import type { ReefColonySkeletonState } from '../skeletons';
import type { ReefColonyMeshState } from '../meshes';
import type { ReefMaterialConfig } from './materialConfigTypes';
import type { ReefFoundationMaterialAssignment } from './foundationMaterialTypes';
import type { ReefColonyMaterialAssignment } from './materialColonyTypes';
import type { ReefMaterialDiagnostics } from './materialDiagnosticsTypes';

export interface ReefMaterialState {
  reefMaterialVersion: 1;
  rulesVersion: string;
  descriptor: {
    id: 'reef:materials';
    foundationMaterialId: 'reef:material:foundation';
    colonyMaterialId: 'reef:material:colony';
    colonyBindingId: 'reef:material-binding:colony';
  };
  sourceSpeciesBlueprintVersion: ReefSpeciesBlueprint['speciesBlueprintVersion'];
  sourceSpeciesRulesVersion: string;
  sourceColonyLayoutVersion: ReefColonyLayoutState['reefColonyLayoutVersion'];
  sourceColonyLayoutRulesVersion: string;
  sourceFoundationMeshVersion: ReefFoundationMeshState['reefFoundationMeshVersion'];
  sourceFoundationRulesVersion: string;
  sourceColonySkeletonVersion: ReefColonySkeletonState['reefColonySkeletonVersion'];
  sourceColonySkeletonRulesVersion: string;
  sourceColonyMeshVersion: ReefColonyMeshState['reefColonyMeshVersion'];
  sourceColonyMeshRulesVersion: string;
  artifactSeed: number;
  asOf: string;
  foundation: ReefFoundationMaterialAssignment;
  colonies: ReefColonyMaterialAssignment[];
  diagnostics: ReefMaterialDiagnostics;
}

export interface BuildReefMaterialsInput {
  species: ReefSpeciesBlueprint;
  layout: ReefColonyLayoutState;
  foundation: ReefFoundationMeshState;
  skeletons: ReefColonySkeletonState;
  meshes: ReefColonyMeshState;
  config?: ReefMaterialConfig;
}
