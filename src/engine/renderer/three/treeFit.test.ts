import { describe, expect, it } from 'vitest';
import type { TreeGroundDetailInstance } from '../../groundDetail';
import type { TreeLeafInstance } from '../../leafGeometry';
import {
  ARTIFACT_FIT_HEIGHT,
  ARTIFACT_FIT_WIDTH,
  CRYSTAL_GROUND_BASELINE,
} from './bundle';
import { fitThreeTree, measureThreeTreeReach, type ThreeTreeFitContent } from './treeFit';

function leaf(x: number, y: number, z: number, length: number): TreeLeafInstance {
  return {
    id: `leaf:${x}:${y}:${z}`,
    clusterId: 'cluster',
    branchId: 'branch',
    localIndex: 0,
    sequence: 0,
    seed: 1,
    position: { x, y, z },
    direction: { x: 0, y: 1, z: 0 },
    normal: { x: 0, y: 0, z: 1 },
    length,
    width: length * 0.4,
    rollRad: 0,
  };
}

function chip(x: number, y: number, z: number): TreeGroundDetailInstance {
  return {
    id: `chip:${x}:${z}`,
    sequence: 0,
    kindSequence: 0,
    kind: 'stone',
    position: { x, y, z },
    normal: { x: 0, y: 1, z: 0 },
    yawRad: 0,
    scale: { x: 1, y: 1, z: 1 },
    color: { r: 0.5, g: 0.5, b: 0.5 },
    sourceTerrainVertexIndex: 0,
  };
}

/** A trunk two units tall on a soil disc three units across, plus one leaf. */
function content(overrides: Partial<ThreeTreeFitContent> = {}): ThreeTreeFitContent {
  return {
    mesh: { positions: [0, 0, 0, 0.2, 2, 0, -0.2, 2, 0] },
    rootGeometry: { mesh: { positions: [1.5, -0.1, 0, -1.5, -0.1, 0, 0, 0, 1.5] } },
    leaves: { instances: [leaf(0.3, 2, 0, 0.5)] },
    canopyDepth: { profiles: [] },
    crownSilhouette: { profiles: [] },
    groundDetails: { instances: [chip(1.2, -0.05, 0)] },
    ...overrides,
  };
}

describe('measureThreeTreeReach', () => {
  it('counts the canopy, which lives in the instance list and not in any buffer', () => {
    const reach = measureThreeTreeReach(content());
    // Guards the regression this measurement exists for: reading the vertex
    // buffers alone reported a tree that stopped at the top of its trunk, and
    // the fit then scaled by that height and pushed the crown above the frame.
    expect(reach.maxY).toBeCloseTo(2.5, 6);
    expect(reach.crownReach).toBeCloseTo(0.8, 6);
  });

  it('separates the soil the podium covers from the crown the camera frames', () => {
    const reach = measureThreeTreeReach(content());
    expect(reach.soilReach).toBeCloseTo(1.5, 6);
    expect(reach.crownReach).toBeLessThan(reach.soilReach);
  });

  it('takes the lowest point from the soil, which dips below the tree ground plane', () => {
    expect(measureThreeTreeReach(content()).minY).toBeCloseTo(-0.1, 6);
  });

  it('follows the leaf the renderer draws, not the one the leaf list describes', () => {
    // Regression: crown silhouette and canopy depth both republish a position
    // and a scale, and the instanced mesh prefers the silhouette's. Reading the
    // instance list alone understated the crown by about a fifth, the camera
    // framed the smaller one, and the outer leaves were cut off by the sides of
    // the screen.
    const moved = measureThreeTreeReach(content({
      crownSilhouette: {
        profiles: [{
          leafInstanceId: 'leaf:0.3:2:0',
          renderPosition: { x: 2, y: 3, z: 0 },
          scaleMultiplier: 2,
        }],
      } as ThreeTreeFitContent['crownSilhouette'],
    }));
    expect(moved.crownReach).toBeCloseTo(3, 6);
    expect(moved.maxY).toBeCloseTo(4, 6);
  });

  it('prefers the silhouette over the canopy, in the renderer order', () => {
    const both = measureThreeTreeReach(content({
      canopyDepth: {
        profiles: [{
          leafInstanceId: 'leaf:0.3:2:0',
          renderPosition: { x: 9, y: 9, z: 0 },
          scaleMultiplier: 1,
        }],
      } as ThreeTreeFitContent['canopyDepth'],
      crownSilhouette: {
        profiles: [{
          leafInstanceId: 'leaf:0.3:2:0',
          renderPosition: { x: 1, y: 2, z: 0 },
          scaleMultiplier: 1,
        }],
      } as ThreeTreeFitContent['crownSilhouette'],
    }));
    expect(both.crownReach).toBeCloseTo(1.5, 6);
  });

  it('keys profiles on the instance sequence, as the instanced mesh does', () => {
    const sequenced = leaf(0.3, 2, 0, 0.5);
    const reach = measureThreeTreeReach(content({
      leaves: { instances: [{ ...sequenced, sequence: 1 }] },
      crownSilhouette: {
        profiles: [
          { leafInstanceId: 'other', renderPosition: { x: 9, y: 0, z: 0 }, scaleMultiplier: 1 },
          { leafInstanceId: sequenced.id, renderPosition: { x: 1, y: 2, z: 0 }, scaleMultiplier: 1 },
        ],
      } as ThreeTreeFitContent['crownSilhouette'],
    }));
    expect(reach.crownReach).toBeCloseTo(1.5, 6);
  });
});

describe('fitThreeTree', () => {
  it('renders below the crystal ceiling, where real crystals actually sit', () => {
    const fit = fitThreeTree(measureThreeTreeReach(content()));
    // The ceiling is the size a fully mature druse reaches; fitting the tree to
    // it drew it larger than any crystal the owner has seen, and on a wide
    // screen the crown ran into the header. See TREE_FIT_HEIGHT.
    expect(fit.height).toBeLessThan(ARTIFACT_FIT_HEIGHT);
    expect(fit.height).toBeGreaterThan(ARTIFACT_FIT_HEIGHT * 0.6);
    expect(fit.crownRadius * 2).toBeLessThanOrEqual(ARTIFACT_FIT_WIDTH + 1e-6);
  });

  it('scales every tree to the same height, since the species has no age response', () => {
    const short = fitThreeTree({ minY: 0, maxY: 3, crownReach: 1, soilReach: 1 });
    const tall = fitThreeTree({ minY: 0, maxY: 6, crownReach: 2, soilReach: 2 });
    expect(short.height).toBeCloseTo(tall.height, 6);
  });

  it('lets width bind when a tree is wider than it is tall', () => {
    const fit = fitThreeTree({ minY: 0, maxY: 1, crownReach: 10, soilReach: 10 });
    expect(fit.crownRadius * 2).toBeCloseTo(ARTIFACT_FIT_WIDTH, 6);
    expect(fit.height).toBeLessThan(ARTIFACT_FIT_HEIGHT);
  });

  it('rests the soil disc on the floor line instead of burying it', () => {
    const fit = fitThreeTree(measureThreeTreeReach(content()));
    // Regression: anchoring the tree's own ground plane (engine y=0) to the
    // floor line sank the whole terrain dish inside the podium's stone, and the
    // roots — which are meshed to merge into that dish — ended as flat spikes
    // lying on bare rock. The lowest drawn point is what lands on the line.
    expect(fit.groundY - fit.groundPlaneLift).toBeCloseTo(CRYSTAL_GROUND_BASELINE, 6);
    expect(fit.groundPlaneLift).toBeCloseTo(0.1 * fit.scale, 6);
  });

  it('scales the soil by the same factor as the crown', () => {
    const reach = measureThreeTreeReach(content());
    const fit = fitThreeTree(reach);
    expect(fit.soilRadius).toBeCloseTo(reach.soilReach * fit.scale, 6);
  });

  it('never divides by zero on a degenerate tree', () => {
    const fit = fitThreeTree({ minY: 0, maxY: 0, crownReach: 0, soilReach: 0 });
    expect(Number.isFinite(fit.scale)).toBe(true);
    expect(Number.isFinite(fit.height)).toBe(true);
    expect(fit.crownRadius).toBe(0);
  });
});
