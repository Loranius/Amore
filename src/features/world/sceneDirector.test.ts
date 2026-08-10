import { describe, expect, it } from 'vitest';
import {
  portalCameraFrame,
  portalCameraTurn,
  portalCameraView,
} from '@/features/home/crystal3d/scene/portalScene';
import { CRYSTAL_CENTRE_POSE, crystalPoseForRegion } from './crystalAtlas';
import {
  advanceSceneDirector,
  createSceneDirector,
  effectiveMotionMode,
  sceneDirectorPose,
  shortestTurn,
  type SceneDirectorState,
  type WorldMotionMode,
} from './sceneDirector';
import type { WorldCameraPose } from './crystalAtlas';

// ============================================================
// The Scene Director — Crystal World brief §22–§27, phase 4.
// ------------------------------------------------------------
// These hold the four behaviours the brief names as failures rather than the
// shape of the animation: do not snap, do not stack, do not break orientation,
// do not depend on having visited Home. The easing curve is the owner's taste;
// these are the properties that make it safe to retune.
// ============================================================

const FRAME_MS = 1 / 60;

/** Runs the director for `seconds` at 60 fps and returns the final state. */
function run(
  state: SceneDirectorState,
  target: WorldCameraPose,
  seconds: number,
  mode: Exclude<WorldMotionMode, 'navigation'> = 'idle',
): SceneDirectorState {
  let next = state;
  for (let t = 0; t < seconds; t += FRAME_MS) {
    next = advanceSceneDirector(next, { target, mode, dt: FRAME_MS });
  }
  return next;
}

const CROWN = crystalPoseForRegion('aspiration');
const SHOP = crystalPoseForRegion('provision');
const MAP = crystalPoseForRegion('external');

describe('deep links (brief §25)', () => {
  it('starts standing at the destination, not travelling to it', () => {
    // Opening /calendar cold must *be* the Calendar world. A director that
    // began at the centre and flew there would show every couple a journey
    // they never took, every time they opened a notification.
    const state = createSceneDirector(MAP);
    expect(state.travelling).toBe(false);
    expect(sceneDirectorPose(state)).toEqual(MAP);
  });
});

describe('travel (brief §22)', () => {
  it('arrives, and stops claiming to be moving', () => {
    // An exponential approach never mathematically arrives; without a settle
    // floor the world would report itself in transit forever and its idle
    // motion would never come back.
    const settled = run(createSceneDirector(CRYSTAL_CENTRE_POSE), CROWN, 2.5);
    expect(settled.travelling).toBe(false);
    // Against `base`, not the composed pose: once arrived, the world starts
    // breathing again, and the breath is a feature rather than a miss.
    expect(settled.base.azimuth).toBeCloseTo(CROWN.azimuth, 9);
    expect(settled.base.distance).toBeCloseTo(CROWN.distance, 9);
  });

  it('moves most of the way in about a second, and none of it instantly', () => {
    // Restrained, per §41's "smooth, interruptible and restrained" — the point
    // is that neither a jump nor a three-second slide passes this.
    const start = createSceneDirector(CRYSTAL_CENTRE_POSE);
    const oneFrame = run(start, MAP, FRAME_MS * 1.5);
    const covered = (oneFrame.base.distance - CRYSTAL_CENTRE_POSE.distance)
      / (MAP.distance - CRYSTAL_CENTRE_POSE.distance);
    expect(covered).toBeGreaterThan(0);
    expect(covered).toBeLessThan(0.1);

    const second = run(start, MAP, 1);
    const far = (second.base.distance - CRYSTAL_CENTRE_POSE.distance)
      / (MAP.distance - CRYSTAL_CENTRE_POSE.distance);
    expect(far).toBeGreaterThan(0.9);
  });

  it('turns the short way round', () => {
    // §24 calls this "breaking orientation". From just short of half a turn to
    // just past it, the honest path crosses π; interpolating the raw numbers
    // would sweep the camera all the way back through the front of the stone.
    const from: WorldCameraPose = { ...CRYSTAL_CENTRE_POSE, azimuth: 3.0 };
    const to: WorldCameraPose = { ...CRYSTAL_CENTRE_POSE, azimuth: -3.0 };
    const state = run(createSceneDirector(from), to, 0.1);
    // Short way is increasing past π and wrapping; the long way would drop
    // through zero.
    expect(state.base.azimuth).toBeGreaterThan(3.0);
    expect(shortestTurn(3.0, -3.0)).toBeGreaterThan(0);
  });

  it('cannot be jumped by a backgrounded tab', () => {
    // A hidden tab hands back a delta of many seconds on the frame it wakes.
    // Uncapped, that resolves the whole approach in one step — a snap arrived
    // at by way of the task switcher.
    const woken = advanceSceneDirector(createSceneDirector(CRYSTAL_CENTRE_POSE), {
      target: MAP,
      mode: 'idle',
      dt: 12,
    });
    const covered = (woken.base.distance - CRYSTAL_CENTRE_POSE.distance)
      / (MAP.distance - CRYSTAL_CENTRE_POSE.distance);
    expect(covered).toBeLessThan(0.25);
  });

  it('stays finite on nonsense input', () => {
    const state = advanceSceneDirector(createSceneDirector(CRYSTAL_CENTRE_POSE), {
      target: CROWN,
      mode: 'idle',
      dt: Number.NaN,
      drift: { azimuth: Number.NaN, elevation: Number.POSITIVE_INFINITY },
    });
    for (const value of Object.values(sceneDirectorPose(state))) {
      expect(Number.isFinite(value)).toBe(true);
    }
  });
});

describe('interruption (brief §24)', () => {
  it('retargets from where it had got to, without snapping', () => {
    // The couple taps Wishlist, then taps Shopping half a second later. The
    // brief forbids all four of: snapping, stacking, losing orientation and
    // freezing. This checks the first — the frame after the second tap is a
    // continuation of the first flight, not a jump.
    const midFlight = run(createSceneDirector(CRYSTAL_CENTRE_POSE), CROWN, 0.5);
    expect(midFlight.travelling).toBe(true);
    const before = sceneDirectorPose(midFlight);

    const afterTap = advanceSceneDirector(midFlight, {
      target: SHOP,
      mode: 'idle',
      dt: FRAME_MS,
    });
    const after = sceneDirectorPose(afterTap);
    // Measured against the distance to the *new* destination, because that is
    // what a snap would be: covering it at once. A normal exponential first
    // step is a twentieth of the way, and that is what this must stay at — an
    // implementation that restarted the flight would show up here as a jump.
    const toShop = Math.abs(shortestTurn(before.azimuth, SHOP.azimuth));
    expect(Math.abs(shortestTurn(before.azimuth, after.azimuth))).toBeLessThan(toShop * 0.06);
    expect(Math.abs(after.distance - before.distance))
      .toBeLessThan(Math.abs(SHOP.distance - before.distance) * 0.06 + 1e-3);
  });

  it('arrives at the last destination asked for, whatever the flurry', () => {
    // Stacking would show as arriving somewhere else, or arriving late. Five
    // taps in half a second, then silence.
    let state = createSceneDirector(CRYSTAL_CENTRE_POSE);
    for (const target of [CROWN, SHOP, MAP, CROWN, SHOP]) {
      state = run(state, target, 0.1);
    }
    // Four seconds, not two: the settle floor is absolute, so a long way round
    // takes longer to fall under it than a short hop. The visible movement is
    // over in about a second either way — what the extra time buys is the
    // right to assert arrival exactly.
    state = run(state, SHOP, 4);
    expect(state.travelling).toBe(false);
    expect(state.base.azimuth).toBeCloseTo(SHOP.azimuth, 9);
    expect(state.base.targetHeight).toBeCloseTo(SHOP.targetHeight, 9);
  });
});

describe('hand rotation (answers ADR-0021’s open question)', () => {
  it('keeps a turn the couple made while they stay put', () => {
    // The rig reports what the orbit controls did as drift. Standing still, it
    // must survive: overwriting it every frame is the bug this whole read-back
    // exists to avoid.
    let state = run(createSceneDirector(CRYSTAL_CENTRE_POSE), CRYSTAL_CENTRE_POSE, 0.2);
    state = advanceSceneDirector(state, {
      target: CRYSTAL_CENTRE_POSE,
      mode: 'interaction',
      dt: FRAME_MS,
      drift: { azimuth: 0.8, elevation: 0.05 },
    });
    state = run(state, CRYSTAL_CENTRE_POSE, 1.5, 'interaction');
    expect(sceneDirectorPose(state).azimuth).toBeCloseTo(CRYSTAL_CENTRE_POSE.azimuth + 0.8, 3);
  });

  it('gives the turn back to the atlas when the couple travels', () => {
    // Otherwise Wishlist would land on whichever side they had spun to, and
    // §20's spatial memory would be worth nothing.
    let state = advanceSceneDirector(createSceneDirector(CRYSTAL_CENTRE_POSE), {
      target: CRYSTAL_CENTRE_POSE,
      mode: 'idle',
      dt: FRAME_MS,
      drift: { azimuth: 1.2, elevation: 0 },
    });
    state = run(state, CROWN, 2.5);
    // Dissolved to invisibility rather than to exactly zero: the decay and the
    // travel share a settle floor, so a hand turn of 69° comes back as 0.2°.
    expect(Math.abs(state.manual.azimuth)).toBeLessThan(0.005);
    expect(state.base.azimuth).toBeCloseTo(CROWN.azimuth, 9);
  });
});

describe('motion modes (brief §26–§27)', () => {
  it('reports navigation while travelling and idle once settled', () => {
    const flying = run(createSceneDirector(CRYSTAL_CENTRE_POSE), MAP, 0.2);
    expect(effectiveMotionMode(flying, 'idle')).toBe('navigation');
    const landed = run(flying, MAP, 3);
    expect(effectiveMotionMode(landed, 'idle')).toBe('idle');
    // A finger or an open sheet outranks the camera's own business.
    expect(effectiveMotionMode(flying, 'interaction')).toBe('interaction');
    expect(effectiveMotionMode(flying, 'modal')).toBe('modal');
    expect(effectiveMotionMode(landed, 'reduced')).toBe('reduced');
  });

  it('breathes while idle, within an amplitude nobody would call an animation', () => {
    // §26 asks for alive, and immediately for "extremely controlled". Measured
    // over a full minute rather than asserted from the constants.
    let state = run(createSceneDirector(CRYSTAL_CENTRE_POSE), CRYSTAL_CENTRE_POSE, 3);
    let minAzimuth = Infinity;
    let maxAzimuth = -Infinity;
    let maxDistance = -Infinity;
    for (let t = 0; t < 60; t += FRAME_MS) {
      state = advanceSceneDirector(state, { target: CRYSTAL_CENTRE_POSE, mode: 'idle', dt: FRAME_MS });
      const pose = sceneDirectorPose(state);
      minAzimuth = Math.min(minAzimuth, pose.azimuth);
      maxAzimuth = Math.max(maxAzimuth, pose.azimuth);
      maxDistance = Math.max(maxDistance, Math.abs(pose.distance - CRYSTAL_CENTRE_POSE.distance));
    }
    expect(maxAzimuth - minAzimuth).toBeGreaterThan(0.004);
    // Under two degrees of sway, end to end.
    expect(maxAzimuth - minAzimuth).toBeLessThan(0.035);
    expect(maxDistance).toBeLessThan(0.01);
  });

  it('stops moving when the couple is doing something', () => {
    // §27: the interface must never feel like it floats over a moving ride.
    let state = run(createSceneDirector(CRYSTAL_CENTRE_POSE), CRYSTAL_CENTRE_POSE, 20);
    state = run(state, CRYSTAL_CENTRE_POSE, 4, 'interaction');
    const held = sceneDirectorPose(state);
    const later = run(state, CRYSTAL_CENTRE_POSE, 4, 'interaction');
    expect(Math.abs(sceneDirectorPose(later).azimuth - held.azimuth)).toBeLessThan(1e-4);
    expect(later.idleGain).toBeLessThan(0.01);
  });

  it('resumes the drift from where it stopped', () => {
    // The idle clock only runs while the idle shows. Otherwise a couple who
    // read a long page would come back to a camera that had silently drifted
    // to the far side of its cycle and lurched on the way back.
    let state = run(createSceneDirector(CRYSTAL_CENTRE_POSE), CRYSTAL_CENTRE_POSE, 8);
    const paused = state.clock;
    state = run(state, CRYSTAL_CENTRE_POSE, 30, 'modal');
    expect(state.clock - paused).toBeLessThan(1);
  });
});

describe('reduced motion (brief §47)', () => {
  it('changes pose at once and keeps the destination', () => {
    // "Instead of a 2-second camera orbit use an immediate pose transition" —
    // the spatial identity is preserved, only the journey is dropped.
    const state = advanceSceneDirector(createSceneDirector(CRYSTAL_CENTRE_POSE), {
      target: MAP,
      mode: 'reduced',
      dt: FRAME_MS,
    });
    expect(state.travelling).toBe(false);
    expect(sceneDirectorPose(state)).toEqual(MAP);
  });

  it('never moves on its own', () => {
    let state = createSceneDirector(CRYSTAL_CENTRE_POSE);
    const first = sceneDirectorPose(state);
    state = run(state, CRYSTAL_CENTRE_POSE, 40, 'reduced');
    expect(sceneDirectorPose(state)).toEqual(first);
  });
});

describe('reading the camera back (ADR-0022)', () => {
  it('recovers exactly the bearing and rise it was placed at', () => {
    // The director learns what a finger did by comparing where the camera is
    // with where it put it. If that read-back drifted, the director would read
    // its own rounding as a hand turn and wander off on its own.
    const frame = portalCameraFrame(0.46, 1.6, 4.2);
    for (const region of ['centre', 'aspiration', 'external', 'threshold'] as const) {
      const pose = crystalPoseForRegion(region);
      const placed = portalCameraView(frame, pose);
      const read = portalCameraTurn(placed.position, placed.target);
      expect(read.azimuth, region).toBeCloseTo(pose.azimuth, 9);
      expect(read.elevation, region).toBeCloseTo(pose.elevation, 9);
    }
  });
});
