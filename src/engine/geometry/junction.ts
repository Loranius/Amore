import {
  normalize,
  orthonormalBasis,
  round6,
  roundVec,
} from '../growth/math';
import type { GrowthBody, GrowthVec3 } from '../growth';
import { pointInsideCrystalSolid } from './trim';
import type {
  CrystalAttachmentJunction,
  CrystalGeometryConfig,
  CrystalMeshData,
  CrystalSolid,
} from './types';

function vertexAt(positions: readonly number[], index: number): GrowthVec3 {
  return {
    x: positions[index * 3] ?? 0,
    y: positions[index * 3 + 1] ?? 0,
    z: positions[index * 3 + 2] ?? 0,
  };
}

export function buildCrystalJunction(
  child: GrowthBody,
  childMesh: CrystalMeshData,
  hostSolid: CrystalSolid,
  config: CrystalGeometryConfig,
): CrystalAttachmentJunction | null {
  const attachment = child.attachment;
  if (child.hostBodyId === null || attachment === null) return null;

  const normal = normalize(attachment.normal, child.direction);
  const { tangent, bitangent } = orthonormalBasis(normal);
  let sealed = childMesh.baseCapRemoved;
  for (let segment = 0; segment < childMesh.profile.segments && sealed; segment += 1) {
    sealed = pointInsideCrystalSolid(
      vertexAt(childMesh.positions, segment),
      hostSolid,
      config.hiddenFaceEpsilon * 2,
    );
  }

  const contactRadius = Math.max(
    0.0001,
    Math.min(child.renderedRadius, childMesh.profile.rows[1]?.radius ?? child.renderedRadius),
  );
  const penetrationDepth = childMesh.profile.extraSink + attachment.burialDepth;

  return {
    junctionVersion: 1,
    id: `${child.hostBodyId}->${child.id}`,
    hostBodyId: child.hostBodyId,
    childBodyId: child.id,
    origin: roundVec(attachment.point),
    normal: roundVec(normal),
    tangent: roundVec(tangent),
    bitangent: roundVec(bitangent),
    contactRadius: round6(contactRadius),
    penetrationDepth: round6(penetrationDepth),
    clearanceRadius: round6(contactRadius * 1.6),
    trimPolicy: 'hidden-face-removal',
    seamPolicy: 'sealed-overlap',
    materialBlendWidth: round6(contactRadius * 0.35),
    sealed,
  };
}
