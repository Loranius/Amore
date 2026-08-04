import { clamp01, round6, seededUnit } from '../growth/math';
import type { GrowthVec3 } from '../growth';
import type { TreeRgb } from '../treeMaterial';
import {
  TREE_GROUND_DETAIL_KINDS,
  type BuildTreeGroundDetailInput,
  type TreeGroundDetailInstance,
  type TreeGroundDetailKind,
  type TreeGroundDetailState,
  type TreeGroundDetailTemplate,
} from './types';

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const EPSILON = 1e-9;

function totalBudget(budget: Readonly<Record<TreeGroundDetailKind, number>>): number {
  return TREE_GROUND_DETAIL_KINDS.reduce((sum, kind) => sum + budget[kind], 0);
}

function validateInput(input: BuildTreeGroundDetailInput): void {
  const { species, terrain, soil, config } = input;
  if (!config.rulesVersion.trim()) {
    throw new Error('Tree Ground Detail requires a non-empty rulesVersion.');
  }
  if (species.artifactSeed !== terrain.artifactSeed
    || species.artifactSeed !== soil.artifactSeed) {
    throw new Error('Tree Ground Detail received states from different artifacts.');
  }
  if (terrain.sourceSpeciesBlueprintVersion !== species.speciesBlueprintVersion
    || soil.sourceSpeciesBlueprintVersion !== species.speciesBlueprintVersion) {
    throw new Error('Tree Ground Detail provenance does not match Tree Species.');
  }
  if (soil.sourceTerrainBindingVersion !== terrain.treeTerrainBindingVersion
    || soil.sourceTerrainBindingRulesVersion !== terrain.rulesVersion
    || soil.descriptor.terrainSurfaceId !== terrain.binding.surfaceId) {
    throw new Error('Tree Ground Detail Soil Surface does not match Terrain Binding.');
  }
  if (soil.lod !== terrain.lod) {
    throw new Error('Tree Ground Detail requires matching Soil and Terrain LODs.');
  }
  if (terrain.mesh.positions.length / 3 !== terrain.diagnostics.vertexCount
    || terrain.mesh.normals.length !== terrain.mesh.positions.length) {
    throw new Error('Tree Ground Detail received inconsistent Terrain geometry.');
  }
  if (!(config.innerRadiusRatio >= 0)
    || !(config.outerRadiusRatio > config.innerRadiusRatio)
    || config.outerRadiusRatio > 1) {
    throw new Error('Tree Ground Detail radius ratios must define a valid interval inside terrain.');
  }
  if (!Number.isFinite(config.radialJitterRatio)
    || config.radialJitterRatio < 0
    || config.radialJitterRatio > 0.25) {
    throw new Error('Tree Ground Detail radialJitterRatio must be between zero and 0.25.');
  }
  if (!Number.isInteger(config.colorQuantizationSteps)
    || config.colorQuantizationSteps < 2
    || config.colorQuantizationSteps > 256) {
    throw new Error('Tree Ground Detail colorQuantizationSteps must be an integer between 2 and 256.');
  }

  let previous = 0;
  for (const lod of ['low', 'medium', 'high'] as const) {
    const current = config.maximumInstancesByKindByLod[lod];
    for (const kind of TREE_GROUND_DETAIL_KINDS) {
      if (!Number.isInteger(current[kind]) || current[kind] < 0) {
        throw new Error(`Tree Ground Detail ${lod}.${kind} budget must be a non-negative integer.`);
      }
    }
    const currentTotal = totalBudget(current);
    if (currentTotal < previous) {
      throw new Error('Tree Ground Detail LOD budgets must be monotonic.');
    }
    previous = currentTotal;
  }
  for (const kind of TREE_GROUND_DETAIL_KINDS) {
    const low = config.maximumInstancesByKindByLod.low[kind];
    const medium = config.maximumInstancesByKindByLod.medium[kind];
    const high = config.maximumInstancesByKindByLod.high[kind];
    if (low > medium || medium > high) {
      throw new Error(`Tree Ground Detail ${kind} budgets must be monotonic.`);
    }
  }
  if (!Number.isInteger(config.maximumTemplateVertices) || config.maximumTemplateVertices < 0
    || !Number.isInteger(config.maximumTemplateTriangles) || config.maximumTemplateTriangles < 0) {
    throw new Error('Tree Ground Detail template budgets must be non-negative integers.');
  }
}

function buildTemplate(): TreeGroundDetailTemplate {
  const ring: ReadonlyArray<readonly [number, number]> = [
    [0.95, 0],
    [0.5, 0.68],
    [-0.5, 0.68],
    [-0.95, 0],
    [-0.5, -0.68],
    [0.5, -0.68],
  ];
  const positions: number[] = [];
  for (const [x, z] of ring) positions.push(x, -0.5, z);
  for (const [x, z] of ring) positions.push(x * 0.78, 0.5, z * 0.78);

  const indices: number[] = [
    0, 2, 1, 0, 3, 2, 0, 4, 3, 0, 5, 4,
    6, 7, 8, 6, 8, 9, 6, 9, 10, 6, 10, 11,
  ];
  for (let side = 0; side < 6; side += 1) {
    const next = (side + 1) % 6;
    indices.push(side, next, 6 + next, side, 6 + next, 6 + side);
  }
  return {
    id: 'tree:ground-detail:shared-chip',
    positions,
    indices,
    vertexCount: positions.length / 3,
    triangleCount: indices.length / 3,
  };
}

function nearestTerrainSample(
  terrain: BuildTreeGroundDetailInput['terrain'],
  x: number,
  z: number,
): { position: GrowthVec3; normal: GrowthVec3; vertexIndex: number } {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < terrain.diagnostics.vertexCount; index += 1) {
    const offset = index * 3;
    const dx = terrain.mesh.positions[offset]! - x;
    const dz = terrain.mesh.positions[offset + 2]! - z;
    const distance = dx * dx + dz * dz;
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }
  const offset = bestIndex * 3;
  return {
    position: {
      x,
      y: terrain.mesh.positions[offset + 1]!,
      z,
    },
    normal: {
      x: terrain.mesh.normals[offset]!,
      y: terrain.mesh.normals[offset + 1]!,
      z: terrain.mesh.normals[offset + 2]!,
    },
    vertexIndex: bestIndex,
  };
}

function quantize(value: number, steps: number): number {
  return round6(Math.round(clamp01(value) * (steps - 1)) / (steps - 1));
}

function colorFor(
  kind: TreeGroundDetailKind,
  variation: number,
  steps: number,
): TreeRgb {
  // Приглушено разом із самою землею. На світлому диску ці камінці, листя й
  // мох читались як посипка на печиві: дрібні, однакового розміру, рівно
  // розкидані й помітно насиченіші за поверхню під ними. Сміття на землі не
  // яскравіше за землю — воно те саме, тільки трохи іншого відтінку.
  // Темніші за саму землю, і це головне число тут. Земля — це кора, помножена
  // приблизно на 0.3 (soilSurface/config.ts), а ці інстанси малюються власним
  // кольором на білому матеріалі, тобто без такого множника. Поки вони були
  // 0.58/0.74/0.32, сміття світилось яскравіше за поверхню, на якій лежить, і
  // читалось як посипка на печиві. Камінець на землі темніший за землю.
  const base: Record<TreeGroundDetailKind, TreeRgb> = {
    stone: { r: 0.19, g: 0.18, b: 0.17 },
    'fallen-leaf': { r: 0.23, g: 0.14, b: 0.08 },
    moss: { r: 0.13, g: 0.19, b: 0.11 },
  };
  const shade = 0.86 + variation * 0.24;
  return {
    r: quantize(base[kind].r * shade, steps),
    g: quantize(base[kind].g * shade, steps),
    b: quantize(base[kind].b * shade, steps),
  };
}

function scaleFor(
  kind: TreeGroundDetailKind,
  surfaceRadius: number,
  variation: number,
): GrowthVec3 {
  if (kind === 'stone') {
    return {
      x: round6(surfaceRadius * (0.024 + variation * 0.018)),
      y: round6(surfaceRadius * (0.011 + variation * 0.01)),
      z: round6(surfaceRadius * (0.022 + (1 - variation) * 0.017)),
    };
  }
  if (kind === 'fallen-leaf') {
    return {
      x: round6(surfaceRadius * (0.017 + variation * 0.012)),
      y: round6(surfaceRadius * 0.0025),
      z: round6(surfaceRadius * (0.045 + variation * 0.025)),
    };
  }
  return {
    x: round6(surfaceRadius * (0.04 + variation * 0.03)),
    y: round6(surfaceRadius * 0.0018),
    z: round6(surfaceRadius * (0.035 + (1 - variation) * 0.03)),
  };
}

function verticalOffset(kind: TreeGroundDetailKind, surfaceRadius: number): number {
  if (kind === 'stone') return surfaceRadius * 0.008;
  if (kind === 'fallen-leaf') return surfaceRadius * 0.003;
  return surfaceRadius * 0.002;
}

/**
 * Pure, deterministic ground-detail projection. One shared low-poly chip is
 * instanced as stones, fallen leaves and moss through stable transforms/colors.
 */
export function buildTreeGroundDetail(
  input: BuildTreeGroundDetailInput,
): TreeGroundDetailState {
  validateInput(input);
  const { species, terrain, soil, config } = input;
  const template = buildTemplate();
  const templateBudgetExceeded = template.vertexCount > config.maximumTemplateVertices
    || template.triangleCount > config.maximumTemplateTriangles;
  if (templateBudgetExceeded) {
    throw new Error(
      `Tree Ground Detail exceeded its shared-template budget: `
        + `${template.vertexCount}/${config.maximumTemplateVertices} vertices, `
        + `${template.triangleCount}/${config.maximumTemplateTriangles} triangles.`,
    );
  }

  const currentBudget = config.maximumInstancesByKindByLod[terrain.lod];
  const highBudget = config.maximumInstancesByKindByLod.high;
  const candidateInstanceCount = totalBudget(highBudget);
  const instanceBudget = totalBudget(currentBudget);
  const phase = seededUnit(species.artifactSeed, 'tree-ground-detail:phase') * Math.PI * 2;
  const instances: TreeGroundDetailInstance[] = [];
  const truncatedInstanceIds: string[] = [];

  for (let globalSequence = 0; globalSequence < candidateInstanceCount; globalSequence += 1) {
    const kind = TREE_GROUND_DETAIL_KINDS[globalSequence % TREE_GROUND_DETAIL_KINDS.length]!;
    const kindSequence = Math.floor(globalSequence / TREE_GROUND_DETAIL_KINDS.length);
    const id = `tree:ground-detail:${kind}:${kindSequence}`;
    if (kindSequence >= currentBudget[kind]) {
      truncatedInstanceIds.push(id);
      continue;
    }

    const angleJitter = (seededUnit(species.artifactSeed, `${id}:angle`) - 0.5) * 0.34;
    const angle = phase + globalSequence * GOLDEN_ANGLE + angleJitter;
    const radiusUnit = seededUnit(species.artifactSeed, `${id}:radius`);
    const innerSquared = config.innerRadiusRatio * config.innerRadiusRatio;
    const outerSquared = config.outerRadiusRatio * config.outerRadiusRatio;
    const areaRadius = Math.sqrt(innerSquared + radiusUnit * (outerSquared - innerSquared));
    const jitter = (seededUnit(species.artifactSeed, `${id}:radial-jitter`) - 0.5)
      * config.radialJitterRatio * 2;
    const radiusRatio = Math.max(
      config.innerRadiusRatio,
      Math.min(config.outerRadiusRatio, areaRadius + jitter),
    );
    const radius = terrain.surfaceRadius * radiusRatio;
    const x = round6(terrain.center.x + Math.cos(angle) * radius);
    const z = round6(terrain.center.z + Math.sin(angle) * radius);
    const sample = nearestTerrainSample(terrain, x, z);
    const variation = seededUnit(species.artifactSeed, `${id}:variation`);
    const colorVariation = seededUnit(species.artifactSeed, `${id}:color`);

    instances.push({
      id,
      sequence: instances.length,
      kindSequence,
      kind,
      position: {
        x,
        y: round6(sample.position.y + verticalOffset(kind, terrain.surfaceRadius)),
        z,
      },
      normal: {
        x: round6(sample.normal.x),
        y: round6(Math.max(EPSILON, sample.normal.y)),
        z: round6(sample.normal.z),
      },
      yawRad: round6(seededUnit(species.artifactSeed, `${id}:yaw`) * Math.PI * 2),
      scale: scaleFor(kind, terrain.surfaceRadius, variation),
      color: colorFor(kind, colorVariation, config.colorQuantizationSteps),
      sourceTerrainVertexIndex: sample.vertexIndex,
    });
  }

  if (instances.length > instanceBudget) {
    throw new Error('Tree Ground Detail exceeded its current LOD instance budget.');
  }
  const stoneCount = instances.filter((instance) => instance.kind === 'stone').length;
  const fallenLeafCount = instances.filter((instance) => instance.kind === 'fallen-leaf').length;
  const mossCount = instances.filter((instance) => instance.kind === 'moss').length;
  if (stoneCount !== currentBudget.stone
    || fallenLeafCount !== currentBudget['fallen-leaf']
    || mossCount !== currentBudget.moss) {
    throw new Error('Tree Ground Detail failed to publish the exact per-kind LOD budget.');
  }

  const signature = [
    config.rulesVersion.trim(),
    species.artifactSeed,
    terrain.lod,
    terrain.binding.surfaceId,
    soil.descriptor.id,
    instances.map((instance) => instance.id).join(','),
  ].join('|');

  return {
    treeGroundDetailVersion: 1,
    rulesVersion: config.rulesVersion.trim(),
    sourceSpeciesBlueprintVersion: species.speciesBlueprintVersion,
    sourceTerrainBindingVersion: terrain.treeTerrainBindingVersion,
    sourceTerrainBindingRulesVersion: terrain.rulesVersion,
    sourceSoilSurfaceVersion: soil.treeSoilSurfaceVersion,
    sourceSoilSurfaceRulesVersion: soil.rulesVersion,
    artifactSeed: species.artifactSeed,
    lod: terrain.lod,
    descriptor: {
      id: 'tree:ground-detail:field',
      templateId: template.id,
      materialId: 'tree:ground-detail:material',
      terrainSurfaceId: terrain.binding.surfaceId,
      soilSurfaceId: soil.descriptor.id,
    },
    template,
    instances,
    signature,
    diagnostics: {
      candidateInstanceCount,
      emittedInstanceCount: instances.length,
      stoneCount,
      fallenLeafCount,
      mossCount,
      instanceBudget,
      stoneBudget: currentBudget.stone,
      fallenLeafBudget: currentBudget['fallen-leaf'],
      mossBudget: currentBudget.moss,
      instanceBudgetExceeded: false,
      truncatedInstanceIds,
      sharedVertexCount: template.vertexCount,
      sharedTriangleCount: template.triangleCount,
      renderedTriangleCount: template.triangleCount * instances.length,
      templateVertexBudget: config.maximumTemplateVertices,
      templateTriangleBudget: config.maximumTemplateTriangles,
      templateBudgetExceeded: false,
      colorQuantizationSteps: config.colorQuantizationSteps,
      stablePrefixPreserved: true,
      anchoredToTerrain: true,
      estimatedDrawCalls: 1,
      estimatedAdditionalMaterials: 1,
      totalMaterialCount: 3,
    },
  };
}
