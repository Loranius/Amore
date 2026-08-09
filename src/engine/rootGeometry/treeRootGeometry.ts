import { normalize } from '../growth/math';
import type { TreeGroundContactState } from '../groundContact';
import {
  barkRelief,
  barkReliefPhase,
  buildOrganicSweepMesh,
  ORGANIC_TRUNK_BRANCH_ID,
  type BarkReliefConfig,
  type OrganicMeshLod,
  type OrganicSweepMesh,
} from '../labs/organic';
import type { TreeTerrainBindingState } from '../terrainBinding';
import type {
  BuildTreeRootGeometryInput,
  TreeRootGeometryState,
} from './types';

function validateInput(input: BuildTreeRootGeometryInput): void {
  const { roots, contact, terrain, lod, config } = input;
  if (!config.rulesVersion.trim()) {
    throw new Error('Tree Root Geometry requires a non-empty rulesVersion.');
  }
  for (const currentLod of ['high', 'medium', 'low'] as const) {
    const vertices = config.maximumVerticesByLod[currentLod];
    const triangles = config.maximumTrianglesByLod[currentLod];
    if (!Number.isInteger(vertices) || vertices < 0) {
      throw new Error(`Tree Root Geometry ${currentLod} vertex budget must be a non-negative integer.`);
    }
    if (!Number.isInteger(triangles) || triangles < 0) {
      throw new Error(`Tree Root Geometry ${currentLod} triangle budget must be a non-negative integer.`);
    }
  }
  if (!(lod in config.maximumVerticesByLod) || !(lod in config.maximumTrianglesByLod)) {
    throw new Error(`Tree Root Geometry received unsupported LOD: ${String(lod)}.`);
  }
  if (roots.frames.diagnostics.branchCount !== roots.roots.length) {
    throw new Error('Tree Root Geometry root descriptors and canonical curves do not match.');
  }
  if (roots.frames.sourceRulesVersion !== roots.rulesVersion) {
    throw new Error('Tree Root Geometry received root frames from another rules version.');
  }
  if (contact) {
    if (contact.artifactSeed !== roots.artifactSeed) {
      throw new Error('Tree Root Geometry received Ground Contact from another artifact.');
    }
    if (contact.sourceRootArchitectureVersion !== roots.treeRootArchitectureVersion
      || contact.sourceRootRulesVersion !== roots.rulesVersion) {
      throw new Error('Tree Root Geometry Ground Contact provenance does not match accepted roots.');
    }
  }
  if (terrain) {
    if (!contact) {
      throw new Error('Tree Root Geometry requires Ground Contact before Terrain Binding.');
    }
    if (terrain.artifactSeed !== roots.artifactSeed) {
      throw new Error('Tree Root Geometry received Terrain Binding from another artifact.');
    }
    if (terrain.sourceGroundContactVersion !== contact.treeGroundContactVersion
      || terrain.sourceGroundContactRulesVersion !== contact.rulesVersion) {
      throw new Error('Tree Root Geometry Terrain Binding provenance does not match Ground Contact.');
    }
    if (terrain.lod !== lod) {
      throw new Error('Tree Root Geometry Terrain Binding LOD does not match root geometry LOD.');
    }
    if (terrain.groundLevelY !== contact.ground.levelY
      || terrain.binding.sourceBindingId !== contact.ground.terrainBindingId) {
      throw new Error('Tree Root Geometry Terrain Binding does not preserve the stable contact plane.');
    }
  }
}

/**
 * Комір з тієї самої деревини, що й стовбур.
 *
 * Він будується власним кільцевим кодом, не розгорткою, і доти малював ідеальні
 * кола. Відколи стовбур став лопатевим (`barkRelief`), його радіус на висоті
 * стику гуляє приблизно на ±14% навколо кола коміра — тобто деревина то виходить
 * назовні, то ховається всередину, і лінія їхнього перетину читається як шов
 * між пеньком і стовбуром. Рівний верхній радіус це не лікує: сходинки немає,
 * але хвиля лишається.
 *
 * Тож комір бере той самий рельєф, з фазою СТОВБУРА, а не власною: лопаті
 * мусять збігтися лопать у лопать, інакше два різні дерева зустрінуться на
 * одній висоті. Осьову координату міряємо від центру коміра — там же, звідки
 * розгортка починає рахувати довжину дуги стовбура.
 */
function appendContactCollar(
  mesh: OrganicSweepMesh,
  contact: TreeGroundContactState,
  lod: OrganicMeshLod,
  bark: BarkReliefConfig,
): { mesh: OrganicSweepMesh; vertexCount: number; triangleCount: number } {
  const phase = barkReliefPhase(ORGANIC_TRUNK_BRANCH_ID);
  const segments = contact.collar.radialSegmentsByLod[lod];
  const yValues = [
    contact.collar.bottomY,
    contact.collar.center.y,
    contact.collar.topY,
  ];
  const midpointRadius = (contact.collar.bottomRadius + contact.collar.topRadius) * 0.5;
  const radii = [
    contact.collar.bottomRadius,
    midpointRadius,
    contact.collar.topRadius,
  ];
  const vertexOffset = mesh.positions.length / 3;
  const positions = [...mesh.positions];
  const normals = [...mesh.normals];
  const uvs = [...mesh.uvs];
  const indices = [...mesh.indices];
  const height = Math.max(1e-9, contact.collar.topY - contact.collar.bottomY);
  const slope = (contact.collar.bottomRadius - contact.collar.topRadius) / height;

  for (let ring = 0; ring < yValues.length; ring += 1) {
    const y = yValues[ring]!;
    const radius = radii[ring]!;
    for (let segment = 0; segment < segments; segment += 1) {
      const angle = (segment / segments) * Math.PI * 2;
      const cosine = Math.cos(angle);
      const sine = Math.sin(angle);
      const relief = barkRelief(angle, y - contact.collar.center.y, radius, phase, bark);
      const shaped = radius * relief.radiusScale;
      positions.push(
        contact.collar.center.x + cosine * shaped,
        y,
        contact.collar.center.z + sine * shaped,
      );
      // Нахил нормалі на лопатеву поверхню — той самий, що в розгортці: радіальний
      // напрямок, відхилений до тангенційного на (∂r/∂θ)/r.
      const normal = normalize({
        x: cosine - (-sine) * relief.angularSlope,
        y: slope,
        z: sine - cosine * relief.angularSlope,
      });
      normals.push(normal.x, normal.y, normal.z);
      uvs.push(segment / segments, ring / (yValues.length - 1));
    }
  }

  for (let ring = 0; ring < yValues.length - 1; ring += 1) {
    for (let segment = 0; segment < segments; segment += 1) {
      const next = (segment + 1) % segments;
      const lowerLeft = vertexOffset + ring * segments + segment;
      const lowerRight = vertexOffset + ring * segments + next;
      const upperLeft = vertexOffset + (ring + 1) * segments + segment;
      const upperRight = vertexOffset + (ring + 1) * segments + next;
      indices.push(lowerLeft, upperLeft, upperRight, lowerLeft, upperRight, lowerRight);
    }
  }

  const collarVertexCount = segments * yValues.length;
  const collarTriangleCount = segments * (yValues.length - 1) * 2;
  return {
    mesh: {
      ...mesh,
      positions,
      normals,
      uvs,
      indices,
      diagnostics: {
        ...mesh.diagnostics,
        ringCount: mesh.diagnostics.ringCount + yValues.length,
        vertexCount: mesh.diagnostics.vertexCount + collarVertexCount,
        triangleCount: mesh.diagnostics.triangleCount + collarTriangleCount,
      },
    },
    vertexCount: collarVertexCount,
    triangleCount: collarTriangleCount,
  };
}

function appendTerrainSurface(
  mesh: OrganicSweepMesh,
  terrain: TreeTerrainBindingState,
): { mesh: OrganicSweepMesh; vertexCount: number; triangleCount: number } {
  const vertexOffset = mesh.positions.length / 3;
  const terrainVertexCount = terrain.diagnostics.vertexCount;
  const terrainTriangleCount = terrain.diagnostics.triangleCount;
  return {
    mesh: {
      ...mesh,
      positions: [...mesh.positions, ...terrain.mesh.positions],
      normals: [...mesh.normals, ...terrain.mesh.normals],
      uvs: [...mesh.uvs, ...terrain.mesh.uvs],
      indices: [
        ...mesh.indices,
        ...terrain.mesh.indices.map((index) => index + vertexOffset),
      ],
      diagnostics: {
        ...mesh.diagnostics,
        ringCount: mesh.diagnostics.ringCount + terrain.diagnostics.ringCount,
        vertexCount: mesh.diagnostics.vertexCount + terrainVertexCount,
        triangleCount: mesh.diagnostics.triangleCount + terrainTriangleCount,
      },
    },
    vertexCount: terrainVertexCount,
    triangleCount: terrainTriangleCount,
  };
}

/**
 * Pure static meshing step. Ground Contact replaces canonical roots with visible
 * prefixes, while Terrain Binding appends its heightfield to the same bark mesh.
 * Accepted roots, the stable contact plane and terrain identity remain immutable.
 */
export function buildTreeRootGeometry(
  input: BuildTreeRootGeometryInput,
): TreeRootGeometryState {
  validateInput(input);
  const { roots, contact, terrain, lod, config } = input;
  const sourceFrames = contact?.visibleRootFrames ?? roots.frames;
  const rawMesh = buildOrganicSweepMesh(sourceFrames, lod, config.surface);
  const collarResult = contact
    ? appendContactCollar(rawMesh, contact, lod, config.surface.bark)
    : { mesh: rawMesh, vertexCount: 0, triangleCount: 0 };
  const terrainResult = terrain
    ? appendTerrainSurface(collarResult.mesh, terrain)
    : { mesh: collarResult.mesh, vertexCount: 0, triangleCount: 0 };
  const mesh = terrainResult.mesh;
  const expectedRootIds = roots.roots.map((root) => root.id);
  const renderedRootIds = rawMesh.branches.map((branch) => branch.branchId);
  const renderedRootSet = new Set(renderedRootIds);
  const expectedRootSet = new Set(expectedRootIds);
  const missingRootMeshIds = expectedRootIds.filter((id) => !renderedRootSet.has(id));
  const unexpectedMeshBranchIds = renderedRootIds.filter((id) => !expectedRootSet.has(id));
  const vertexBudget = config.maximumVerticesByLod[lod];
  const triangleBudget = config.maximumTrianglesByLod[lod];
  const vertexBudgetExceeded = mesh.diagnostics.vertexCount > vertexBudget;
  const triangleBudgetExceeded = mesh.diagnostics.triangleCount > triangleBudget;

  if (missingRootMeshIds.length > 0 || unexpectedMeshBranchIds.length > 0) {
    throw new Error('Tree Root Geometry mesh provenance does not match accepted root IDs.');
  }
  if (vertexBudgetExceeded || triangleBudgetExceeded) {
    throw new Error(
      `Tree Root Geometry exceeded the ${lod} mobile mesh budget: `
        + `${mesh.diagnostics.vertexCount}/${vertexBudget} vertices, `
        + `${mesh.diagnostics.triangleCount}/${triangleBudget} triangles.`,
    );
  }

  return {
    treeRootGeometryVersion: 1,
    rulesVersion: config.rulesVersion.trim(),
    sourceRootArchitectureVersion: roots.treeRootArchitectureVersion,
    sourceRootRulesVersion: roots.rulesVersion,
    sourceGroundContactVersion: contact?.treeGroundContactVersion ?? null,
    sourceGroundContactRulesVersion: contact?.rulesVersion ?? null,
    sourceTerrainBindingVersion: terrain?.treeTerrainBindingVersion ?? null,
    sourceTerrainBindingRulesVersion: terrain?.rulesVersion ?? null,
    artifactSeed: roots.artifactSeed,
    lod,
    mesh,
    diagnostics: {
      sourceRootCount: roots.roots.length,
      renderedRootCount: rawMesh.diagnostics.branchCount,
      vertexCount: mesh.diagnostics.vertexCount,
      triangleCount: mesh.diagnostics.triangleCount,
      estimatedDrawCalls: mesh.diagnostics.vertexCount > 0 ? 1 : 0,
      anchoredToGround: true,
      contactApplied: contact !== undefined,
      groundLevelY: contact?.ground.levelY ?? null,
      visiblePathFraction: contact?.diagnostics.visiblePathFraction ?? null,
      collarVertexCount: collarResult.vertexCount,
      collarTriangleCount: collarResult.triangleCount,
      terrainApplied: terrain !== undefined,
      terrainVertexCount: terrainResult.vertexCount,
      terrainTriangleCount: terrainResult.triangleCount,
      terrainMergedIntoStaticMesh: terrain?.diagnostics.mergedIntoRootGeometry ?? false,
      vertexBudget,
      triangleBudget,
      vertexBudgetExceeded,
      triangleBudgetExceeded,
      missingRootMeshIds,
      unexpectedMeshBranchIds,
    },
  };
}
