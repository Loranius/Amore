import { clamp01, round6, seededUnit } from '../math';
import type { ReefSpeciesBlueprint } from '../types';
import { DEFAULT_REEF_FOUNDATION_MESH_CONFIG } from './config';
import type {
  BuildReefFoundationMeshInput,
  ReefFoundationAttachment,
  ReefFoundationMeshConfig,
  ReefFoundationMeshState,
  ReefFoundationPatch,
  ReefFoundationSurface,
  ReefFoundationTriangle,
  ReefFoundationVertex,
} from './types';
import type { ReefLayoutVec3 } from '../layout';

const TAU = Math.PI * 2;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function normalizeVector(value: ReefLayoutVec3): ReefLayoutVec3 {
  const length = Math.hypot(value.x, value.y, value.z);
  if (length <= 1e-9) return { x: 0, y: 1, z: 0 };
  return {
    x: round6(value.x / length),
    y: round6(value.y / length),
    z: round6(value.z / length),
  };
}

function validateConfig(config: ReefFoundationMeshConfig): void {
  if (!config.rulesVersion.trim()) {
    throw new Error('Reef Foundation Mesh requires a non-empty rulesVersion.');
  }
  if (!Number.isFinite(config.skirtDepthRatio) || config.skirtDepthRatio <= 0) {
    throw new Error('Reef Foundation Mesh skirtDepthRatio must be finite and positive.');
  }
  for (const [name, value, minimum] of [
    ['maximumVertices', config.maximumVertices, 16],
    ['maximumTriangles', config.maximumTriangles, 16],
  ] as const) {
    if (!Number.isInteger(value) || value < minimum) {
      throw new Error(`Reef Foundation Mesh ${name} must be an integer >= ${minimum}.`);
    }
  }
}

function validateProvenance(input: BuildReefFoundationMeshInput): void {
  if (input.species.species !== 'reef') {
    throw new Error('Reef Foundation Mesh requires a Reef Species blueprint.');
  }
  if (input.layout.sourceSpeciesBlueprintVersion !== input.species.speciesBlueprintVersion) {
    throw new Error('Reef Foundation Mesh received an incompatible species blueprint version.');
  }
  if (input.layout.sourceSpeciesRulesVersion !== input.species.rulesVersion) {
    throw new Error('Reef Foundation Mesh received an incompatible species rulesVersion.');
  }
  if (input.layout.artifactSeed !== input.species.artifactSeed) {
    throw new Error('Reef Foundation Mesh requires matching species and layout artifactSeed.');
  }
  if (input.layout.asOf !== input.species.asOf) {
    throw new Error('Reef Foundation Mesh requires matching species and layout asOf.');
  }
}

/**
 * Uses the same deterministic analytical substrate accepted by Phase 2. The
 * equality is locked by Phase 3 tests so future changes must version both
 * adapters together instead of silently moving colony anchors off the mesh.
 */
function surfaceHeightAt(species: ReefSpeciesBlueprint, x: number, z: number): number {
  const structure = species.structure;
  const radius = Math.hypot(x, z);
  const normalizedRadius = clamp01(radius / structure.substrateRadius);
  const azimuth = Math.atan2(z, x);
  const phaseA = seededUnit(structure.seed, 'surface-phase-a') * TAU;
  const phaseB = seededUnit(structure.seed, 'surface-phase-b') * TAU;
  const shelfIndex = Math.min(
    structure.shelfCount - 1,
    Math.floor(normalizedRadius * structure.shelfCount),
  );
  const shelfProgress = structure.shelfCount <= 1
    ? 1
    : 1 - shelfIndex / (structure.shelfCount - 1);
  const mound = structure.reefHeight * (
    0.16 + 0.84 * Math.pow(1 - normalizedRadius, 1.35)
  );
  const shelf = structure.reefHeight
    * structure.verticalRelief
    * 0.12
    * shelfProgress;
  const radialRipple = Math.sin(azimuth * 3 + phaseA)
    * structure.reefHeight
    * structure.verticalRelief
    * 0.035
    * (1 - normalizedRadius * 0.65);
  const crossRipple = Math.cos(normalizedRadius * Math.PI * 4 + phaseB)
    * structure.reefHeight
    * structure.verticalRelief
    * 0.028;
  const slope = Math.cos(azimuth - structure.currentDirectionRad)
    * structure.reefHeight
    * structure.slopeBias
    * 0.08
    * normalizedRadius;

  return round6(Math.max(0, mound + shelf + radialRipple + crossRipple + slope));
}

function surfaceNormalAt(
  species: ReefSpeciesBlueprint,
  x: number,
  z: number,
): ReefLayoutVec3 {
  const step = Math.max(0.004, species.structure.substrateRadius * 0.012);
  const left = surfaceHeightAt(species, x - step, z);
  const right = surfaceHeightAt(species, x + step, z);
  const back = surfaceHeightAt(species, x, z - step);
  const front = surfaceHeightAt(species, x, z + step);
  return normalizeVector({
    x: left - right,
    y: step * 2,
    z: back - front,
  });
}

function cellId(radialBand: number, azimuthSectorIndex: number): string {
  return `reef:substrate-cell:r${radialBand}:a${azimuthSectorIndex}`;
}

function topPatchId(substrateCellId: string): string {
  return `reef:foundation-patch:${substrateCellId.slice('reef:substrate-cell:'.length)}`;
}

function cross(
  left: ReefLayoutVec3,
  right: ReefLayoutVec3,
): ReefLayoutVec3 {
  return {
    x: left.y * right.z - left.z * right.y,
    y: left.z * right.x - left.x * right.z,
    z: left.x * right.y - left.y * right.x,
  };
}

function subtract(left: ReefLayoutVec3, right: ReefLayoutVec3): ReefLayoutVec3 {
  return {
    x: left.x - right.x,
    y: left.y - right.y,
    z: left.z - right.z,
  };
}

function dot(left: ReefLayoutVec3, right: ReefLayoutVec3): number {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}

function orientTriangle(
  vertices: readonly ReefFoundationVertex[],
  a: number,
  b: number,
  c: number,
  expectedDirection: ReefLayoutVec3,
): [number, number, number] {
  const first = vertices[a];
  const second = vertices[b];
  const third = vertices[c];
  if (!first || !second || !third) {
    throw new Error('Reef Foundation Mesh triangle references a missing vertex.');
  }
  const normal = cross(
    subtract(second.position, first.position),
    subtract(third.position, first.position),
  );
  return dot(normal, expectedDirection) >= 0 ? [a, b, c] : [a, c, b];
}

function triangleArea(
  triangle: ReefFoundationTriangle,
  vertices: readonly ReefFoundationVertex[],
): number {
  const first = vertices[triangle.a];
  const second = vertices[triangle.b];
  const third = vertices[triangle.c];
  if (!first || !second || !third) return 0;
  const normal = cross(
    subtract(second.position, first.position),
    subtract(third.position, first.position),
  );
  return Math.hypot(normal.x, normal.y, normal.z) * 0.5;
}

function edgeDiagnostics(triangles: readonly ReefFoundationTriangle[]): {
  boundaryEdgeCount: number;
  nonManifoldEdgeCount: number;
} {
  const counts = new Map<string, number>();
  for (const triangle of triangles) {
    for (const [left, right] of [
      [triangle.a, triangle.b],
      [triangle.b, triangle.c],
      [triangle.c, triangle.a],
    ] as const) {
      const key = left < right ? `${left}:${right}` : `${right}:${left}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  let boundaryEdgeCount = 0;
  let nonManifoldEdgeCount = 0;
  for (const count of counts.values()) {
    if (count === 1) boundaryEdgeCount += 1;
    if (count > 2) nonManifoldEdgeCount += 1;
  }
  return { boundaryEdgeCount, nonManifoldEdgeCount };
}

/**
 * Pure Phase 3 adapter. It publishes a closed indexed foundation shell and
 * stable colony attachment points without Three.js objects, materials, UI or
 * database work.
 */
export function buildReefFoundationMesh(
  input: BuildReefFoundationMeshInput,
): ReefFoundationMeshState {
  const config = input.config ?? DEFAULT_REEF_FOUNDATION_MESH_CONFIG;
  validateConfig(config);
  validateProvenance(input);

  const radialBandCount = input.species.grammar.radialBandCount;
  const azimuthSectorCount = Math.max(
    0,
    ...input.layout.cells.map((cell) => cell.azimuthSectorIndex + 1),
  );
  if (radialBandCount < 1 || azimuthSectorCount < 8) {
    throw new Error('Reef Foundation Mesh requires accepted radial bands and sectors.');
  }
  if (input.layout.cells.length !== radialBandCount * azimuthSectorCount) {
    throw new Error('Reef Foundation Mesh requires a complete rectangular substrate grid.');
  }

  const cellsById = new Map(input.layout.cells.map((cell) => [cell.id, cell] as const));
  for (let radialBand = 0; radialBand < radialBandCount; radialBand += 1) {
    for (let sector = 0; sector < azimuthSectorCount; sector += 1) {
      if (!cellsById.has(cellId(radialBand, sector))) {
        throw new Error('Reef Foundation Mesh substrate grid contains a missing cell.');
      }
    }
  }

  const vertices: ReefFoundationVertex[] = [];
  const triangles: ReefFoundationTriangle[] = [];
  const patches: ReefFoundationPatch[] = [];
  const radius = input.species.structure.substrateRadius;
  const sectorAngle = TAU / azimuthSectorCount;

  const addVertex = (
    id: string,
    surface: ReefFoundationSurface,
    ringIndex: number | null,
    azimuthSectorIndex: number | null,
    position: ReefLayoutVec3,
    normal: ReefLayoutVec3,
  ): number => {
    const index = vertices.length;
    vertices.push({
      id,
      sequence: index,
      surface,
      ringIndex,
      azimuthSectorIndex,
      position: {
        x: round6(position.x),
        y: round6(position.y),
        z: round6(position.z),
      },
      normal: normalizeVector(normal),
      uv: {
        u: round6(clamp(0.5 + position.x / (radius * 2), 0, 1)),
        v: round6(clamp(0.5 + position.z / (radius * 2), 0, 1)),
      },
    });
    return index;
  };

  const addTriangle = (
    surface: ReefFoundationSurface,
    patchId: string,
    a: number,
    b: number,
    c: number,
    expectedDirection: ReefLayoutVec3,
  ): string => {
    const [orientedA, orientedB, orientedC] = orientTriangle(
      vertices,
      a,
      b,
      c,
      expectedDirection,
    );
    const id = `reef:foundation-triangle:${surface}:${triangles.length}`;
    triangles.push({
      id,
      sequence: triangles.length,
      surface,
      patchId,
      a: orientedA,
      b: orientedB,
      c: orientedC,
    });
    return id;
  };

  const centerPosition = {
    x: 0,
    y: surfaceHeightAt(input.species, 0, 0),
    z: 0,
  };
  const topCenterIndex = addVertex(
    'reef:foundation-vertex:top:center',
    'top',
    0,
    null,
    centerPosition,
    surfaceNormalAt(input.species, 0, 0),
  );

  const topRings: number[][] = [];
  for (let ringIndex = 1; ringIndex <= radialBandCount; ringIndex += 1) {
    const ring: number[] = [];
    const ringRadius = radius * ringIndex / radialBandCount;
    for (let sector = 0; sector < azimuthSectorCount; sector += 1) {
      const azimuth = sector * sectorAngle;
      const x = Math.cos(azimuth) * ringRadius;
      const z = Math.sin(azimuth) * ringRadius;
      ring.push(addVertex(
        `reef:foundation-vertex:top:r${ringIndex}:a${sector}`,
        'top',
        ringIndex,
        sector,
        { x, y: surfaceHeightAt(input.species, x, z), z },
        surfaceNormalAt(input.species, x, z),
      ));
    }
    topRings.push(ring);
  }

  for (let radialBand = 0; radialBand < radialBandCount; radialBand += 1) {
    for (let sector = 0; sector < azimuthSectorCount; sector += 1) {
      const next = (sector + 1) % azimuthSectorCount;
      const substrateCellId = cellId(radialBand, sector);
      const patchId = topPatchId(substrateCellId);
      const triangleIds: string[] = [];
      const outerRing = topRings[radialBand];
      const outerCurrent = outerRing?.[sector];
      const outerNext = outerRing?.[next];
      if (outerCurrent === undefined || outerNext === undefined) {
        throw new Error('Reef Foundation Mesh could not resolve an outer ring vertex.');
      }

      if (radialBand === 0) {
        triangleIds.push(addTriangle(
          'top',
          patchId,
          topCenterIndex,
          outerCurrent,
          outerNext,
          { x: 0, y: 1, z: 0 },
        ));
      } else {
        const innerRing = topRings[radialBand - 1];
        const innerCurrent = innerRing?.[sector];
        const innerNext = innerRing?.[next];
        if (innerCurrent === undefined || innerNext === undefined) {
          throw new Error('Reef Foundation Mesh could not resolve an inner ring vertex.');
        }
        triangleIds.push(addTriangle(
          'top',
          patchId,
          innerCurrent,
          outerCurrent,
          outerNext,
          { x: 0, y: 1, z: 0 },
        ));
        triangleIds.push(addTriangle(
          'top',
          patchId,
          innerCurrent,
          outerNext,
          innerNext,
          { x: 0, y: 1, z: 0 },
        ));
      }

      patches.push({
        id: patchId,
        surface: 'top',
        substrateCellId,
        radialBand,
        azimuthSectorIndex: sector,
        triangleIds,
      });
    }
  }

  const outerTopRing = topRings[radialBandCount - 1];
  if (!outerTopRing || outerTopRing.length !== azimuthSectorCount) {
    throw new Error('Reef Foundation Mesh requires a complete outer top ring.');
  }
  const minimumTopY = Math.min(...vertices.map((vertex) => vertex.position.y));
  const bottomY = round6(minimumTopY - radius * config.skirtDepthRatio);
  const bottomRing: number[] = [];
  for (let sector = 0; sector < azimuthSectorCount; sector += 1) {
    const azimuth = sector * sectorAngle;
    const x = Math.cos(azimuth) * radius;
    const z = Math.sin(azimuth) * radius;
    bottomRing.push(addVertex(
      `reef:foundation-vertex:bottom:ring:a${sector}`,
      'side',
      radialBandCount + 1,
      sector,
      { x, y: bottomY, z },
      { x: Math.cos(azimuth), y: -0.3, z: Math.sin(azimuth) },
    ));
  }
  const bottomCenterIndex = addVertex(
    'reef:foundation-vertex:bottom:center',
    'bottom',
    null,
    null,
    { x: 0, y: bottomY, z: 0 },
    { x: 0, y: -1, z: 0 },
  );

  for (let sector = 0; sector < azimuthSectorCount; sector += 1) {
    const next = (sector + 1) % azimuthSectorCount;
    const topCurrent = outerTopRing[sector];
    const topNext = outerTopRing[next];
    const bottomCurrent = bottomRing[sector];
    const bottomNext = bottomRing[next];
    if (
      topCurrent === undefined
      || topNext === undefined
      || bottomCurrent === undefined
      || bottomNext === undefined
    ) {
      throw new Error('Reef Foundation Mesh could not resolve a skirt vertex.');
    }

    const midpointAzimuth = (sector + 0.5) * sectorAngle;
    const outward = {
      x: Math.cos(midpointAzimuth),
      y: 0,
      z: Math.sin(midpointAzimuth),
    };
    const sidePatchId = `reef:foundation-patch:side:a${sector}`;
    const sideTriangleIds = [
      addTriangle('side', sidePatchId, topCurrent, bottomCurrent, bottomNext, outward),
      addTriangle('side', sidePatchId, topCurrent, bottomNext, topNext, outward),
    ];
    patches.push({
      id: sidePatchId,
      surface: 'side',
      substrateCellId: null,
      radialBand: null,
      azimuthSectorIndex: sector,
      triangleIds: sideTriangleIds,
    });

    const bottomPatchId = `reef:foundation-patch:bottom:a${sector}`;
    const bottomTriangleIds = [addTriangle(
      'bottom',
      bottomPatchId,
      bottomCenterIndex,
      bottomCurrent,
      bottomNext,
      { x: 0, y: -1, z: 0 },
    )];
    patches.push({
      id: bottomPatchId,
      surface: 'bottom',
      substrateCellId: null,
      radialBand: null,
      azimuthSectorIndex: sector,
      triangleIds: bottomTriangleIds,
    });
  }

  const topPatchesByCellId = new Map(
    patches
      .filter((patch) => patch.substrateCellId !== null)
      .map((patch) => [patch.substrateCellId as string, patch] as const),
  );
  const attachments: ReefFoundationAttachment[] = input.layout.colonies.map((colony) => {
    const patch = topPatchesByCellId.get(colony.substrateCellId);
    if (!patch) {
      throw new Error('Reef Foundation Mesh colony references a missing top patch.');
    }
    return {
      id: `reef:foundation-attachment:${colony.id.slice('reef:colony:'.length)}`,
      colonyId: colony.id,
      substrateCellId: colony.substrateCellId,
      patchId: patch.id,
      position: { ...colony.position },
      normal: { ...colony.normal },
      facingRad: colony.facingRad,
      footprintRadius: colony.footprintRadius,
      targetHeight: colony.targetHeight,
    };
  });

  const cellIdsWithoutPatch = input.layout.cells
    .filter((cell) => !topPatchesByCellId.has(cell.id))
    .map((cell) => cell.id);
  const attachmentColonyIds = new Set(attachments.map((attachment) => attachment.colonyId));
  const colonyIdsWithoutAttachment = input.layout.colonies
    .filter((colony) => !attachmentColonyIds.has(colony.id))
    .map((colony) => colony.id);
  const degenerateTriangleIds = triangles
    .filter((triangle) => triangleArea(triangle, vertices) <= 1e-9)
    .map((triangle) => triangle.id);
  const edgeState = edgeDiagnostics(triangles);
  const topTriangleCount = triangles.filter((triangle) => triangle.surface === 'top').length;
  const sideTriangleCount = triangles.filter((triangle) => triangle.surface === 'side').length;
  const bottomTriangleCount = triangles.filter((triangle) => triangle.surface === 'bottom').length;
  const geometryBudgetExceeded = vertices.length > config.maximumVertices
    || triangles.length > config.maximumTriangles;

  return {
    reefFoundationMeshVersion: 1,
    rulesVersion: config.rulesVersion.trim(),
    descriptor: {
      id: 'reef:foundation-mesh',
      vertexId: 'reef:foundation-vertex',
      triangleId: 'reef:foundation-triangle',
      patchId: 'reef:foundation-patch',
      attachmentId: 'reef:foundation-attachment',
    },
    sourceSpeciesBlueprintVersion: input.species.speciesBlueprintVersion,
    sourceSpeciesRulesVersion: input.species.rulesVersion,
    sourceColonyLayoutVersion: input.layout.reefColonyLayoutVersion,
    sourceColonyLayoutRulesVersion: input.layout.rulesVersion,
    artifactSeed: input.species.artifactSeed,
    asOf: input.species.asOf,
    vertices,
    triangles,
    index: triangles.flatMap((triangle) => [triangle.a, triangle.b, triangle.c]),
    patches,
    attachments,
    diagnostics: {
      radialBandCount,
      azimuthSectorCount,
      vertexCount: vertices.length,
      triangleCount: triangles.length,
      topTriangleCount,
      sideTriangleCount,
      bottomTriangleCount,
      cellPatchCount: topPatchesByCellId.size,
      attachmentCount: attachments.length,
      cellIdsWithoutPatch,
      colonyIdsWithoutAttachment,
      degenerateTriangleIds,
      boundaryEdgeCount: edgeState.boundaryEdgeCount,
      nonManifoldEdgeCount: edgeState.nonManifoldEdgeCount,
      closedShell: edgeState.boundaryEdgeCount === 0
        && edgeState.nonManifoldEdgeCount === 0
        && degenerateTriangleIds.length === 0,
      maximumVertices: config.maximumVertices,
      maximumTriangles: config.maximumTriangles,
      geometryBudgetExceeded,
      estimatedDrawCalls: 1,
      materialSlots: 1,
      perFrameUpdates: 0,
    },
  };
}
