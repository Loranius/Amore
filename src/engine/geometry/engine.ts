import type { GrowthBody } from '../growth';
import { buildCrystalGeologyState } from '../species/crystal/geology';
import { buildCrystalJunction } from './junction';
import { buildCrystalMesh } from './mesh';
import { trimCrystalMesh } from './trim';
import type {
  BuildCrystalGeometryInput,
  CrystalGeometryDiagnostics,
  CrystalGeometryState,
  CrystalLodLevel,
  CrystalMeshData,
  CrystalSolid,
} from './types';

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function validateInput(input: BuildCrystalGeometryInput): void {
  if (!input.config.rulesVersion.trim()) {
    throw new Error('Crystal Geometry requires a non-empty rulesVersion.');
  }
  if (!Number.isInteger(input.config.maxVertices) || input.config.maxVertices < 32) {
    throw new Error('Crystal Geometry maxVertices must be an integer of at least 32.');
  }
  if (!Number.isInteger(input.config.maxTriangles) || input.config.maxTriangles < 32) {
    throw new Error('Crystal Geometry maxTriangles must be an integer of at least 32.');
  }
  if (!Number.isFinite(input.config.hiddenFaceEpsilon) || input.config.hiddenFaceEpsilon < 0) {
    throw new Error('Crystal Geometry hiddenFaceEpsilon must be non-negative.');
  }
  if (input.growth.species !== 'crystal') {
    throw new Error(`Crystal Geometry cannot consume species "${input.growth.species}".`);
  }
  if (input.composition.artifactSeed !== input.growth.artifactSeed) {
    throw new Error('Crystal Geometry received composition from another artifact.');
  }
}

function lodCandidates(body: GrowthBody): CrystalLodLevel[] {
  if (body.tier === 'king' || body.tier === 'support') return ['high', 'medium', 'low'];
  if (body.tier === 'family') return ['medium', 'low'];
  return ['low'];
}

function finiteMesh(mesh: CrystalMeshData): boolean {
  return mesh.positions.every(Number.isFinite)
    && mesh.normals.every(Number.isFinite)
    && mesh.indices.every(Number.isInteger);
}

interface GeometryBodyOrder {
  readonly ordered: GrowthBody[];
  readonly unresolvedBodyIds: string[];
}

/**
 * Geometry consumes imported Growth State v1 snapshots as well as fresh engine
 * output. Resolve host dependencies explicitly instead of trusting array order.
 */
function orderBodiesForGeometry(bodies: readonly GrowthBody[]): GeometryBodyOrder {
  const pending = [...bodies].sort(
    (left, right) => left.sequence - right.sequence || compareIds(left.id, right.id),
  );
  const knownBodyIds = new Set(pending.map((body) => body.id));
  const resolvedBodyIds = new Set<string>();
  const ordered: GrowthBody[] = [];
  const unresolvedBodyIds: string[] = [];

  while (pending.length > 0) {
    let progressed = false;

    for (let index = 0; index < pending.length;) {
      const body = pending[index]!;
      const hostBodyId = body.hostBodyId;
      if (hostBodyId === null || resolvedBodyIds.has(hostBodyId)) {
        ordered.push(body);
        resolvedBodyIds.add(body.id);
        pending.splice(index, 1);
        progressed = true;
        continue;
      }
      if (!knownBodyIds.has(hostBodyId)) {
        unresolvedBodyIds.push(body.id);
        pending.splice(index, 1);
        progressed = true;
        continue;
      }
      index += 1;
    }

    if (!progressed) {
      unresolvedBodyIds.push(...pending.map((body) => body.id));
      break;
    }
  }

  return {
    ordered,
    unresolvedBodyIds: [...new Set(unresolvedBodyIds)].sort(compareIds),
  };
}

interface PreparedGeometryBody {
  readonly body: GrowthBody;
  readonly candidates: readonly CrystalMeshData[];
  readonly minimumVertices: number;
  readonly minimumTriangles: number;
}

function prepareGeometryBodies(bodies: readonly GrowthBody[]): PreparedGeometryBody[] {
  return bodies.map((body) => {
    const candidates = lodCandidates(body).map((lod) => buildCrystalMesh(body, lod));
    const minimum = candidates[candidates.length - 1]!;
    return {
      body,
      candidates,
      minimumVertices: minimum.positions.length / 3,
      minimumTriangles: minimum.sourceTriangleCount,
    };
  });
}

function chooseMeshes(
  input: BuildCrystalGeometryInput,
  diagnostics: CrystalGeometryDiagnostics,
): CrystalMeshData[] {
  const meshes: CrystalMeshData[] = [];
  const includedBodyIds = new Set<string>();
  const bodyOrder = orderBodiesForGeometry(input.growth.bodies);
  diagnostics.missingHostBodyIds.push(...bodyOrder.unresolvedBodyIds);
  diagnostics.budgetOmittedBodyIds.push(...bodyOrder.unresolvedBodyIds);

  const prepared = prepareGeometryBodies(bodyOrder.ordered);
  const suffixMinimumVertices = Array<number>(prepared.length + 1).fill(0);
  const suffixMinimumTriangles = Array<number>(prepared.length + 1).fill(0);
  for (let index = prepared.length - 1; index >= 0; index -= 1) {
    const entry = prepared[index]!;
    suffixMinimumVertices[index] = entry.minimumVertices + (suffixMinimumVertices[index + 1] ?? 0);
    suffixMinimumTriangles[index] = entry.minimumTriangles + (suffixMinimumTriangles[index + 1] ?? 0);
  }

  const allMinimumMeshesFit = (suffixMinimumVertices[0] ?? 0) <= input.config.maxVertices
    && (suffixMinimumTriangles[0] ?? 0) <= input.config.maxTriangles;
  let usedVertices = 0;
  let usedTriangles = 0;

  for (let index = 0; index < prepared.length; index += 1) {
    const entry = prepared[index]!;
    const body = entry.body;
    if (body.hostBodyId !== null && !includedBodyIds.has(body.hostBodyId)) {
      // The host exists but was omitted by the geometry budget. Descendants must
      // also be omitted, but this is not a missing-host data error.
      diagnostics.budgetOmittedBodyIds.push(body.id);
      continue;
    }

    const reservedVertices = allMinimumMeshesFit ? suffixMinimumVertices[index + 1] ?? 0 : 0;
    const reservedTriangles = allMinimumMeshesFit ? suffixMinimumTriangles[index + 1] ?? 0 : 0;
    let selected: CrystalMeshData | null = null;
    for (let candidateIndex = 0; candidateIndex < entry.candidates.length; candidateIndex += 1) {
      const candidate = entry.candidates[candidateIndex]!;
      const vertices = candidate.positions.length / 3;
      const triangles = candidate.sourceTriangleCount;
      if (
        usedVertices + vertices + reservedVertices <= input.config.maxVertices
        && usedTriangles + triangles + reservedTriangles <= input.config.maxTriangles
      ) {
        selected = candidate;
        if (candidateIndex > 0) diagnostics.downgradedBodyIds.push(body.id);
        break;
      }
    }

    if (selected === null && body.generation === 0) {
      selected = entry.candidates[entry.candidates.length - 1]!;
      diagnostics.downgradedBodyIds.push(body.id);
    }
    if (selected === null) {
      diagnostics.budgetOmittedBodyIds.push(body.id);
      continue;
    }

    usedVertices += selected.positions.length / 3;
    usedTriangles += selected.sourceTriangleCount;
    meshes.push(selected);
    includedBodyIds.add(body.id);
  }

  return meshes;
}

/**
 * Pure Crystal Geometry pipeline. Logical growth transforms never change here;
 * local profile sinking and index trimming only affect the derived shell.
 */
export function buildCrystalGeometry(
  input: BuildCrystalGeometryInput,
): CrystalGeometryState {
  validateInput(input);
  const geology = buildCrystalGeologyState(input.growth);
  const diagnostics: CrystalGeometryDiagnostics = {
    missingHostBodyIds: [],
    unsealedJunctionIds: [],
    meshesWithoutVisibleTriangles: [],
    nonFiniteBodyIds: [],
    downgradedBodyIds: [],
    budgetOmittedBodyIds: [],
  };
  const rawMeshes = chooseMeshes(input, diagnostics);
  const bodyById = new Map(input.growth.bodies.map((body) => [body.id, body] as const));
  const solids: CrystalSolid[] = rawMeshes.flatMap((mesh) => {
    const body = bodyById.get(mesh.bodyId);
    return body ? [{ body, profile: mesh.profile, bounds: mesh.bounds }] : [];
  });
  const solidById = new Map(solids.map((solid) => [solid.body.id, solid] as const));

  const meshes = rawMeshes.map((mesh) => {
    const solid = solidById.get(mesh.bodyId);
    if (!solid) return mesh;
    const trimmed = trimCrystalMesh(mesh, solid, solids, input.config);
    if (trimmed.visibleTriangleCount === 0) diagnostics.meshesWithoutVisibleTriangles.push(mesh.bodyId);
    if (!finiteMesh(trimmed)) diagnostics.nonFiniteBodyIds.push(mesh.bodyId);
    return trimmed;
  });
  const meshById = new Map(meshes.map((mesh) => [mesh.bodyId, mesh] as const));

  const junctions = input.growth.bodies.flatMap((body) => {
    if (body.hostBodyId === null) return [];
    const childMesh = meshById.get(body.id);
    const hostSolid = solidById.get(body.hostBodyId);
    if (!childMesh || !hostSolid) return [];
    const junction = buildCrystalJunction(body, childMesh, hostSolid, input.config);
    if (!junction) return [];
    if (!junction.sealed) diagnostics.unsealedJunctionIds.push(junction.id);
    return [junction];
  }).sort((left, right) => left.id.localeCompare(right.id));

  const usedVertices = meshes.reduce((sum, mesh) => sum + mesh.positions.length / 3, 0);
  const usedTriangles = meshes.reduce((sum, mesh) => sum + mesh.visibleTriangleCount, 0);
  const countLod = (lod: CrystalLodLevel): number => meshes.filter((mesh) => mesh.lod === lod).length;
  for (const values of [
    diagnostics.missingHostBodyIds,
    diagnostics.unsealedJunctionIds,
    diagnostics.meshesWithoutVisibleTriangles,
    diagnostics.nonFiniteBodyIds,
    diagnostics.downgradedBodyIds,
    diagnostics.budgetOmittedBodyIds,
  ]) {
    const unique = [...new Set(values)].sort(compareIds);
    values.splice(0, values.length, ...unique);
  }

  return {
    geometryStateVersion: 1,
    rulesVersion: input.config.rulesVersion.trim(),
    sourceGrowthStateVersion: input.growth.growthStateVersion,
    sourceCompositionStateVersion: input.composition.compositionStateVersion,
    engineVersion: input.growth.engineVersion,
    speciesRulesVersion: input.growth.speciesRulesVersion,
    artifactSeed: input.growth.artifactSeed,
    geology,
    meshes,
    junctions,
    budget: {
      maxVertices: input.config.maxVertices,
      maxTriangles: input.config.maxTriangles,
      usedVertices,
      usedTriangles,
      highLodBodyCount: countLod('high'),
      mediumLodBodyCount: countLod('medium'),
      lowLodBodyCount: countLod('low'),
      budgetExceeded: usedVertices > input.config.maxVertices
        || usedTriangles > input.config.maxTriangles
        || diagnostics.budgetOmittedBodyIds.length > 0,
    },
    diagnostics,
  };
}
