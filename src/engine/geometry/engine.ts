import type { GrowthBody } from '../growth';
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

function chooseMeshes(
  input: BuildCrystalGeometryInput,
  diagnostics: CrystalGeometryDiagnostics,
): CrystalMeshData[] {
  const meshes: CrystalMeshData[] = [];
  const includedBodyIds = new Set<string>();
  let usedVertices = 0;
  let usedTriangles = 0;

  for (const body of input.growth.bodies) {
    if (body.hostBodyId !== null && !includedBodyIds.has(body.hostBodyId)) {
      diagnostics.missingHostBodyIds.push(body.id);
      diagnostics.budgetOmittedBodyIds.push(body.id);
      continue;
    }

    const candidates = lodCandidates(body);
    let selected: CrystalMeshData | null = null;
    for (const lod of candidates) {
      const candidate = buildCrystalMesh(body, lod);
      const vertices = candidate.positions.length / 3;
      const triangles = candidate.sourceTriangleCount;
      if (
        usedVertices + vertices <= input.config.maxVertices
        && usedTriangles + triangles <= input.config.maxTriangles
      ) {
        selected = candidate;
        if (lod !== candidates[0]) diagnostics.downgradedBodyIds.push(body.id);
        break;
      }
    }

    if (selected === null && body.generation === 0) {
      selected = buildCrystalMesh(body, 'low');
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
  const rawMeshById = new Map(rawMeshes.map((mesh) => [mesh.bodyId, mesh] as const));
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
  ]) values.sort();

  return {
    geometryStateVersion: 1,
    rulesVersion: input.config.rulesVersion.trim(),
    sourceGrowthStateVersion: input.growth.growthStateVersion,
    sourceCompositionStateVersion: input.composition.compositionStateVersion,
    engineVersion: input.growth.engineVersion,
    speciesRulesVersion: input.growth.speciesRulesVersion,
    artifactSeed: input.growth.artifactSeed,
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
