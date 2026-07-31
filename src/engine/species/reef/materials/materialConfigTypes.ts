export interface ReefMaterialConfig {
  /** Bump whenever palette, response rules or budgets change. */
  rulesVersion: string;
  maximumMaterialSlots: number;
  maximumRangeBindings: number;
  pairHueShiftDegrees: number;
  perColonyHueVariationDegrees: number;
  colonyTintStrength: number;
}
