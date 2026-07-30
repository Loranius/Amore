import {
  add,
  clamp01,
  round6,
  scale,
  segmentDistance,
} from '../../growth/math';
import type {
  GrowthBody,
  GrowthCenterRole,
  GrowthState,
} from '../../growth/types';

const BURIAL_SAMPLES = [0.04, 0.12, 0.22, 0.34, 0.48, 0.62] as const;
const BURIAL_WEIGHTS = [1, 0.96, 0.82, 0.62, 0.38, 0.18] as const;

export type CrystalBurialClass = 'exposed' | 'embedded' | 'deeply-buried';

export interface CrystalBodyBurialState {
  readonly bodyId: string;
  readonly growthCenterId: string | null;
  readonly role: GrowthCenterRole | null;
  readonly burialRatio: number;
  readonly buriedLength: number;
  readonly exposedLength: number;
  readonly exposedTipRatio: number;
  readonly baseCoverage: number;
  readonly burialClass: CrystalBurialClass;
  readonly buriedByBodyIds: readonly string[];
  readonly buriedByGrowthCenterIds: readonly string[];
}

export interface CrystalCenterMaturationState {
  readonly id: string;
  readonly dominantBodyId: string | null;
  readonly bodyCount: number;
  readonly maturity: number;
  readonly structuralCompleteness: number;
  readonly cohesion: number;
  readonly burialPressure: number;
  readonly exposedTipRatio: number;
  readonly buriedBodyCount: number;
}

export interface CrystalGeologyState {
  readonly geologyStateVersion: 1;
  readonly sourceGrowthStateVersion: GrowthState['growthStateVersion'];
  readonly bodyCount: number;
  readonly buriedBodyCount: number;
  readonly maxBurialRatio: number;
  readonly bodies: readonly CrystalBodyBurialState[];
  readonly centers: readonly CrystalCenterMaturationState[];
}

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function bodyOrder(left: GrowthBody, right: GrowthBody): number {
  return left.sequence - right.sequence || compareIds(left.id, right.id);
}

function isLaterBody(candidate: GrowthBody, target: GrowthBody): boolean {
  return bodyOrder(candidate, target) > 0;
}

function roleStrength(role: GrowthCenterRole | null): number {
  if (role === 'dominant') return 1;
  if (role === 'satellite') return 0.72;
  if (role === 'micro') return 0.38;
  return 0.58;
}

function tierStrength(body: GrowthBody): number {
  if (body.tier === 'king') return 1;
  if (body.tier === 'support') return 0.96;
  if (body.tier === 'family') return 0.82;
  if (body.tier === 'companion') return 0.68;
  return 0.42;
}

function vulnerability(body: GrowthBody): { multiplier: number; maximum: number } {
  const role = body.growthCenterRole ?? null;
  if (body.generation === 0 || body.tier === 'king') return { multiplier: 0.56, maximum: 0.34 };
  if (role === 'dominant') return { multiplier: 0.72, maximum: 0.48 };
  if (role === 'satellite') return { multiplier: 1, maximum: 0.68 };
  if (role === 'micro' || body.tier === 'micro') return { multiplier: 1.24, maximum: 0.82 };
  return { multiplier: 0.9, maximum: 0.62 };
}

function differentGeologicalCenter(target: GrowthBody, cover: GrowthBody): boolean {
  const targetCenter = target.growthCenterId ?? null;
  const coverCenter = cover.growthCenterId ?? null;
  if (coverCenter === null) return false;
  return coverCenter !== targetCenter;
}

function coverContribution(
  target: GrowthBody,
  cover: GrowthBody,
  targetPoint: GrowthBody['anchor'],
): number {
  const coverEnd = add(cover.anchor, scale(cover.direction, cover.renderedLength * 0.44));
  const distanceToLowerShell = segmentDistance(targetPoint, targetPoint, cover.anchor, coverEnd);
  const influenceRadius = Math.max(
    0.000001,
    cover.renderedRadius * (1.5 + cover.maturity * 0.42)
      + target.renderedRadius * 0.42
      + (cover.attachment?.burialDepth ?? 0) * 0.55,
  );
  const proximity = clamp01(1 - distanceToLowerShell / influenceRadius);
  if (proximity <= 0) return 0;

  const relativeSize = clamp01(
    (cover.renderedRadius * 2.6 + cover.renderedLength * 0.22)
      / Math.max(0.000001, target.renderedRadius * 1.4 + target.renderedLength * 0.22),
  );
  const maturity = 0.28 + clamp01(cover.maturity) * 0.72;
  const energy = 0.52 + clamp01(cover.growthEnergy) * 0.48;
  const chronology = 0.76 + clamp01((cover.sequence - target.sequence) / 24) * 0.24;

  return clamp01(
    proximity * proximity
      * roleStrength(cover.growthCenterRole ?? null)
      * tierStrength(cover)
      * maturity
      * energy
      * (0.58 + relativeSize * 0.42)
      * chronology,
  );
}

function combineTransmission(contributions: readonly number[]): number {
  return clamp01(1 - contributions.reduce((transmission, value) => transmission * (1 - value), 1));
}

function burialClass(burialRatio: number): CrystalBurialClass {
  if (burialRatio >= 0.42) return 'deeply-buried';
  if (burialRatio >= 0.08) return 'embedded';
  return 'exposed';
}

function buildBodyBurial(
  target: GrowthBody,
  orderedBodies: readonly GrowthBody[],
): CrystalBodyBurialState {
  const coverers = orderedBodies.filter((candidate) => (
    isLaterBody(candidate, target)
    && differentGeologicalCenter(target, candidate)
  ));
  const coverByBody = new Map<string, number>();
  const sampleCoverage = BURIAL_SAMPLES.map((sample) => {
    const point = add(target.anchor, scale(target.direction, target.renderedLength * sample));
    const contributions = coverers.map((cover) => {
      const contribution = coverContribution(target, cover, point);
      coverByBody.set(cover.id, Math.max(coverByBody.get(cover.id) ?? 0, contribution));
      return contribution;
    });
    return combineTransmission(contributions);
  });
  const totalWeight = BURIAL_WEIGHTS.reduce((sum, value) => sum + value, 0);
  const baseCoverage = sampleCoverage.reduce(
    (sum, value, index) => sum + value * (BURIAL_WEIGHTS[index] ?? 0),
    0,
  ) / totalWeight;
  const maximumCoverage = sampleCoverage.reduce((maximum, value) => Math.max(maximum, value), 0);
  const targetVulnerability = vulnerability(target);
  const ageFactor = 0.78 + clamp01(target.maturity) * 0.22;
  const burialRatio = Math.min(
    targetVulnerability.maximum,
    clamp01((baseCoverage * 0.82 + maximumCoverage * 0.18) * targetVulnerability.multiplier * ageFactor),
  );
  const effectiveBurial = burialRatio < 0.015 ? 0 : burialRatio;
  const buriedByBodyIds = [...coverByBody.entries()]
    .filter(([, contribution]) => contribution >= 0.035)
    .sort((left, right) => right[1] - left[1] || compareIds(left[0], right[0]))
    .map(([bodyId]) => bodyId);
  const bodyById = new Map(orderedBodies.map((body) => [body.id, body] as const));
  const buriedByGrowthCenterIds = [...new Set(buriedByBodyIds.flatMap((bodyId) => {
    const centerId = bodyById.get(bodyId)?.growthCenterId ?? null;
    return centerId === null ? [] : [centerId];
  }))].sort(compareIds);
  const buriedLength = target.renderedLength * effectiveBurial;
  const exposedLength = Math.max(0, target.renderedLength - buriedLength);

  return {
    bodyId: target.id,
    growthCenterId: target.growthCenterId ?? null,
    role: target.growthCenterRole ?? null,
    burialRatio: round6(effectiveBurial),
    buriedLength: round6(buriedLength),
    exposedLength: round6(exposedLength),
    exposedTipRatio: round6(clamp01(exposedLength / Math.max(target.renderedLength, 1e-6))),
    baseCoverage: round6(baseCoverage),
    burialClass: burialClass(effectiveBurial),
    buriedByBodyIds,
    buriedByGrowthCenterIds,
  };
}

function bodyMaturityWeight(body: GrowthBody): number {
  const role = body.growthCenterRole ?? null;
  if (role === 'dominant') return 2.4;
  if (role === 'satellite') return 1.2;
  if (role === 'micro') return 0.55;
  return 1;
}

function buildCenterMaturation(
  growth: GrowthState,
  burialByBodyId: ReadonlyMap<string, CrystalBodyBurialState>,
): CrystalCenterMaturationState[] {
  const bodyById = new Map(growth.bodies.map((body) => [body.id, body] as const));
  return (growth.growthCenters ?? []).map((center) => {
    const members = center.bodyIds
      .map((bodyId) => bodyById.get(bodyId))
      .filter((body): body is GrowthBody => body !== undefined)
      .sort(bodyOrder);
    const totalWeight = members.reduce((sum, body) => sum + bodyMaturityWeight(body), 0);
    const weightedMaturity = totalWeight <= 0
      ? 0
      : members.reduce((sum, body) => sum + body.maturity * bodyMaturityWeight(body), 0) / totalWeight;
    const roles = new Set(members.map((body) => body.growthCenterRole ?? null));
    const structuralCompleteness = clamp01(
      (roles.has('dominant') ? 0.4 : 0)
      + (roles.has('satellite') ? 0.3 : 0)
      + (roles.has('micro') ? 0.3 : 0),
    );
    const localMembers = members.filter((body) => body.growthCenterRole !== 'dominant');
    const cohesiveMembers = localMembers.filter((body) => {
      const host = body.hostBodyId === null ? undefined : bodyById.get(body.hostBodyId);
      return host !== undefined && (host.growthCenterId ?? null) === center.id;
    }).length;
    const cohesion = localMembers.length === 0 ? (members.length > 0 ? 1 : 0) : cohesiveMembers / localMembers.length;
    const burialStates = members.flatMap((body) => {
      const state = burialByBodyId.get(body.id);
      return state ? [state] : [];
    });
    const burialPressure = burialStates.length === 0
      ? 0
      : burialStates.reduce((sum, state) => sum + state.burialRatio, 0) / burialStates.length;
    const exposedTipRatio = burialStates.length === 0
      ? 1
      : burialStates.reduce((sum, state) => sum + state.exposedTipRatio, 0) / burialStates.length;
    const maturity = clamp01(
      weightedMaturity * 0.72
      + structuralCompleteness * 0.14
      + cohesion * 0.14,
    );

    return {
      id: center.id,
      dominantBodyId: center.dominantBodyId,
      bodyCount: members.length,
      maturity: round6(maturity),
      structuralCompleteness: round6(structuralCompleteness),
      cohesion: round6(cohesion),
      burialPressure: round6(burialPressure),
      exposedTipRatio: round6(exposedTipRatio),
      buriedBodyCount: burialStates.filter((state) => state.burialRatio >= 0.08).length,
    };
  }).sort((left, right) => compareIds(left.id, right.id));
}

/**
 * Derived, deterministic geological layer. It never mutates GrowthBody records.
 * Later Growth Centers may change burial metadata for old bodies while their
 * original anchors, directions, dimensions and attachment provenance stay byte-stable.
 */
export function buildCrystalGeologyState(growth: GrowthState): CrystalGeologyState {
  if (growth.species !== 'crystal') {
    throw new Error(`Crystal geology cannot consume species "${growth.species}".`);
  }
  const orderedBodies = [...growth.bodies].sort(bodyOrder);
  const bodies = orderedBodies.map((body) => buildBodyBurial(body, orderedBodies));
  const burialByBodyId = new Map(bodies.map((body) => [body.bodyId, body] as const));
  const buriedBodyCount = bodies.filter((body) => body.burialRatio >= 0.08).length;
  const maxBurialRatio = bodies.reduce((maximum, body) => Math.max(maximum, body.burialRatio), 0);

  return {
    geologyStateVersion: 1,
    sourceGrowthStateVersion: growth.growthStateVersion,
    bodyCount: bodies.length,
    buriedBodyCount,
    maxBurialRatio: round6(maxBurialRatio),
    bodies,
    centers: buildCenterMaturation(growth, burialByBodyId),
  };
}
