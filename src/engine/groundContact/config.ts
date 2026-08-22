import type { TreeGroundContactConfig } from './types';

export const DEFAULT_TREE_GROUND_CONTACT_CONFIG: TreeGroundContactConfig = {
  rulesVersion: 'tree-ground-contact-v1.2.0',
  burialDepthBaseRadiusRatio: 0.22,
  minimumBurialDepth: 0.018,
  maximumBurialDepth: 0.12,
  // The collar is a root flare, not a second stump around the trunk. A wide
  // linear cone left three visible horizontal steps and remained outside the
  // already-tapering trunk at its upper edge. The eased profile concentrates
  // the widening near the soil, then approaches the trunk with a flat tangent.
  collarHeightBaseRadiusRatio: 0.72,
  collarBottomRadiusRatio: 1.78,
  // Slightly inside the trunk envelope at this height, so the final ring is
  // hidden instead of forming a lip where the two meshes meet.
  collarTopRadiusRatio: 0.94,
  collarProfileExponent: 2.4,
  // Matched to the trunk and roots: a flare of eight sides between a
  // thirteen-sided trunk and nine-sided roots is its own visible seam.
  collarRadialSegmentsByLod: {
    high: 14,
    medium: 13,
    low: 7,
  },
};
