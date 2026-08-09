import {
  clamp01,
  dot,
  length,
  orthonormalBasis,
  round6,
  roundVec,
  scale,
  subtract,
} from '../growth/math';
import type { GrowthBody, GrowthVec3 } from '../growth';
import type {
  BuildCrystalCompositionInput,
  CrystalCompositionBody,
  CrystalCompositionRole,
  CrystalCompositionScore,
  CrystalCompositionState,
  CrystalSilhouette,
} from './types';

const TAU = Math.PI * 2;

function validateInput(input: BuildCrystalCompositionInput): void {
  if (!input.config.rulesVersion.trim()) {
    throw new Error('Crystal Composition requires a non-empty rulesVersion.');
  }
  if (!Number.isInteger(input.config.sectorCount) || input.config.sectorCount < 4) {
    throw new Error('Crystal Composition sectorCount must be an integer of at least 4.');
  }
  if (
    !Number.isFinite(input.config.targetEmptySectorShare)
    || input.config.targetEmptySectorShare <= 0
    || input.config.targetEmptySectorShare >= 1
  ) {
    throw new Error('Crystal Composition targetEmptySectorShare must be between 0 and 1.');
  }
  if (input.growth.species !== 'crystal') {
    throw new Error(`Crystal Composition cannot consume species "${input.growth.species}".`);
  }
  if (input.growth.bodies.length === 0) {
    throw new Error('Crystal Composition requires at least one growth body.');
  }
}

/**
 * Rank in the colony, from the tier the species assigned — and from nothing
 * else.
 *
 * `generation === 0` used to stand in for "this is the monarch", and it was
 * true when every child grew *on* her. It stopped being true when children
 * became ground-rooted: a body that grows out of the substrate is a root of its
 * own colony, so the engine gives it generation 0 by design (`engine.ts`, "a
 * ground-rooted body grows from the substrate"). Every body in a crystal
 * colony has generation 0.
 *
 * So this returned `focal` for all of them, and the whole hierarchy below was
 * unreachable. Measured on three couples: 19 of 19, 32 of 32 and 36 of 36
 * bodies came out `focal`, while their tiers were correctly king / support /
 * family / micro the entire time.
 *
 * That was not only a composition score reading flat. `buildBodyMaterial` mixes
 * a body's colour toward the secondary by role — 0.06 for focal rising to 0.44
 * for micro, with micro dimmed a further 16% — and it was handing every crystal
 * in the druse the monarch's own treatment. The ladder was written, tested and
 * inert.
 */
function roleFor(body: GrowthBody): CrystalCompositionRole {
  if (body.tier === 'king') return 'focal';
  if (body.tier === 'support') return 'support';
  if (body.tier === 'family') return 'family';
  if (body.tier === 'companion') return 'companion';
  return 'micro';
}

function bodyVolume(body: GrowthBody): number {
  return Math.PI * body.renderedRadius * body.renderedRadius * body.renderedLength;
}

function normalizedSector(angle: number, sectorCount: number): number {
  const normalized = ((angle % TAU) + TAU) % TAU;
  return Math.min(sectorCount - 1, Math.floor((normalized / TAU) * sectorCount));
}

function mapBody(
  body: GrowthBody,
  root: GrowthBody,
  axis: GrowthVec3,
  tangent: GrowthVec3,
  bitangent: GrowthVec3,
  sectorCount: number,
): CrystalCompositionBody {
  const relative = subtract(body.anchor, root.anchor);
  const along = dot(relative, axis);
  const radial = subtract(relative, scale(axis, along));
  const radialDistance = length(radial);
  const angle = radialDistance <= 1e-9
    ? 0
    : Math.atan2(dot(radial, bitangent), dot(radial, tangent));
  const role = roleFor(body);

  return {
    id: body.id,
    sourceBodyId: body.id,
    tier: body.tier,
    role,
    focal: role === 'focal',
    protected: role === 'focal' || body.emphasized,
    decorative: body.sourceId === null && role !== 'focal',
    volume: round6(bodyVolume(body)),
    height: round6(Math.max(0, along + body.renderedLength * Math.max(0, dot(body.direction, axis)))),
    radialDistance: round6(radialDistance),
    sectorIndex: normalizedSector(angle, sectorCount),
    anchor: roundVec(body.anchor),
    direction: roundVec(body.direction),
  };
}

function classifySilhouette(
  bodies: readonly CrystalCompositionBody[],
  root: CrystalCompositionBody,
): CrystalSilhouette {
  const maxHeight = Math.max(root.height, ...bodies.map((body) => body.height), 1e-6);
  const maxRadial = Math.max(...bodies.map((body) => body.radialDistance), 0);
  const spread = maxRadial / maxHeight;
  const volume = bodies.reduce((sum, body) => sum + body.volume, 0) || 1;
  const weightedRadial = bodies.reduce(
    (sum, body) => sum + body.radialDistance * body.volume,
    0,
  ) / volume;
  const balance = 1 - clamp01(weightedRadial / Math.max(maxRadial, 1e-6));

  if (spread < 0.42) return 'cathedral';
  if (balance < 0.48) return 'fan';
  return 'druse';
}

function coefficientOfVariation(values: readonly number[]): number {
  if (values.length <= 1) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (mean <= 1e-9) return 0;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}

function scoreComposition(
  sourceBodies: readonly GrowthBody[],
  bodies: readonly CrystalCompositionBody[],
  silhouette: CrystalSilhouette,
  sectorCount: number,
  targetEmptyShare: number,
): CrystalCompositionScore {
  const root = bodies.find((body) => body.focal) ?? bodies[0]!;
  const maxVolume = Math.max(...bodies.map((body) => body.volume), 1e-9);
  const supportCount = bodies.filter((body) => body.role === 'support').length;
  const hierarchy = clamp01(
    (root.volume / maxVolume) * 0.68
    + (supportCount >= 1 && supportCount <= 3 ? 0.32 : supportCount === 0 ? 0.12 : 0.2),
  );

  const sourceById = new Map(sourceBodies.map((body) => [body.id, body] as const));
  const rootSource = sourceById.get(root.id) ?? sourceBodies[0]!;
  const totalVolume = bodies.reduce((sum, body) => sum + body.volume, 0) || 1;
  const flow = clamp01(bodies.reduce((sum, body) => {
    const source = sourceById.get(body.id);
    return sum + Math.max(0, dot(source?.direction ?? body.direction, rootSource.direction)) * body.volume;
  }, 0) / totalVolume);

  const maxHeight = Math.max(...bodies.map((body) => body.height), 1e-6);
  const maxRadial = Math.max(...bodies.map((body) => body.radialDistance), 0);
  const spread = maxRadial / maxHeight;
  const silhouetteTarget = silhouette === 'cathedral' ? 0.3 : silhouette === 'fan' ? 0.62 : 0.78;
  const silhouetteScore = clamp01(1 - Math.abs(spread - silhouetteTarget) / 0.78);

  const sectorVolumes = Array.from({ length: sectorCount }, () => 0);
  const sectorCounts = Array.from({ length: sectorCount }, () => 0);
  for (const body of bodies) {
    sectorVolumes[body.sectorIndex] = (sectorVolumes[body.sectorIndex] ?? 0) + body.volume;
    sectorCounts[body.sectorIndex] = (sectorCounts[body.sectorIndex] ?? 0) + 1;
  }
  const emptyShare = sectorCounts.filter((count) => count === 0).length / sectorCount;
  const negativeSpace = clamp01(
    1 - Math.abs(emptyShare - targetEmptyShare) / Math.max(targetEmptyShare, 1 - targetEmptyShare),
  );
  const densityContrast = coefficientOfVariation(sectorVolumes);
  const density = clamp01(1 - Math.abs(densityContrast - 0.72) / 1.1);

  const weightedAnchor = sourceBodies.reduce(
    (sum, body) => ({
      x: sum.x + body.anchor.x * bodyVolume(body),
      y: sum.y + body.anchor.y * bodyVolume(body),
      z: sum.z + body.anchor.z * bodyVolume(body),
    }),
    { x: 0, y: 0, z: 0 },
  );
  const center = scale(weightedAnchor, 1 / totalVolume);
  const centerRelative = subtract(center, rootSource.anchor);
  const axial = scale(rootSource.direction, dot(centerRelative, rootSource.direction));
  const radialOffset = length(subtract(centerRelative, axial));
  const balance = clamp01(1 - radialOffset / Math.max(maxRadial + rootSource.renderedRadius, 1e-6));

  const rhythmCv = coefficientOfVariation(sourceBodies.map((body) => body.renderedLength));
  const rhythm = clamp01(1 - Math.abs(rhythmCv - 0.38) / 0.8);

  const attached = sourceBodies.filter((body) => body.generation > 0);
  const validAttachments = attached.filter((body) => body.hostBodyId !== null && body.attachment !== null);
  const buried = validAttachments.filter((body) => (body.attachment?.burialDepth ?? 0) > 0);
  const realism = attached.length === 0
    ? 1
    : clamp01((validAttachments.length / attached.length) * 0.55 + (buried.length / attached.length) * 0.45);

  const total = hierarchy * 0.16
    + flow * 0.13
    + silhouetteScore * 0.16
    + density * 0.1
    + balance * 0.13
    + rhythm * 0.09
    + negativeSpace * 0.12
    + realism * 0.11;

  return {
    hierarchy: round6(hierarchy),
    flow: round6(flow),
    silhouette: round6(silhouetteScore),
    density: round6(density),
    balance: round6(balance),
    rhythm: round6(rhythm),
    negativeSpace: round6(negativeSpace),
    realism: round6(realism),
    total: round6(clamp01(total)),
  };
}

/**
 * Immutable composition analysis. It never moves, rotates, resizes or deletes
 * historical growth bodies; geometry remains a pure downstream projection.
 */
export function buildCrystalComposition(
  input: BuildCrystalCompositionInput,
): CrystalCompositionState {
  validateInput(input);
  const rootCandidates = input.growth.bodies.filter((body) => body.generation === 0 || body.tier === 'king');
  const root = [...rootCandidates].sort(
    (left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id),
  )[0] ?? input.growth.bodies[0]!;
  const axis = roundVec(root.direction);
  const { tangent, bitangent } = orthonormalBasis(axis);
  const bodies = input.growth.bodies.map((body) => mapBody(
    body,
    root,
    axis,
    tangent,
    bitangent,
    input.config.sectorCount,
  ));
  const focal = bodies.find((body) => body.id === root.id) ?? bodies[0]!;
  for (const body of bodies) body.focal = body.id === focal.id;
  const silhouette = classifySilhouette(bodies, focal);

  const ids = new Set(input.growth.bodies.map((body) => body.id));
  const orphanBodyIds = input.growth.bodies
    .filter((body) => body.hostBodyId !== null && !ids.has(body.hostBodyId))
    .map((body) => body.id)
    .sort();
  const duplicateFocalBodyIds = rootCandidates
    .filter((body) => body.id !== root.id)
    .map((body) => body.id)
    .sort();
  const counts = Array.from({ length: input.config.sectorCount }, () => 0);
  for (const body of bodies) counts[body.sectorIndex] = (counts[body.sectorIndex] ?? 0) + 1;
  const averagePerSector = bodies.length / input.config.sectorCount;

  return {
    compositionStateVersion: 1,
    rulesVersion: input.config.rulesVersion.trim(),
    sourceGrowthStateVersion: input.growth.growthStateVersion,
    engineVersion: input.growth.engineVersion,
    speciesRulesVersion: input.growth.speciesRulesVersion,
    artifactSeed: input.growth.artifactSeed,
    silhouette,
    axis,
    bodies,
    score: scoreComposition(
      input.growth.bodies,
      bodies,
      silhouette,
      input.config.sectorCount,
      input.config.targetEmptySectorShare,
    ),
    diagnostics: {
      orphanBodyIds,
      duplicateFocalBodyIds,
      emptySectorIndices: counts.flatMap((count, index) => count === 0 ? [index] : []),
      crowdedSectorIndices: counts.flatMap(
        (count, index) => count > Math.max(2, averagePerSector * 1.8) ? [index] : [],
      ),
    },
  };
}
