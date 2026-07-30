import { round6 } from '../growth/math';
import type { TreeRgb } from '../treeMaterial';
import type {
  BuildTreeBarkSurfaceInput,
  TreeBarkSurfaceState,
} from './types';

const EPSILON = 1e-9;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function quantize01(value: number, steps: number): number {
  const levels = Math.max(2, Math.floor(steps));
  return round6(Math.round(clamp01(value) * (levels - 1)) / (levels - 1));
}

function quantizeBand(value: number, bands: number): number {
  const levels = Math.max(2, Math.floor(bands));
  return Math.round(clamp01(value) * (levels - 1)) / (levels - 1);
}

function stablePhase(seed: number): number {
  return (Math.abs(Math.trunc(seed)) % 6_283) / 1_000;
}

function tintForTone(tone: number, steps: number): TreeRgb {
  const scalar = 0.82 + tone * 0.24;
  return {
    r: quantize01(scalar * 1.025, steps),
    g: quantize01(scalar * 0.985, steps),
    b: quantize01(scalar * 0.94, steps),
  };
}

function multiplyTint(base: TreeRgb, multiplier: TreeRgb, steps: number): TreeRgb {
  return {
    r: quantize01(base.r * multiplier.r, steps),
    g: quantize01(base.g * multiplier.g, steps),
    b: quantize01(base.b * multiplier.b, steps),
  };
}

function pushRgb(target: number[], value: TreeRgb): void {
  target.push(value.r, value.g, value.b);
}

function rgbAt(values: readonly number[], vertex: number): TreeRgb {
  const offset = vertex * 3;
  return {
    r: values[offset] ?? 1,
    g: values[offset + 1] ?? 1,
    b: values[offset + 2] ?? 1,
  };
}

function tintKey(values: readonly number[], vertex: number): string {
  const offset = vertex * 3;
  return `${values[offset] ?? 0}|${values[offset + 1] ?? 0}|${values[offset + 2] ?? 0}`;
}

function validateInput(input: BuildTreeBarkSurfaceInput): void {
  const {
    species,
    frames,
    mesh,
    rootGeometry,
    soil,
    materials,
    config,
  } = input;

  if (!config.rulesVersion.trim()) {
    throw new Error('Tree Bark Surface requires a non-empty rulesVersion.');
  }
  if (!Number.isInteger(config.quantizationSteps) || config.quantizationSteps < 2) {
    throw new Error('Tree Bark Surface quantizationSteps must be an integer >= 2.');
  }
  if (!Number.isInteger(config.toneBands) || config.toneBands < 2) {
    throw new Error('Tree Bark Surface toneBands must be an integer >= 2.');
  }
  if (!Number.isInteger(config.roughnessBands) || config.roughnessBands < 2) {
    throw new Error('Tree Bark Surface roughnessBands must be an integer >= 2.');
  }
  if (!Number.isInteger(config.maximumUniqueTints) || config.maximumUniqueTints < 1) {
    throw new Error('Tree Bark Surface maximumUniqueTints must be a positive integer.');
  }
  for (const [name, value] of [
    ['trunkBaseDarkening', config.trunkBaseDarkening],
    ['youngBranchLightening', config.youngBranchLightening],
    ['longitudinalVariation', config.longitudinalVariation],
    ['radialGrooveStrength', config.radialGrooveStrength],
  ] as const) {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new Error(`Tree Bark Surface ${name} must be finite and inside 0..1.`);
    }
  }
  if (!Number.isFinite(config.roughnessMinimum)
    || !Number.isFinite(config.roughnessMaximum)
    || config.roughnessMinimum < 0
    || config.roughnessMaximum > 1
    || config.roughnessMinimum > config.roughnessMaximum) {
    throw new Error('Tree Bark Surface roughness bounds must satisfy 0 <= min <= max <= 1.');
  }

  const seeds = [
    species.artifactSeed,
    rootGeometry.artifactSeed,
    soil.artifactSeed,
    materials.artifactSeed,
  ];
  if (!seeds.every((seed) => seed === species.artifactSeed)) {
    throw new Error('Tree Bark Surface received states from different artifacts.');
  }
  if (frames.sourceRulesVersion !== mesh.sourceRulesVersion) {
    throw new Error('Tree Bark Surface sweep provenance does not match Curve Frames.');
  }
  if (mesh.lod !== rootGeometry.lod || mesh.lod !== soil.lod) {
    throw new Error('Tree Bark Surface requires matching branch, root and soil LODs.');
  }
  if (soil.sourceRootGeometryVersion !== rootGeometry.treeRootGeometryVersion
    || soil.sourceRootGeometryRulesVersion !== rootGeometry.rulesVersion) {
    throw new Error('Tree Bark Surface Soil Surface provenance does not match Root Geometry.');
  }
  if (soil.sourceMaterialStateVersion !== materials.treeMaterialStateVersion
    || soil.sourceMaterialRulesVersion !== materials.rulesVersion) {
    throw new Error('Tree Bark Surface Soil Surface provenance does not match Tree Material.');
  }
  if (soil.vertexColors.length !== rootGeometry.diagnostics.vertexCount * 3) {
    throw new Error('Tree Bark Surface Soil Surface color count does not match static geometry.');
  }
  if (mesh.positions.length !== mesh.diagnostics.vertexCount * 3
    || mesh.normals.length !== mesh.diagnostics.vertexCount * 3
    || mesh.uvs.length !== mesh.diagnostics.vertexCount * 2) {
    throw new Error('Tree Bark Surface branch sweep attributes are incomplete.');
  }
  if (soil.diagnostics.preservedBarkVertexCount > rootGeometry.diagnostics.vertexCount) {
    throw new Error('Tree Bark Surface static bark prefix exceeds Root Geometry.');
  }
}

function branchToneAndRoughness(input: {
  seedPhase: number;
  generation: number;
  maximumGeneration: number;
  trunk: boolean;
  x: number;
  y: number;
  z: number;
  nx: number;
  nz: number;
  axial: number;
  config: BuildTreeBarkSurfaceInput['config'];
}): { tint: TreeRgb; roughness: number } {
  const {
    seedPhase,
    generation,
    maximumGeneration,
    trunk,
    x,
    y,
    z,
    nx,
    nz,
    axial,
    config,
  } = input;
  const age = trunk
    ? 1
    : clamp01(1 - generation / Math.max(1, maximumGeneration + 1));
  const radialAngle = Math.atan2(nz, nx);
  const longitudinal = (Math.sin(y * 2.35 + x * 0.8 - z * 0.55 + seedPhase) + 1) * 0.5;
  const grooves = (Math.sin(radialAngle * 6 + y * 3.1 + seedPhase * 0.7) + 1) * 0.5;
  const baseDarkening = age * config.trunkBaseDarkening * (1 - clamp01(axial));
  const youngLift = (1 - age) * config.youngBranchLightening;
  const rawTone = 0.53
    - baseDarkening
    + youngLift
    + (longitudinal - 0.5) * config.longitudinalVariation
    - (grooves - 0.5) * config.radialGrooveStrength;
  const tone = quantizeBand(rawTone, config.toneBands);
  const rawRoughness = config.roughnessMinimum
    + (config.roughnessMaximum - config.roughnessMinimum)
      * clamp01(0.45 + age * 0.34 + grooves * 0.2 + (1 - longitudinal) * 0.08);
  return {
    tint: tintForTone(tone, config.quantizationSteps),
    roughness: quantizeBand(rawRoughness, config.roughnessBands),
  };
}

/**
 * Pure bark surface-character layer. It preserves accepted geometry and emits
 * bounded vertex tint plus roughness-character arrays for branch and static
 * bark geometry. Terrain colors remain byte-for-byte equal to Soil Surface.
 */
export function buildTreeBarkSurface(
  input: BuildTreeBarkSurfaceInput,
): TreeBarkSurfaceState {
  validateInput(input);
  const {
    species,
    frames,
    mesh,
    rootGeometry,
    soil,
    materials,
    config,
  } = input;
  const phase = stablePhase(species.artifactSeed);
  const generationByBranch = new Map(
    frames.curves.map((curve) => [curve.branchId, curve.generation] as const),
  );
  const maximumGeneration = Math.max(0, ...frames.curves.map((curve) => curve.generation));
  const branchVertexColors = new Array<number>(mesh.diagnostics.vertexCount * 3).fill(1);
  const branchRoughnessCharacters = new Array<number>(mesh.diagnostics.vertexCount).fill(1);
  let trunkVertexCount = 0;

  for (const range of mesh.branches) {
    const generation = generationByBranch.get(range.branchId);
    if (generation === undefined) {
      throw new Error(`Tree Bark Surface cannot resolve branch range ${range.branchId}.`);
    }
    const trunk = range.branchId === 'organic:trunk';
    if (trunk) trunkVertexCount += range.vertexCount;
    for (let localVertex = 0; localVertex < range.vertexCount; localVertex += 1) {
      const vertex = range.firstVertex + localVertex;
      const positionOffset = vertex * 3;
      const uvOffset = vertex * 2;
      const result = branchToneAndRoughness({
        seedPhase: phase,
        generation,
        maximumGeneration,
        trunk,
        x: mesh.positions[positionOffset] ?? 0,
        y: mesh.positions[positionOffset + 1] ?? 0,
        z: mesh.positions[positionOffset + 2] ?? 0,
        nx: mesh.normals[positionOffset] ?? 0,
        nz: mesh.normals[positionOffset + 2] ?? 0,
        axial: mesh.uvs[uvOffset] ?? 0,
        config,
      });
      branchVertexColors[positionOffset] = result.tint.r;
      branchVertexColors[positionOffset + 1] = result.tint.g;
      branchVertexColors[positionOffset + 2] = result.tint.b;
      branchRoughnessCharacters[vertex] = result.roughness;
    }
  }

  const staticVertexColors: number[] = [];
  const staticRoughnessCharacters: number[] = [];
  const staticBarkVertices = soil.diagnostics.preservedBarkVertexCount;
  const groundLevelY = rootGeometry.diagnostics.groundLevelY ?? 0;
  for (let vertex = 0; vertex < rootGeometry.diagnostics.vertexCount; vertex += 1) {
    const base = rgbAt(soil.vertexColors, vertex);
    if (vertex >= staticBarkVertices) {
      pushRgb(staticVertexColors, base);
      staticRoughnessCharacters.push(1);
      continue;
    }
    const offset = vertex * 3;
    const x = rootGeometry.mesh.positions[offset] ?? 0;
    const y = rootGeometry.mesh.positions[offset + 1] ?? 0;
    const z = rootGeometry.mesh.positions[offset + 2] ?? 0;
    const nx = rootGeometry.mesh.normals[offset] ?? 0;
    const nz = rootGeometry.mesh.normals[offset + 2] ?? 0;
    const result = branchToneAndRoughness({
      seedPhase: phase + 0.37,
      generation: 0,
      maximumGeneration,
      trunk: true,
      x,
      y,
      z,
      nx,
      nz,
      axial: clamp01((y - groundLevelY)
        / Math.max(EPSILON, species.structure.baseRadius * 2.5)),
      config,
    });
    pushRgb(staticVertexColors, multiplyTint(base, result.tint, config.quantizationSteps));
    staticRoughnessCharacters.push(result.roughness);
  }

  const uniqueTints = new Set<string>();
  for (let vertex = 0; vertex < mesh.diagnostics.vertexCount; vertex += 1) {
    uniqueTints.add(tintKey(branchVertexColors, vertex));
  }
  for (let vertex = 0; vertex < rootGeometry.diagnostics.vertexCount; vertex += 1) {
    uniqueTints.add(tintKey(staticVertexColors, vertex));
  }
  if (uniqueTints.size > config.maximumUniqueTints) {
    throw new Error(
      `Tree Bark Surface exceeded tint budget: ${uniqueTints.size}/${config.maximumUniqueTints}.`,
    );
  }

  const allRoughness = [...branchRoughnessCharacters, ...staticRoughnessCharacters];
  const minimumRoughnessCharacter = round6(Math.min(...allRoughness));
  const maximumRoughnessCharacter = round6(Math.max(...allRoughness));
  const signature = [
    config.rulesVersion.trim(),
    species.artifactSeed,
    mesh.lod,
    mesh.diagnostics.vertexCount,
    rootGeometry.diagnostics.vertexCount,
    uniqueTints.size,
    minimumRoughnessCharacter,
    maximumRoughnessCharacter,
  ].join('|');

  return {
    treeBarkSurfaceVersion: 1,
    rulesVersion: config.rulesVersion.trim(),
    sourceSpeciesBlueprintVersion: species.speciesBlueprintVersion,
    sourceFrameVersion: frames.organicCurveFrameVersion,
    sourceFrameRulesVersion: frames.sourceRulesVersion,
    sourceSweepMeshVersion: mesh.organicSweepMeshVersion,
    sourceSweepRulesVersion: mesh.sourceRulesVersion,
    sourceRootGeometryVersion: rootGeometry.treeRootGeometryVersion,
    sourceRootGeometryRulesVersion: rootGeometry.rulesVersion,
    sourceSoilSurfaceVersion: soil.treeSoilSurfaceVersion,
    sourceSoilRulesVersion: soil.rulesVersion,
    sourceMaterialStateVersion: materials.treeMaterialStateVersion,
    sourceMaterialRulesVersion: materials.rulesVersion,
    artifactSeed: species.artifactSeed,
    lod: mesh.lod,
    descriptor: {
      id: 'tree:bark:surface-character',
      tintAttributeId: 'tree:bark:vertex-tint',
      roughnessAttributeId: 'tree:bark:roughness-character',
      branchGeometryId: 'tree:bark:branch-sweep',
      staticGeometryId: 'tree:bark:root-collar-sweep',
      materialRole: 'bark',
    },
    signature,
    branchVertexColors,
    branchRoughnessCharacters,
    staticVertexColors,
    staticRoughnessCharacters,
    diagnostics: {
      branchVertexCount: mesh.diagnostics.vertexCount,
      staticVertexCount: rootGeometry.diagnostics.vertexCount,
      staticBarkVertexCount: staticBarkVertices,
      preservedTerrainVertexCount: rootGeometry.diagnostics.vertexCount - staticBarkVertices,
      tintedBranchVertexCount: mesh.diagnostics.vertexCount,
      tintedStaticBarkVertexCount: staticBarkVertices,
      branchRangeCount: mesh.branches.length,
      trunkVertexCount,
      generatedBranchVertexCount: mesh.diagnostics.vertexCount - trunkVertexCount,
      maximumGeneration,
      uniqueTintCount: uniqueTints.size,
      tintBudget: config.maximumUniqueTints,
      tintBudgetExceeded: false,
      quantizationSteps: config.quantizationSteps,
      toneBands: config.toneBands,
      roughnessBands: config.roughnessBands,
      minimumRoughnessCharacter,
      maximumRoughnessCharacter,
      geometryPreserved: true,
      branchRangesPreserved: true,
      soilTerrainTintPreserved: true,
      materialCount: 2,
      estimatedAdditionalDrawCalls: 0,
      estimatedAdditionalMaterials: 0,
    },
  };
}
