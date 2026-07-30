import {
  clamp01,
  round6,
  seededUnit,
} from '../growth/math';
import type { TreeRgb } from '../treeMaterial';
import type {
  BuildTreeSoilSurfaceInput,
  TreeSoilSurfacePalette,
  TreeSoilSurfaceState,
} from './types';

const EPSILON = 1e-9;

function validateRgb(name: string, color: TreeRgb): void {
  for (const [channel, value] of Object.entries(color)) {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new Error(`Tree Soil Surface ${name}.${channel} must be between zero and one.`);
    }
  }
}

function validateInput(input: BuildTreeSoilSurfaceInput): void {
  const {
    species,
    terrain,
    rootGeometry,
    materials,
    config,
  } = input;
  if (!config.rulesVersion.trim()) {
    throw new Error('Tree Soil Surface requires a non-empty rulesVersion.');
  }
  if (!Number.isInteger(config.quantizationSteps)
    || config.quantizationSteps < 2
    || config.quantizationSteps > 256) {
    throw new Error('Tree Soil Surface quantizationSteps must be an integer between 2 and 256.');
  }
  for (const [name, value] of [
    ['maximumUniqueTints', config.maximumUniqueTints],
    ['radialTintBands', config.radialTintBands],
    ['variationTintBands', config.variationTintBands],
  ] as const) {
    if (!Number.isInteger(value) || value < 1) {
      throw new Error(`Tree Soil Surface ${name} must be a positive integer.`);
    }
  }
  if (config.radialTintBands * config.variationTintBands > config.maximumUniqueTints) {
    throw new Error('Tree Soil Surface tint bands exceed the configured unique-tint budget.');
  }
  for (const [name, value] of [
    ['radialVariationStrength', config.radialVariationStrength],
    ['heightVariationStrength', config.heightVariationStrength],
  ] as const) {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new Error(`Tree Soil Surface ${name} must be between zero and one.`);
    }
  }
  validateRgb('plateauTint', config.plateauTint);
  validateRgb('reliefTint', config.reliefTint);
  validateRgb('edgeTint', config.edgeTint);

  if (species.artifactSeed !== terrain.artifactSeed
    || species.artifactSeed !== rootGeometry.artifactSeed
    || species.artifactSeed !== materials.artifactSeed) {
    throw new Error('Tree Soil Surface received states from different artifacts.');
  }
  if (terrain.sourceSpeciesBlueprintVersion !== species.speciesBlueprintVersion
    || materials.sourceSpeciesBlueprintVersion !== species.speciesBlueprintVersion) {
    throw new Error('Tree Soil Surface source states do not match Tree Species.');
  }
  if (rootGeometry.sourceTerrainBindingVersion !== terrain.treeTerrainBindingVersion
    || rootGeometry.sourceTerrainBindingRulesVersion !== terrain.rulesVersion) {
    throw new Error('Tree Soil Surface Root Geometry provenance does not match Terrain Binding.');
  }
  if (rootGeometry.lod !== terrain.lod) {
    throw new Error('Tree Soil Surface Terrain Binding and Root Geometry LODs do not match.');
  }
  if (!rootGeometry.diagnostics.terrainApplied
    || !rootGeometry.diagnostics.terrainMergedIntoStaticMesh) {
    throw new Error('Tree Soil Surface requires Terrain Binding merged into static root geometry.');
  }
  if (rootGeometry.diagnostics.terrainVertexCount !== terrain.diagnostics.vertexCount) {
    throw new Error('Tree Soil Surface terrain vertex range does not match Root Geometry.');
  }
  if (rootGeometry.mesh.positions.length / 3 !== rootGeometry.diagnostics.vertexCount
    || terrain.mesh.positions.length / 3 !== terrain.diagnostics.vertexCount) {
    throw new Error('Tree Soil Surface received inconsistent geometry vertex diagnostics.');
  }
  if (materials.diagnostics.uniqueMaterialCount !== 2
    || materials.diagnostics.materialBudget !== 2
    || materials.diagnostics.materialBudgetExceeded) {
    throw new Error('Tree Soil Surface requires the accepted two-material contract.');
  }
  const bark = materials.materials.find(
    (material) => material.id === materials.bindings.branchMaterialId && material.role === 'bark',
  );
  if (!bark) {
    throw new Error('Tree Soil Surface requires the accepted bark material binding.');
  }
}

function quantizeChannel(value: number, steps: number): number {
  return round6(Math.round(clamp01(value) * (steps - 1)) / (steps - 1));
}

function quantizeRgb(color: TreeRgb, steps: number): TreeRgb {
  return {
    r: quantizeChannel(color.r, steps),
    g: quantizeChannel(color.g, steps),
    b: quantizeChannel(color.b, steps),
  };
}

function mixRgb(a: TreeRgb, b: TreeRgb, t: number): TreeRgb {
  const resolved = clamp01(t);
  return {
    r: a.r + (b.r - a.r) * resolved,
    g: a.g + (b.g - a.g) * resolved,
    b: a.b + (b.b - a.b) * resolved,
  };
}

function scaleRgb(color: TreeRgb, multiplier: number): TreeRgb {
  return {
    r: color.r * multiplier,
    g: color.g * multiplier,
    b: color.b * multiplier,
  };
}

function colorKey(color: TreeRgb): string {
  return `${color.r.toFixed(6)},${color.g.toFixed(6)},${color.b.toFixed(6)}`;
}

function resolveRadialPaletteColor(
  palette: TreeSoilSurfacePalette,
  radialBand: number,
): TreeRgb {
  if (radialBand <= 0.65) {
    return mixRgb(palette.plateau, palette.relief, radialBand / 0.65);
  }
  return mixRgb(palette.relief, palette.edge, (radialBand - 0.65) / 0.35);
}

/**
 * Pure soil appearance projection. It publishes one RGB multiplier per vertex
 * of the merged static root/collar/terrain mesh. The prefix remains white so
 * the accepted bark appearance is unchanged; only the appended terrain range
 * receives bounded, deterministic and quantized soil tints.
 */
export function buildTreeSoilSurface(
  input: BuildTreeSoilSurfaceInput,
): TreeSoilSurfaceState {
  validateInput(input);
  const {
    species,
    terrain,
    rootGeometry,
    materials,
    config,
  } = input;
  const palette: TreeSoilSurfacePalette = {
    plateau: quantizeRgb(config.plateauTint, config.quantizationSteps),
    relief: quantizeRgb(config.reliefTint, config.quantizationSteps),
    edge: quantizeRgb(config.edgeTint, config.quantizationSteps),
  };
  const terrainVertexCount = terrain.diagnostics.vertexCount;
  const terrainVertexOffset = rootGeometry.diagnostics.vertexCount - terrainVertexCount;
  if (terrainVertexOffset < 0) {
    throw new Error('Tree Soil Surface terrain range exceeds Root Geometry.');
  }

  const vertexColors = new Array<number>(terrainVertexOffset * 3).fill(1);
  const uniqueTints = new Set<string>();
  const plateauRatio = terrain.plateauRadius / Math.max(EPSILON, terrain.surfaceRadius);
  const maximumHeightDelta = Math.max(EPSILON, terrain.diagnostics.maximumHeightDelta);
  let tintedTerrainVertexCount = 0;

  for (let vertexIndex = 0; vertexIndex < terrainVertexCount; vertexIndex += 1) {
    const positionIndex = vertexIndex * 3;
    const x = terrain.mesh.positions[positionIndex]!;
    const y = terrain.mesh.positions[positionIndex + 1]!;
    const z = terrain.mesh.positions[positionIndex + 2]!;
    const radius = Math.hypot(x - terrain.center.x, z - terrain.center.z);
    const radiusRatio = clamp01(radius / Math.max(EPSILON, terrain.surfaceRadius));
    const reliefRatio = radiusRatio <= plateauRatio
      ? 0
      : clamp01((radiusRatio - plateauRatio) / Math.max(EPSILON, 1 - plateauRatio));
    const radialBandIndex = Math.round(reliefRatio * (config.radialTintBands - 1));
    const radialBand = config.radialTintBands === 1
      ? 0
      : radialBandIndex / (config.radialTintBands - 1);
    const radialColor = resolveRadialPaletteColor(palette, radialBand);

    const noise = seededUnit(species.artifactSeed, `tree-soil-surface:${vertexIndex}`);
    const heightRatio = Math.max(-1, Math.min(
      1,
      (y - terrain.groundLevelY) / maximumHeightDelta,
    ));
    const rawVariation = clamp01(
      0.5
        + (noise - 0.5) * 2 * config.radialVariationStrength
        + heightRatio * config.heightVariationStrength,
    );
    const variationBandIndex = Math.round(rawVariation * (config.variationTintBands - 1));
    const variationBand = config.variationTintBands === 1
      ? 0.5
      : variationBandIndex / (config.variationTintBands - 1);
    const shadeMultiplier = 0.9 + variationBand * 0.16;
    const tint = quantizeRgb(
      scaleRgb(radialColor, shadeMultiplier),
      config.quantizationSteps,
    );

    vertexColors.push(tint.r, tint.g, tint.b);
    uniqueTints.add(colorKey(tint));
    if (tint.r < 1 || tint.g < 1 || tint.b < 1) {
      tintedTerrainVertexCount += 1;
    }
  }

  const uniqueTintCount = uniqueTints.size;
  if (uniqueTintCount > config.maximumUniqueTints) {
    throw new Error(
      `Tree Soil Surface exceeded its unique-tint budget: `
        + `${uniqueTintCount}/${config.maximumUniqueTints}.`,
    );
  }
  if (vertexColors.length !== rootGeometry.diagnostics.vertexCount * 3) {
    throw new Error('Tree Soil Surface did not publish one RGB tint per static-mesh vertex.');
  }
  const prefixWhitePreserved = vertexColors
    .slice(0, terrainVertexOffset * 3)
    .every((channel) => channel === 1);
  if (!prefixWhitePreserved) {
    throw new Error('Tree Soil Surface modified the accepted root or collar bark prefix.');
  }

  const signature = [
    config.rulesVersion.trim(),
    species.artifactSeed,
    terrain.lod,
    colorKey(palette.plateau),
    colorKey(palette.relief),
    colorKey(palette.edge),
    terrainVertexCount,
    uniqueTintCount,
  ].join('|');

  return {
    treeSoilSurfaceVersion: 1,
    rulesVersion: config.rulesVersion.trim(),
    sourceSpeciesBlueprintVersion: species.speciesBlueprintVersion,
    sourceTerrainBindingVersion: terrain.treeTerrainBindingVersion,
    sourceTerrainBindingRulesVersion: terrain.rulesVersion,
    sourceRootGeometryVersion: rootGeometry.treeRootGeometryVersion,
    sourceRootGeometryRulesVersion: rootGeometry.rulesVersion,
    sourceMaterialStateVersion: materials.treeMaterialStateVersion,
    sourceMaterialRulesVersion: materials.rulesVersion,
    artifactSeed: species.artifactSeed,
    lod: terrain.lod,
    descriptor: {
      id: 'tree:soil:surface',
      paletteId: 'tree:soil:palette',
      tintAttributeId: 'tree:soil:vertex-tint',
      terrainSurfaceId: terrain.binding.surfaceId,
      materialRole: 'bark',
    },
    palette,
    signature,
    vertexColors,
    diagnostics: {
      rootGeometryVertexCount: rootGeometry.diagnostics.vertexCount,
      preservedBarkVertexCount: terrainVertexOffset,
      terrainVertexOffset,
      terrainVertexCount,
      tintedTerrainVertexCount,
      uniqueTintCount,
      tintBudget: config.maximumUniqueTints,
      tintBudgetExceeded: false,
      quantizationSteps: config.quantizationSteps,
      radialTintBands: config.radialTintBands,
      variationTintBands: config.variationTintBands,
      prefixWhitePreserved: true,
      terrainRangePreserved: true,
      materialRole: 'bark',
      materialCount: 2,
      estimatedAdditionalDrawCalls: 0,
      estimatedAdditionalMaterials: 0,
    },
  };
}
