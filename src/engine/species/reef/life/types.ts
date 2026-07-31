import type { ReefSpeciesBlueprint, ReefColonyMorphotype } from '../types';
import type { ReefColonyLayoutState, ReefLayoutVec3 } from '../layout';
import type { ReefFoundationMeshState } from '../foundation';
import type { ReefColonySkeletonState } from '../skeletons';
import type { ReefColonyMeshState } from '../meshes';
import type { ReefMaterialState } from '../materials';

export type ReefMotionClass = 'rigid' | 'semi-rigid' | 'flexible' | 'membrane';

export interface ReefLifeConfig {
  /** Bump whenever current, sway, polyp or motion-budget rules change. */
  rulesVersion: string;
  maximumMotionBindings: number;
  baseCurrentStrength: number;
  currentTurbulence: number;
  minimumCurrentCycleSeconds: number;
  maximumCurrentCycleSeconds: number;
  maximumSwayRadians: number;
  maximumPolypPulseAmplitude: number;
}

export interface ReefCurrentField {
  id: 'reef:life:current';
  direction: ReefLayoutVec3;
  strength: number;
  turbulence: number;
  cycleSeconds: number;
  phaseRadians: number;
}

export interface ReefPolypMotionProfile {
  coverage: number;
  extension: number;
  pulseAmplitude: number;
  pulseFrequencyHz: number;
  phaseRadians: number;
}

export interface ReefReducedMotionProfile {
  mode: 'static';
  swayAmplitudeRadians: 0;
  polypPulseAmplitude: 0;
  timeScale: 0;
  staticPhaseRadians: number;
}

export interface ReefColonyMotionBinding {
  id: string;
  sourceRangeId: string;
  sourceMaterialBindingId: string;
  colonyId: string;
  sequence: number;
  morphotype: ReefColonyMorphotype;
  motionClass: ReefMotionClass;
  pivot: ReefLayoutVec3;
  axis: ReefLayoutVec3;
  responseDirection: ReefLayoutVec3;
  currentInfluence: number;
  swayAmplitudeRadians: number;
  swayFrequencyHz: number;
  phaseRadians: number;
  bendExponent: number;
  polyp: ReefPolypMotionProfile;
  reducedMotion: ReefReducedMotionProfile;
}

export interface ReefLifeDiagnostics {
  sourceColonyRangeCount: number;
  sourceMaterialBindingCount: number;
  motionBindingCount: number;
  missingRangeIds: string[];
  missingMaterialBindingIds: string[];
  orphanMaterialBindingIds: string[];
  invalidBindingIds: string[];
  maximumMotionBindings: number;
  motionBindingBudgetExceeded: boolean;
  futureAnimatedBindingCount: number;
  reducedMotionStaticBindingCount: number;
  newDrawCalls: 0;
  geometryMutations: 0;
  materialIdentityMutations: 0;
  rendererCallbacks: 0;
  databaseReads: 0;
  databaseWrites: 0;
}

export interface ReefLifeState {
  reefLifeVersion: 1;
  rulesVersion: string;
  descriptor: {
    id: 'reef:life';
    currentId: 'reef:life:current';
    colonyMotionBindingId: 'reef:life:motion-binding:colony';
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
  sourceMaterialVersion: ReefMaterialState['reefMaterialVersion'];
  sourceMaterialRulesVersion: string;
  artifactSeed: number;
  asOf: string;
  current: ReefCurrentField;
  bindings: ReefColonyMotionBinding[];
  diagnostics: ReefLifeDiagnostics;
}

export interface BuildReefLifeInput {
  species: ReefSpeciesBlueprint;
  layout: ReefColonyLayoutState;
  foundation: ReefFoundationMeshState;
  skeletons: ReefColonySkeletonState;
  meshes: ReefColonyMeshState;
  materials: ReefMaterialState;
  config?: ReefLifeConfig;
}
