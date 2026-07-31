export interface ReefMaterialColor {
  r: number;
  g: number;
  b: number;
}

export interface ReefMaterialPalette {
  baseColor: ReefMaterialColor;
  highlightColor: ReefMaterialColor;
  shadowColor: ReefMaterialColor;
  subsurfaceColor: ReefMaterialColor;
}
