export type ReefFishDepthRole = 'near' | 'mid' | 'far';

export type ReefFishDepthProfile = {
  role: ReefFishDepthRole;
  angleCenter: number | null;
  angleSpread: number;
  minRadius: number;
  maxRadius: number;
  minY: number;
  maxY: number;
  minScale: number;
  maxScale: number;
  minCruiseSpeed: number;
  maxCruiseSpeed: number;
};

const NEAR: ReefFishDepthProfile = {
  role: 'near',
  angleCenter: Math.PI / 2,
  angleSpread: Math.PI * 0.72,
  minRadius: 2.5,
  maxRadius: 3.45,
  minY: 0.78,
  maxY: 2.38,
  minScale: 0.48,
  maxScale: 0.62,
  minCruiseSpeed: 0.42,
  maxCruiseSpeed: 0.57,
};

const MID: ReefFishDepthProfile = {
  role: 'mid',
  angleCenter: null,
  angleSpread: Math.PI * 2,
  minRadius: 2.68,
  maxRadius: 4.02,
  minY: 0.68,
  maxY: 2.48,
  minScale: 0.35,
  maxScale: 0.5,
  minCruiseSpeed: 0.38,
  maxCruiseSpeed: 0.58,
};

const FAR: ReefFishDepthProfile = {
  role: 'far',
  angleCenter: -Math.PI / 2,
  angleSpread: Math.PI * 0.68,
  minRadius: 3.0,
  maxRadius: 4.12,
  minY: 0.92,
  maxY: 2.42,
  minScale: 0.27,
  maxScale: 0.38,
  minCruiseSpeed: 0.34,
  maxCruiseSpeed: 0.5,
};

export function getReefFishDepthProfile(index: number): ReefFishDepthProfile {
  if (index < 2) return NEAR;
  if (index < 6) return MID;
  return FAR;
}
