import {
  add,
  clamp,
  directionFromAzimuthElevation,
  ensureUpward,
  normalize,
  orthonormalBasis,
  round6,
  roundVec,
  scale,
  seededUnit,
} from './math';
import type {
  GrowthAttachment,
  GrowthBody,
  GrowthVec3,
  UniversalGrowthInstruction,
} from './types';

export interface GrowthSiteCandidate {
  siteKey: string;
  candidateIndex: number;
  host: GrowthBody;
  hostT: number;
  hostAngleRad: number;
  surfacePoint: GrowthVec3;
  surfaceNormal: GrowthVec3;
  anchor: GrowthVec3;
  direction: GrowthVec3;
  burialDepth: number;
}

function radiusAt(host: GrowthBody, hostT: number): number {
  return host.skeletonRadius
    * host.surfaceRadiusScale
    * (1 - clamp(hostT, 0, 1) * 0.62);
}

export function bodyEnd(body: Pick<GrowthBody, 'anchor' | 'direction' | 'skeletonLength'>): GrowthVec3 {
  return add(body.anchor, scale(body.direction, body.skeletonLength));
}

export function sampleGrowthSite(
  host: GrowthBody,
  instruction: UniversalGrowthInstruction,
  candidateIndex: number,
): GrowthSiteCandidate {
  const tJitter = (seededUnit(instruction.seed, `site:${candidateIndex}:t`) - 0.5) * 0.34;
  const hostT = round6(clamp(0.16 + instruction.radialBias * 0.62 + tJitter, 0.12, 0.88));

  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const angleJitter = (seededUnit(instruction.seed, `site:${candidateIndex}:angle`) - 0.5) * 0.7;
  const hostAngleRad = round6(
    instruction.preferredAzimuthRad + candidateIndex * goldenAngle + angleJitter,
  );

  const { tangent, bitangent } = orthonormalBasis(host.direction);
  const radialNormal = normalize(add(
    scale(tangent, Math.cos(hostAngleRad)),
    scale(bitangent, Math.sin(hostAngleRad)),
  ));
  const center = add(host.anchor, scale(host.direction, host.skeletonLength * hostT));
  const surfacePoint = add(center, scale(radialNormal, radiusAt(host, hostT)));
  const surfaceNormal = normalize(add(scale(radialNormal, 0.92), scale(host.direction, 0.08)));

  const preferred = directionFromAzimuthElevation(
    instruction.preferredAzimuthRad,
    instruction.preferredElevation,
  );
  const inherited = instruction.directionInheritance;
  const direction = ensureUpward(
    add(
      add(scale(surfaceNormal, inherited), scale(preferred, 1 - inherited)),
      scale(host.direction, 0.12),
    ),
    instruction.minUpwardComponent,
  );

  const burialDepth = round6(instruction.radialScale * instruction.attachmentDepth);
  const anchor = add(surfacePoint, scale(direction, -burialDepth));

  return {
    siteKey: `${host.id}:site:${instruction.id}:${candidateIndex}`,
    candidateIndex,
    host,
    hostT,
    hostAngleRad,
    surfacePoint: roundVec(surfacePoint),
    surfaceNormal: roundVec(surfaceNormal),
    anchor: roundVec(anchor),
    direction: roundVec(direction),
    burialDepth,
  };
}

export function attachmentFromSite(site: GrowthSiteCandidate): GrowthAttachment {
  return {
    siteKey: site.siteKey,
    hostBodyId: site.host.id,
    hostT: site.hostT,
    hostAngleRad: site.hostAngleRad,
    point: site.surfacePoint,
    normal: site.surfaceNormal,
    burialDepth: site.burialDepth,
  };
}
