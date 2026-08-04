import type { TreeGroundContactConfig } from './types';

export const DEFAULT_TREE_GROUND_CONTACT_CONFIG: TreeGroundContactConfig = {
  rulesVersion: 'tree-ground-contact-v1.1.0',
  burialDepthBaseRadiusRatio: 0.22,
  minimumBurialDepth: 0.018,
  maximumBurialDepth: 0.12,
  // A wider buttress that still ends exactly on the trunk. At 1.42 the flare
  // was a small step at the foot of a cylinder, so the base read as a trunk
  // *placed on* the roots; real wood widens into the ground and the roots are
  // that widening continuing outwards.
  //
  // The top ratio is 1, and that is the part that matters: the collar is a
  // separate cone, so any other value leaves a lip where it meets the trunk —
  // which is the join the owner saw. Kept short for the same reason: over this
  // height the trunk has barely tapered, so one ratio still meets it. Raising
  // the height without teaching the collar the trunk's taper reopens the lip.
  collarHeightBaseRadiusRatio: 0.72,
  collarBottomRadiusRatio: 2.05,
  collarTopRadiusRatio: 1,
  // Matched to the trunk and roots: a flare of eight sides between a
  // thirteen-sided trunk and nine-sided roots is its own visible seam.
  collarRadialSegmentsByLod: {
    high: 14,
    medium: 13,
    low: 7,
  },
};
