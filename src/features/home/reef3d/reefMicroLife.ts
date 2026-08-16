export const REEF_MICRO_LIFE_VERSION = 'reef-micro-life-v1';

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const TAU = Math.PI * 2;

export interface ReefMicroLifePlanInput {
  identitySeed: number;
  foundationRadius: number;
  photoCount: number;
  mediaCount: number;
}

export interface ReefMicroLifeCandidate {
  id: string;
  x: number;
  z: number;
  radialRatio: number;
  scaleJitter: number;
  rotation: number;
  creviceBias: number;
}

export interface ReefMicroLifePlan {
  version: typeof REEF_MICRO_LIFE_VERSION;
  desired: {
    encrustingPatches: number;
    sponges: number;
    creviceAccents: number;
  };
  candidates: ReefMicroLifeCandidate[];
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function boundedCount(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function stableUnit(seed: number, label: string): number {
  let hash = (seed ^ 0x9e3779b9) >>> 0;
  for (let index = 0; index < label.length; index += 1) {
    hash ^= label.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b);
  hash ^= hash >>> 16;
  return (hash >>> 0) / 0xffffffff;
}

function encrustingBudget(photoCount: number): number {
  if (photoCount <= 0) return 0;
  // Photos are intentionally clustered. Hundreds of memories should make the
  // rock feel lived-in, not create hundreds of renderer objects.
  return Math.min(40, 4 + Math.ceil(Math.log2(photoCount + 1) * 4));
}

function spongeBudget(mediaCount: number): number {
  // Reef Module Evolution already treats sponge as a mature soft-life unlock.
  // Preserve that meaning here instead of introducing sponges from the first
  // watched item.
  if (mediaCount < 20) return 0;
  return Math.min(18, 3 + Math.floor(Math.log2(mediaCount - 18) * 2));
}

function creviceBudget(photoCount: number, mediaCount: number): number {
  if (photoCount + mediaCount <= 0) return 0;
  return Math.min(
    42,
    Math.max(
      2,
      Math.ceil(Math.sqrt(photoCount) * 1.05 + Math.sqrt(mediaCount) * 0.8),
    ),
  );
}

/**
 * Renderer-neutral plan for the tiny life pass.
 *
 * It deliberately contains no colony growth and no Three.js types. The pass
 * only turns high-volume portal history into a small, capped set of candidate
 * surface probes. The renderer later binds accepted candidates to real rock
 * surfaces and rejects points occupied by the main living canopy.
 */
export function buildReefMicroLifePlan(input: ReefMicroLifePlanInput): ReefMicroLifePlan {
  const photoCount = boundedCount(input.photoCount);
  const mediaCount = boundedCount(input.mediaCount);
  const foundationRadius = Math.max(0.5, Number.isFinite(input.foundationRadius)
    ? input.foundationRadius
    : 0.5);
  const desired = {
    encrustingPatches: encrustingBudget(photoCount),
    sponges: spongeBudget(mediaCount),
    creviceAccents: creviceBudget(photoCount, mediaCount),
  };
  const desiredTotal = desired.encrustingPatches + desired.sponges + desired.creviceAccents;
  if (desiredTotal <= 0) {
    return { version: REEF_MICRO_LIFE_VERSION, desired, candidates: [] };
  }

  // Five probes per desired detail gives the support/clearance filters room to
  // find believable gaps while still putting a hard ceiling on CPU work.
  const candidateCount = Math.min(240, Math.max(48, desiredTotal * 5));
  const phase = stableUnit(input.identitySeed, 'reef:micro-life:phase') * TAU;
  const candidates = Array.from({ length: candidateCount }, (_value, index) => {
    const progress = (index + 0.5) / candidateCount;
    const radialJitter = (stableUnit(input.identitySeed, `reef:micro-life:${index}:radius`) - 0.5) * 0.09;
    const radialRatio = clamp(0.18 + Math.sqrt(progress) * 0.72 + radialJitter, 0.16, 0.94);
    const angularJitter = (stableUnit(input.identitySeed, `reef:micro-life:${index}:angle`) - 0.5) * 0.34;
    const angle = phase + index * GOLDEN_ANGLE + angularJitter;
    return {
      id: `reef:micro-life:candidate:${index}`,
      x: Math.cos(angle) * foundationRadius * radialRatio,
      z: Math.sin(angle) * foundationRadius * radialRatio,
      radialRatio,
      scaleJitter: stableUnit(input.identitySeed, `reef:micro-life:${index}:scale`),
      rotation: stableUnit(input.identitySeed, `reef:micro-life:${index}:rotation`) * TAU,
      creviceBias: stableUnit(input.identitySeed, `reef:micro-life:${index}:crevice`),
    };
  });

  return {
    version: REEF_MICRO_LIFE_VERSION,
    desired,
    candidates,
  };
}
