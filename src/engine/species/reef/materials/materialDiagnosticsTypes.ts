import type { ReefColonyMorphotype } from '../types';

export interface ReefMaterialDiagnostics {
  sourceFoundationTriangleCount: number;
  sourceColonyBatchCount: number;
  sourceColonyRangeCount: number;
  materialSlotCount: number;
  rangeBindingCount: number;
  missingMorphotypeBatches: ReefColonyMorphotype[];
  batchIdsWithoutMaterial: string[];
  rangeIdsWithoutBinding: string[];
  colonyIdsWithoutRange: string[];
  nonFiniteColorIds: string[];
  outOfBoundsResponseIds: string[];
  maximumMaterialSlots: number;
  maximumRangeBindings: number;
  materialBudgetExceeded: boolean;
  rangeBindingBudgetExceeded: boolean;
  estimatedDrawCalls: number;
  textureSlots: 0;
  shaderPrograms: 0;
  perFrameUpdates: 0;
}
