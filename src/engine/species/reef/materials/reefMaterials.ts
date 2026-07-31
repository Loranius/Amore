import { DEFAULT_REEF_MATERIAL_CONFIG } from './config';
import { clamp01, round6, seededUnit } from '../math';
import { REEF_COLONY_MORPHOTYPES, type ReefColonyMorphotype } from '../types';
import type { ReefColonyPlacement } from '../layout';
import type { ReefFoundationSurface } from '../foundation';
import type {
  BuildReefMaterialsInput,
  ReefColonyMaterialAssignment,
  ReefColonyMaterialBinding,
  ReefFoundationMaterialAssignment,
  ReefFoundationSurfaceModifier,
  ReefMaterialColor,
  ReefMaterialConfig,
  ReefMaterialPalette,
  ReefMaterialRole,
  ReefMaterialState,
  ReefSurfaceResponse,
} from './types';

type ColonyMaterialRole = Exclude<ReefMaterialRole, 'substrate-rock'>;

interface MaterialSpec {
  role: ColonyMaterialRole;
  hue: number;
  saturation: number;
  lightness: number;
  response: Omit<ReefSurfaceResponse, 'metalness' | 'opacity' | 'emissiveStrength'>;
}

const MATERIAL_SPECS: Record<ReefColonyMorphotype, MaterialSpec> = {
  branching: {
    role: 'branching-calcified',
    hue: 8,
    saturation: 0.72,
    lightness: 0.56,
    response: {
      roughness: 0.62,
      clearcoat: 0.12,
      clearcoatRoughness: 0.58,
      sheen: 0.08,
      sheenRoughness: 0.7,
      transmission: 0.035,
      thickness: 0.16,
      ior: 1.39,
      subsurfaceStrength: 0.16,
    },
  },
  massive: {
    role: 'massive-calcified',
    hue: 24,
    saturation: 0.64,
    lightness: 0.52,
    response: {
      roughness: 0.69,
      clearcoat: 0.1,
      clearcoatRoughness: 0.66,
      sheen: 0.06,
      sheenRoughness: 0.74,
      transmission: 0.025,
      thickness: 0.24,
      ior: 1.4,
      subsurfaceStrength: 0.13,
    },
  },
  plating: {
    role: 'plating-calcified',
    hue: 42,
    saturation: 0.65,
    lightness: 0.57,
    response: {
      roughness: 0.58,
      clearcoat: 0.16,
      clearcoatRoughness: 0.48,
      sheen: 0.1,
      sheenRoughness: 0.64,
      transmission: 0.05,
      thickness: 0.14,
      ior: 1.38,
      subsurfaceStrength: 0.18,
    },
  },
  encrusting: {
    role: 'encrusting-calcified',
    hue: 326,
    saturation: 0.62,
    lightness: 0.5,
    response: {
      roughness: 0.72,
      clearcoat: 0.08,
      clearcoatRoughness: 0.72,
      sheen: 0.08,
      sheenRoughness: 0.76,
      transmission: 0.02,
      thickness: 0.1,
      ior: 1.39,
      subsurfaceStrength: 0.14,
    },
  },
  'soft-coral': {
    role: 'soft-tissue',
    hue: 286,
    saturation: 0.48,
    lightness: 0.64,
    response: {
      roughness: 0.46,
      clearcoat: 0.22,
      clearcoatRoughness: 0.38,
      sheen: 0.34,
      sheenRoughness: 0.44,
      transmission: 0.12,
      thickness: 0.3,
      ior: 1.36,
      subsurfaceStrength: 0.4,
    },
  },
  'sea-fan': {
    role: 'sea-fan-tissue',
    hue: 252,
    saturation: 0.54,
    lightness: 0.51,
    response: {
      roughness: 0.52,
      clearcoat: 0.18,
      clearcoatRoughness: 0.44,
      sheen: 0.28,
      sheenRoughness: 0.5,
      transmission: 0.1,
      thickness: 0.2,
      ior: 1.37,
      subsurfaceStrength: 0.34,
    },
  },
};

const FOUNDATION_SURFACE_MODIFIERS: ReadonlyArray<{
  surface: ReefFoundationSurface;
  colorMultiplier: ReefMaterialColor;
  roughnessOffset: number;
}> = [
  {
    surface: 'top',
    colorMultiplier: { r: 1, g: 0.98, b: 0.94 },
    roughnessOffset: -0.04,
  },
  {
    surface: 'side',
    colorMultiplier: { r: 0.78, g: 0.82, b: 0.84 },
    roughnessOffset: 0.04,
  },
  {
    surface: 'bottom',
    colorMultiplier: { r: 0.58, g: 0.64, b: 0.68 },
    roughnessOffset: 0.1,
  },
];

function validateConfig(config: ReefMaterialConfig): void {
  if (config.rulesVersion.trim().length === 0) {
    throw new Error('Reef Materials requires a non-empty rulesVersion');
  }
  if (!Number.isInteger(config.maximumMaterialSlots) || config.maximumMaterialSlots <= 0) {
    throw new Error('Reef Materials maximumMaterialSlots must be a positive integer');
  }
  if (!Number.isInteger(config.maximumRangeBindings) || config.maximumRangeBindings <= 0) {
    throw new Error('Reef Materials maximumRangeBindings must be a positive integer');
  }
  if (!Number.isFinite(config.pairHueShiftDegrees)
    || config.pairHueShiftDegrees < 0
    || config.pairHueShiftDegrees > 30) {
    throw new Error('Reef Materials pairHueShiftDegrees must be between 0 and 30');
  }
  if (!Number.isFinite(config.perColonyHueVariationDegrees)
    || config.perColonyHueVariationDegrees < 0
    || config.perColonyHueVariationDegrees > 30) {
    throw new Error('Reef Materials perColonyHueVariationDegrees must be between 0 and 30');
  }
  if (!Number.isFinite(config.colonyTintStrength)
    || config.colonyTintStrength < 0
    || config.colonyTintStrength > 1) {
    throw new Error('Reef Materials colonyTintStrength must be between 0 and 1');
  }
}

function validateProvenance(input: BuildReefMaterialsInput): void {
  const { species, layout, foundation, skeletons, meshes } = input;
  if (
    layout.sourceSpeciesBlueprintVersion !== species.speciesBlueprintVersion
    || layout.sourceSpeciesRulesVersion !== species.rulesVersion
    || layout.artifactSeed !== species.artifactSeed
    || layout.asOf !== species.asOf
  ) {
    throw new Error('Reef Materials received incompatible Colony Layout provenance');
  }
  if (
    foundation.sourceSpeciesBlueprintVersion !== species.speciesBlueprintVersion
    || foundation.sourceSpeciesRulesVersion !== species.rulesVersion
    || foundation.sourceColonyLayoutVersion !== layout.reefColonyLayoutVersion
    || foundation.sourceColonyLayoutRulesVersion !== layout.rulesVersion
    || foundation.artifactSeed !== species.artifactSeed
    || foundation.asOf !== species.asOf
  ) {
    throw new Error('Reef Materials received incompatible Foundation Mesh provenance');
  }
  if (
    skeletons.sourceSpeciesBlueprintVersion !== species.speciesBlueprintVersion
    || skeletons.sourceSpeciesRulesVersion !== species.rulesVersion
    || skeletons.sourceColonyLayoutVersion !== layout.reefColonyLayoutVersion
    || skeletons.sourceColonyLayoutRulesVersion !== layout.rulesVersion
    || skeletons.sourceFoundationMeshVersion !== foundation.reefFoundationMeshVersion
    || skeletons.sourceFoundationRulesVersion !== foundation.rulesVersion
    || skeletons.artifactSeed !== species.artifactSeed
    || skeletons.asOf !== species.asOf
  ) {
    throw new Error('Reef Materials received incompatible Colony Skeleton provenance');
  }
  if (
    meshes.sourceSpeciesBlueprintVersion !== species.speciesBlueprintVersion
    || meshes.sourceSpeciesRulesVersion !== species.rulesVersion
    || meshes.sourceColonyLayoutVersion !== layout.reefColonyLayoutVersion
    || meshes.sourceColonyLayoutRulesVersion !== layout.rulesVersion
    || meshes.sourceFoundationMeshVersion !== foundation.reefFoundationMeshVersion
    || meshes.sourceFoundationRulesVersion !== foundation.rulesVersion
    || meshes.sourceColonySkeletonVersion !== skeletons.reefColonySkeletonVersion
    || meshes.sourceColonySkeletonRulesVersion !== skeletons.rulesVersion
    || meshes.artifactSeed !== species.artifactSeed
    || meshes.asOf !== species.asOf
  ) {
    throw new Error('Reef Materials received incompatible Colony Mesh provenance');
  }
}

function normalizedHue(hue: number): number {
  return ((hue % 360) + 360) % 360;
}

function hslToRgb(hue: number, saturation: number, lightness: number): ReefMaterialColor {
  const h = normalizedHue(hue) / 360;
  const s = clamp01(saturation);
  const l = clamp01(lightness);
  if (s === 0) {
    const gray = round6(l);
    return { r: gray, g: gray, b: gray };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (offset: number): number => {
    let t = h + offset;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return {
    r: round6(channel(1 / 3)),
    g: round6(channel(0)),
    b: round6(channel(-1 / 3)),
  };
}

function buildPalette(hue: number, saturation: number, lightness: number): ReefMaterialPalette {
  return {
    baseColor: hslToRgb(hue, saturation, lightness),
    highlightColor: hslToRgb(hue + 3, saturation * 0.72, lightness + 0.17),
    shadowColor: hslToRgb(hue - 5, saturation + 0.06, lightness - 0.18),
    subsurfaceColor: hslToRgb(hue + 7, saturation + 0.08, lightness + 0.08),
  };
}

function buildResponse(values: MaterialSpec['response']): ReefSurfaceResponse {
  return {
    roughness: round6(values.roughness),
    metalness: 0,
    clearcoat: round6(values.clearcoat),
    clearcoatRoughness: round6(values.clearcoatRoughness),
    sheen: round6(values.sheen),
    sheenRoughness: round6(values.sheenRoughness),
    transmission: round6(values.transmission),
    thickness: round6(values.thickness),
    ior: round6(values.ior),
    opacity: 1,
    subsurfaceStrength: round6(values.subsurfaceStrength),
    emissiveStrength: 0,
  };
}

function foundationAssignment(pairHueShift: number): ReefFoundationMaterialAssignment {
  const surfaceModifiers: ReefFoundationSurfaceModifier[] = FOUNDATION_SURFACE_MODIFIERS.map(
    (modifier) => ({
      surface: modifier.surface,
      colorMultiplier: { ...modifier.colorMultiplier },
      roughnessOffset: modifier.roughnessOffset,
    }),
  );
  return {
    id: 'reef:material:foundation',
    slot: 0,
    sourceMeshId: 'reef:foundation-mesh',
    role: 'substrate-rock',
    palette: buildPalette(31 + pairHueShift * 0.32, 0.24, 0.3),
    response: {
      roughness: 0.84,
      metalness: 0,
      clearcoat: 0.04,
      clearcoatRoughness: 0.82,
      sheen: 0.04,
      sheenRoughness: 0.8,
      transmission: 0,
      thickness: 0.08,
      ior: 1.46,
      opacity: 1,
      subsurfaceStrength: 0.02,
      emissiveStrength: 0,
    },
    surfaceModifiers,
  };
}

const TIER_LIGHTNESS_OFFSET: Record<ReefColonyPlacement['tier'], number> = {
  anchor: -0.04,
  primary: 0,
  companion: 0.035,
  micro: 0.065,
};

const ROLE_SATURATION_OFFSET: Record<ReefColonyPlacement['role'], number> = {
  foundation: -0.08,
  framework: -0.02,
  memory: 0.015,
  frontier: 0.04,
  ornamental: 0.07,
  landmark: 0.09,
};

function buildBinding(
  colony: ReefColonyPlacement,
  sourceRangeId: string,
  spec: MaterialSpec,
  pairHueShift: number,
  config: ReefMaterialConfig,
): ReefColonyMaterialBinding {
  const variation = (seededUnit(colony.seed, 'reef-material-colony-hue') * 2 - 1)
    * config.perColonyHueVariationDegrees;
  const emphasizedLightness = colony.emphasized ? 0.035 : 0;
  const tintColor = hslToRgb(
    spec.hue + pairHueShift + variation,
    spec.saturation + ROLE_SATURATION_OFFSET[colony.role],
    spec.lightness + TIER_LIGHTNESS_OFFSET[colony.tier] + emphasizedLightness,
  );
  const roughnessOffset = round6(
    TIER_LIGHTNESS_OFFSET[colony.tier] * 0.72 - (colony.emphasized ? 0.03 : 0),
  );
  const isTissue = colony.morphotype === 'soft-coral' || colony.morphotype === 'sea-fan';
  return {
    id: `reef:material-binding:colony:${colony.id}`,
    sourceRangeId,
    colonyId: colony.id,
    sequence: colony.sequence,
    morphotype: colony.morphotype,
    colonyRole: colony.role,
    colonyTier: colony.tier,
    emphasized: colony.emphasized,
    tintColor,
    tintStrength: round6(clamp01(config.colonyTintStrength * (colony.emphasized ? 1 : 0.76))),
    roughnessOffset,
    subsurfaceOffset: round6(isTissue ? (colony.emphasized ? 0.06 : 0.025) : 0),
  };
}

function colorIsValid(color: ReefMaterialColor): boolean {
  return [color.r, color.g, color.b].every(
    (component) => Number.isFinite(component) && component >= 0 && component <= 1,
  );
}

function responseIsValid(response: ReefSurfaceResponse): boolean {
  const unitValues = [
    response.roughness,
    response.metalness,
    response.clearcoat,
    response.clearcoatRoughness,
    response.sheen,
    response.sheenRoughness,
    response.transmission,
    response.opacity,
    response.subsurfaceStrength,
    response.emissiveStrength,
  ];
  return unitValues.every((value) => Number.isFinite(value) && value >= 0 && value <= 1)
    && Number.isFinite(response.thickness)
    && response.thickness >= 0
    && response.thickness <= 2
    && Number.isFinite(response.ior)
    && response.ior >= 1
    && response.ior <= 2.5;
}

export function buildReefMaterials(input: BuildReefMaterialsInput): ReefMaterialState {
  const config = input.config ?? DEFAULT_REEF_MATERIAL_CONFIG;
  validateConfig(config);
  validateProvenance(input);

  const { species, layout, foundation, skeletons, meshes } = input;
  const pairHueShift = round6(
    (seededUnit(species.artifactSeed, 'reef-material-pair-hue') * 2 - 1)
      * config.pairHueShiftDegrees,
  );
  const foundationMaterial = foundationAssignment(pairHueShift);
  const coloniesById = new Map(layout.colonies.map((colony) => [colony.id, colony] as const));
  const batchesByMorphotype = new Map(
    meshes.batches.map((batch) => [batch.morphotype, batch] as const),
  );
  const rangeIdsWithoutBinding: string[] = [];

  const colonyMaterials: ReefColonyMaterialAssignment[] = [];
  for (const [morphotypeIndex, morphotype] of REEF_COLONY_MORPHOTYPES.entries()) {
    const batch = batchesByMorphotype.get(morphotype);
    if (!batch) continue;
    const spec = MATERIAL_SPECS[morphotype];
    const bindings: ReefColonyMaterialBinding[] = [];
    const ranges = [...batch.ranges].sort(
      (left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id),
    );
    for (const range of ranges) {
      const colony = coloniesById.get(range.colonyId);
      if (!colony || colony.morphotype !== range.morphotype) {
        rangeIdsWithoutBinding.push(range.id);
        continue;
      }
      bindings.push(buildBinding(colony, range.id, spec, pairHueShift, config));
    }
    colonyMaterials.push({
      id: `reef:material:colony:${morphotype}`,
      slot: morphotypeIndex + 1,
      sourceBatchId: batch.id,
      morphotype,
      role: spec.role,
      palette: buildPalette(spec.hue + pairHueShift, spec.saturation, spec.lightness),
      response: buildResponse(spec.response),
      bindings,
    });
  }

  const allRanges = meshes.batches.flatMap((batch) => batch.ranges);
  const allRangeIds = new Set(allRanges.map((range) => range.id));
  const boundRangeIds = new Set(
    colonyMaterials.flatMap((material) => material.bindings.map((binding) => binding.sourceRangeId)),
  );
  for (const rangeId of allRangeIds) {
    if (!boundRangeIds.has(rangeId) && !rangeIdsWithoutBinding.includes(rangeId)) {
      rangeIdsWithoutBinding.push(rangeId);
    }
  }
  const rangeColonyIds = new Set(allRanges.map((range) => range.colonyId));
  const colonyIdsWithoutRange = layout.colonies
    .filter((colony) => !rangeColonyIds.has(colony.id))
    .map((colony) => colony.id);
  const materialBatchIds = new Set(colonyMaterials.map((material) => material.sourceBatchId));
  const batchIdsWithoutMaterial = meshes.batches
    .filter((batch) => !materialBatchIds.has(batch.id))
    .map((batch) => batch.id);
  const missingMorphotypeBatches = REEF_COLONY_MORPHOTYPES.filter(
    (morphotype) => !batchesByMorphotype.has(morphotype),
  );

  const nonFiniteColorIds: string[] = [];
  const checkPalette = (id: string, palette: ReefMaterialPalette): void => {
    const colors: Array<[string, ReefMaterialColor]> = [
      ['base', palette.baseColor],
      ['highlight', palette.highlightColor],
      ['shadow', palette.shadowColor],
      ['subsurface', palette.subsurfaceColor],
    ];
    for (const [label, color] of colors) {
      if (!colorIsValid(color)) nonFiniteColorIds.push(`${id}:${label}`);
    }
  };
  checkPalette(foundationMaterial.id, foundationMaterial.palette);
  for (const material of colonyMaterials) {
    checkPalette(material.id, material.palette);
    for (const binding of material.bindings) {
      if (!colorIsValid(binding.tintColor)) nonFiniteColorIds.push(`${binding.id}:tint`);
    }
  }

  const outOfBoundsResponseIds: string[] = [];
  if (!responseIsValid(foundationMaterial.response)) {
    outOfBoundsResponseIds.push(foundationMaterial.id);
  }
  for (const modifier of foundationMaterial.surfaceModifiers) {
    const finalRoughness = foundationMaterial.response.roughness + modifier.roughnessOffset;
    if (!colorIsValid(modifier.colorMultiplier) || finalRoughness < 0 || finalRoughness > 1) {
      outOfBoundsResponseIds.push(`${foundationMaterial.id}:${modifier.surface}`);
    }
  }
  for (const material of colonyMaterials) {
    if (!responseIsValid(material.response)) outOfBoundsResponseIds.push(material.id);
    for (const binding of material.bindings) {
      const finalRoughness = material.response.roughness + binding.roughnessOffset;
      const finalSubsurface = material.response.subsurfaceStrength + binding.subsurfaceOffset;
      if (finalRoughness < 0 || finalRoughness > 1 || finalSubsurface < 0 || finalSubsurface > 1) {
        outOfBoundsResponseIds.push(binding.id);
      }
    }
  }

  const materialSlotCount = 1 + colonyMaterials.length;
  const rangeBindingCount = colonyMaterials.reduce(
    (total, material) => total + material.bindings.length,
    0,
  );

  return {
    reefMaterialVersion: 1,
    rulesVersion: config.rulesVersion,
    descriptor: {
      id: 'reef:materials',
      foundationMaterialId: 'reef:material:foundation',
      colonyMaterialId: 'reef:material:colony',
      colonyBindingId: 'reef:material-binding:colony',
    },
    sourceSpeciesBlueprintVersion: species.speciesBlueprintVersion,
    sourceSpeciesRulesVersion: species.rulesVersion,
    sourceColonyLayoutVersion: layout.reefColonyLayoutVersion,
    sourceColonyLayoutRulesVersion: layout.rulesVersion,
    sourceFoundationMeshVersion: foundation.reefFoundationMeshVersion,
    sourceFoundationRulesVersion: foundation.rulesVersion,
    sourceColonySkeletonVersion: skeletons.reefColonySkeletonVersion,
    sourceColonySkeletonRulesVersion: skeletons.rulesVersion,
    sourceColonyMeshVersion: meshes.reefColonyMeshVersion,
    sourceColonyMeshRulesVersion: meshes.rulesVersion,
    artifactSeed: species.artifactSeed,
    asOf: species.asOf,
    foundation: foundationMaterial,
    colonies: colonyMaterials,
    diagnostics: {
      sourceFoundationTriangleCount: foundation.triangles.length,
      sourceColonyBatchCount: meshes.batches.length,
      sourceColonyRangeCount: allRanges.length,
      materialSlotCount,
      rangeBindingCount,
      missingMorphotypeBatches,
      batchIdsWithoutMaterial,
      rangeIdsWithoutBinding: [...rangeIdsWithoutBinding].sort(),
      colonyIdsWithoutRange,
      nonFiniteColorIds,
      outOfBoundsResponseIds,
      maximumMaterialSlots: config.maximumMaterialSlots,
      maximumRangeBindings: config.maximumRangeBindings,
      materialBudgetExceeded: materialSlotCount > config.maximumMaterialSlots,
      rangeBindingBudgetExceeded: rangeBindingCount > config.maximumRangeBindings,
      estimatedDrawCalls: materialSlotCount,
      textureSlots: 0,
      shaderPrograms: 0,
      perFrameUpdates: 0,
    },
  };
}
