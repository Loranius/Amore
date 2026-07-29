import { describe, expect, it } from 'vitest';
import { generateEllipsoidAttractors } from './attractors';
import { DEFAULT_ORGANIC_SKELETON_CONFIG } from './config';
import { buildOrganicSkeleton } from './spaceColonization';

const SEED = 41_992;
const ATTRACTORS = generateEllipsoidAttractors({
  seed: SEED,
  count: 18,
  center: { x: 0, y: 3.45, z: 0 },
  horizontalRadius: 1.72,
  verticalRadius: 1.18,
});

function build(attractors = ATTRACTORS) {
  return buildOrganicSkeleton({
    seed: SEED,
    attractors,
    config: DEFAULT_ORGANIC_SKELETON_CONFIG,
  });
}

describe('Tree Lab organic skeleton', () => {
  it('is deterministic and independent of attractor input order', () => {
    const forward = build();
    const reversed = build([...ATTRACTORS].reverse());

    expect(reversed).toEqual(forward);
    expect(forward.nodes.length).toBeGreaterThan(10);
  });

  it('creates one rooted tree with no orphan nodes and at most three generations', () => {
    const state = build();
    const ids = new Set(state.nodes.map((node) => node.id));
    const roots = state.nodes.filter((node) => node.parentId === null);

    expect(roots).toHaveLength(1);
    expect(roots[0]?.id).toBe('organic:trunk:0');
    expect(state.diagnostics.maxGeneration).toBeLessThanOrEqual(3);

    for (const node of state.nodes.slice(1)) {
      expect(node.parentId).not.toBeNull();
      expect(ids.has(node.parentId!)).toBe(true);
      expect(node.generation).toBeGreaterThanOrEqual(0);
      expect(node.generation).toBeLessThanOrEqual(3);
      expect(node.radius).toBeGreaterThan(0);
      expect(Math.hypot(node.direction.x, node.direction.y, node.direction.z)).toBeCloseTo(1, 5);
    }
  });

  it('keeps the skeleton inside the configured compact mobile crown', () => {
    const state = build();
    const config = DEFAULT_ORGANIC_SKELETON_CONFIG;

    for (const node of state.nodes) {
      expect(Math.hypot(node.position.x, node.position.z)).toBeLessThanOrEqual(
        config.crownRadius + 1e-6,
      );
      expect(node.position.y).toBeGreaterThanOrEqual(0);
      expect(node.position.y).toBeLessThanOrEqual(
        config.trunkHeight + config.crownHeight + 1e-6,
      );
    }
  });

  it('keeps every historical node byte-stable when later attractors are appended', () => {
    const earlierAttractors = ATTRACTORS.slice(0, 8);
    const earlier = build(earlierAttractors);
    const later = build(ATTRACTORS);

    expect(later.nodes.length).toBeGreaterThan(earlier.nodes.length);
    for (const historicalNode of earlier.nodes) {
      expect(later.nodes.find((node) => node.id === historicalNode.id)).toEqual(historicalNode);
    }
  });

  it('truncates only later growth when the node budget is reached', () => {
    const constrained = buildOrganicSkeleton({
      seed: SEED,
      attractors: ATTRACTORS,
      config: { ...DEFAULT_ORGANIC_SKELETON_CONFIG, maxNodes: 20 },
    });

    expect(constrained.nodes.length).toBeLessThanOrEqual(20);
    expect(constrained.diagnostics.truncatedAttractorIds.length).toBeGreaterThan(0);
    expect(constrained.nodes[0]?.id).toBe('organic:trunk:0');
  });
});
