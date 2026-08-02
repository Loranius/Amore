import { describe, expect, it } from 'vitest';
import { isCrystalTap, TAP_MAX_MS, TAP_SLOP_PX } from './tapGesture';

describe('crystal tap gesture', () => {
  it('opens a memory on a still tap', () => {
    expect(isCrystalTap({ x: 100, y: 200, at: 0 }, { x: 102, y: 199, at: 120 })).toBe(true);
  });

  it('does not open a memory when the pointer was dragged', () => {
    // The regression this exists for: the scene now fills the screen, so the
    // orbit gesture starts on the crystal itself. Without a slop threshold
    // every attempt to turn the artifact opened a random memory instead.
    expect(isCrystalTap(
      { x: 100, y: 200, at: 0 },
      { x: 100 + TAP_SLOP_PX + 1, y: 200, at: 120 },
    )).toBe(false);
  });

  it('does not open a memory on a long press', () => {
    expect(isCrystalTap({ x: 100, y: 200, at: 0 }, { x: 100, y: 200, at: TAP_MAX_MS + 1 })).toBe(false);
  });

  it('measures movement in both axes, not just one', () => {
    const diagonal = TAP_SLOP_PX * 0.8;
    expect(isCrystalTap(
      { x: 0, y: 0, at: 0 },
      { x: diagonal, y: diagonal, at: 50 },
    )).toBe(false);
  });

  it('ignores a click with no matching press', () => {
    // Pointer capture can be lost mid-gesture; a click without its own press
    // is not a tap on the artifact.
    expect(isCrystalTap(null, { x: 0, y: 0, at: 10 })).toBe(false);
  });
});
