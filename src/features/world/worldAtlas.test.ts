import { describe, expect, it } from 'vitest';
import {
  PORTAL_GROUND_Y,
  PORTAL_TARGET_SHARE_OF_ARTIFACT,
  portalCameraFrame,
  portalCameraView,
} from '@/features/home/crystal3d/scene/portalScene';
import { CRYSTAL_CENTRE_POSE, crystalPoseForRegion } from './crystalAtlas';
import {
  WORLD_REGIONS,
  normalizeWorldPath,
  worldRegionForRoute,
  type WorldRegion,
} from './worldRegions';

// ============================================================
// The route atlas — Crystal World brief §20–§21, phase 3.
// ------------------------------------------------------------
// What these hold is the property the brief actually asks for: the mapping is
// *deterministic and stable*, because it exists so a couple can slowly learn
// where things are. A pose the owner retunes is fine; a pose that moves on its
// own is the failure.
// ============================================================

/**
 * Every authenticated route the router serves a *page* for, from
 * `app/routes.tsx`.
 *
 * `/calendar` is no longer among them: the owner merged Calendar into Plans
 * ("об'єднати плани і календар"), and the address now redirects. A redirect has
 * no region of its own — it has arrived somewhere else before the camera is
 * asked anything.
 */
const ROUTES = [
  '/',
  '/wishlist',
  '/plans',
  '/plans/42',
  '/shopping',
  '/memories',
  '/schedule',
  '/media',
  '/piggybank',
  '/culinary',
  '/whereto',
  '/map',
  '/game',
] as const;

describe('route → region (brief §20)', () => {
  it('answers the same for the same route, every time', () => {
    // The whole reason the atlas exists: "Navigation should NOT choose a
    // random face every time. The user should slowly build spatial memory."
    for (const route of ROUTES) {
      const first = worldRegionForRoute(route);
      for (let repeat = 0; repeat < 5; repeat += 1) {
        expect(worldRegionForRoute(route), route).toBe(first);
      }
    }
  });

  it('gives every route a region, and no two modules the same one', () => {
    const seen = new Map<WorldRegion, string>();
    for (const route of ROUTES) {
      const region = worldRegionForRoute(route);
      expect(WORLD_REGIONS, route).toContain(region);
      // `/plans/:id` shares its parent's region on purpose — a detail is a
      // closer look at the same place, not a different one.
      if (route.startsWith('/plans')) continue;
      expect(seen.has(region), `${route} reuses ${seen.get(region) ?? ''}`).toBe(false);
      seen.set(region, route);
    }
  });

  it('keeps a nested route in its parent’s place', () => {
    expect(worldRegionForRoute('/plans/42')).toBe(worldRegionForRoute('/plans'));
    expect(worldRegionForRoute('/plans/42/edit')).toBe(worldRegionForRoute('/plans'));
  });

  it('reads a deep link the same as a walked-to route', () => {
    // §25: opening `/calendar` directly must produce the Calendar world state.
    // The atlas is a pure function of the path, so this is true by
    // construction — and stated, because the next layer must not be tempted to
    // make it depend on where the couple came from.
    for (const route of ROUTES) {
      expect(worldRegionForRoute(route), route).toBe(worldRegionForRoute(`${route}?from=push`));
    }
  });

  it('survives the shapes a hash router actually produces', () => {
    expect(normalizeWorldPath('#/calendar')).toBe('/calendar');
    expect(normalizeWorldPath('/calendar/')).toBe('/calendar');
    expect(normalizeWorldPath('/calendar?tab=1')).toBe('/calendar');
    expect(normalizeWorldPath('')).toBe('/');
    expect(worldRegionForRoute('#/shopping')).toBe(worldRegionForRoute('/shopping'));
  });

  it('sends an unknown path to the centre rather than guessing', () => {
    // The router already redirects unknown routes home; landing the camera
    // somewhere else would mean the world briefly claimed to be a place the
    // couple never went.
    expect(worldRegionForRoute('/nonsense')).toBe('centre');
  });
});

describe('region → crystal pose (brief §21)', () => {
  it('answers every region the shared layer can ask for', () => {
    // The two halves are separate files so a second artifact can replace one
    // of them. That only works if the artifact half is total.
    for (const region of WORLD_REGIONS) {
      expect(crystalPoseForRegion(region), region).toBeDefined();
    }
  });

  it('keeps every pose finite and inside its own frame', () => {
    for (const region of WORLD_REGIONS) {
      const pose = crystalPoseForRegion(region);
      for (const [key, value] of Object.entries(pose)) {
        expect(Number.isFinite(value), `${region}.${key}`).toBe(true);
      }
      // Looking at the artifact, not past its ends.
      expect(pose.targetHeight, region).toBeGreaterThan(0);
      expect(pose.targetHeight, region).toBeLessThan(1);
      // Never inside the body, never so far the artifact stops being the
      // subject — except where the brief says it should withdraw.
      expect(pose.distance, region).toBeGreaterThan(0.5);
      expect(pose.distance, region).toBeLessThanOrEqual(1.8);
      expect(pose.luminosity, region).toBeGreaterThan(0);
      expect(pose.luminosity, region).toBeLessThanOrEqual(1);
    }
  });

  it('puts Home at the plain full view', () => {
    expect(crystalPoseForRegion('centre')).toEqual(CRYSTAL_CENTRE_POSE);
    expect(CRYSTAL_CENTRE_POSE.azimuth).toBe(0);
    expect(CRYSTAL_CENTRE_POSE.distance).toBe(1);
  });

  it('spreads the regions far enough apart to be remembered', () => {
    // Spatial memory needs the places to be distinguishable. Two modules a few
    // degrees apart would read as the same view and the atlas would be
    // decoration.
    const bearings = WORLD_REGIONS.map((region) => ({
      region,
      azimuth: crystalPoseForRegion(region).azimuth,
    }));
    for (const a of bearings) {
      for (const b of bearings) {
        if (a.region === b.region) continue;
        const apart = Math.abs(
          Math.atan2(Math.sin(a.azimuth - b.azimuth), Math.cos(a.azimuth - b.azimuth)),
        );
        const pull = Math.abs(
          crystalPoseForRegion(a.region).targetHeight
          - crystalPoseForRegion(b.region).targetHeight,
        );
        // Either a real turn, or a real climb. Two views that share both would
        // be the same view.
        expect(apart > 0.25 || pull > 0.1, `${a.region} vs ${b.region}`).toBe(true);
      }
    }
  });

  it('steps the three near modules a quarter of a quarter apart', () => {
    // CHANGED REQUIREMENT, and the owner changed it. This used to hold §21's
    // "transition between Calendar and Schedule should be spatially short" —
    // but Calendar is no longer a module, so the pair that rule protected does
    // not exist any more.
    //
    // What replaced it is the owner's own words about the near arc: "при
    // переході на плани кристал робить оберт на 45 градусів замість 90 як це
    // було в Вішлисті. При переході з планів на вішлист оберт робиться знову
    // таки на 45 градусів."
    //
    // So the requirement now is a rhythm rather than a pair: equal steps, one
    // direction. The three routes the couple uses daily sit on one arc.
    const home = crystalPoseForRegion(worldRegionForRoute('/'));
    const plans = crystalPoseForRegion(worldRegionForRoute('/plans'));
    const wishlist = crystalPoseForRegion(worldRegionForRoute('/wishlist'));
    const quarter = Math.PI / 2;

    expect(home.azimuth).toBe(0);
    expect(plans.azimuth).toBeCloseTo(quarter / 2, 10);
    expect(wishlist.azimuth).toBeCloseTo(quarter, 10);
    // Equal steps, and both the same way round: a couple learning where things
    // are learns one rhythm, not a set of exceptions.
    expect(plans.azimuth - home.azimuth).toBeCloseTo(wishlist.azimuth - plans.azimuth, 10);
  });

  it('mirrors Shopping and Plans around Home', () => {
    // ЗМІНЕНА ВИМОГА, і змінив її власник: «модуль покупки… кристал на фоні
    // обертається на 45 градусів зліва на право», тоді як плани повертають
    // камінь у інший бік. Тобто порядок у доку — вішліст, плани, головна,
    // покупки — це і порядок навколо артефакта.
    //
    // Тест існує саме тому, що до цього Покупки ділили азимут із вішлістом і
    // ніхто цього не помічав: без перевірки наступна правка атласу мовчки
    // зсуне те, що власник щойно попросив.
    const home = crystalPoseForRegion(worldRegionForRoute('/'));
    const plans = crystalPoseForRegion(worldRegionForRoute('/plans'));
    const shopping = crystalPoseForRegion(worldRegionForRoute('/shopping'));

    expect(home.azimuth).toBe(0);
    expect(shopping.azimuth).toBeCloseTo(-plans.azimuth, 10);
    // І це саме чверть чверті в обидва боки, а не будь-яке дзеркало.
    expect(Math.abs(shopping.azimuth)).toBeCloseTo(Math.PI / 4, 10);
  });

  it('keeps every elevation a sine, not a height', () => {
    // The unit matters and was got wrong once: `elevation` is the sine of the
    // angle the eye stands at, so |value| < 1 or the camera is asked to stand
    // further above the target than the distance to it.
    for (const region of WORLD_REGIONS) {
      expect(Math.abs(crystalPoseForRegion(region).elevation), region).toBeLessThan(1);
    }
  });

  it('lets the map withdraw, and nothing else', () => {
    // §40: on the map, usability wins over immersion — the crystal becomes
    // context. That is the one region allowed to stop being the subject, and
    // saying so here stops the next region from quietly borrowing the excuse.
    const external = crystalPoseForRegion('external');
    expect(external.distance).toBeGreaterThan(1.5);
    for (const region of WORLD_REGIONS) {
      if (region === 'external') continue;
      expect(crystalPoseForRegion(region).distance, region).toBeLessThan(1.5);
    }
  });
});

describe('pose → camera (brief §21)', () => {
  // Real frames: a portrait phone and a wide screen, a young artifact and a
  // grown one. The pose has to hold on all of them, because framing is solved
  // per aspect and the atlas only turns the camera afterwards.
  const FRAMES = [
    { name: 'phone, young', frame: portalCameraFrame(0.46, 0.9, 1.6) },
    { name: 'phone, grown', frame: portalCameraFrame(0.46, 1.6, 4.2) },
    { name: 'wide, grown', frame: portalCameraFrame(1.9, 1.6, 4.2) },
  ];

  it('leaves Home exactly where the frame put it', () => {
    // The regression this file exists for. `elevation` was briefly a share of
    // the artifact's *height* while the frame raises the eye by a share of the
    // *distance* — the same 0.14, a different unit, and Home's camera would
    // have dropped the day the atlas landed. Phase 3 must move nothing on
    // Home; the centre pose is a no-op or it is a bug.
    for (const { name, frame } of FRAMES) {
      const view = portalCameraView(frame, CRYSTAL_CENTRE_POSE);
      expect(view.position[0], name).toBeCloseTo(frame.position[0], 9);
      expect(view.position[1], name).toBeCloseTo(frame.position[1], 9);
      expect(view.position[2], name).toBeCloseTo(frame.position[2], 9);
      expect(view.target[1], name).toBeCloseTo(frame.target[1], 9);
    }
  });

  it('states the centre pose in the frame’s own units', () => {
    // Stated rather than implied: if the frame ever retunes where it aims, the
    // centre pose has to follow it in the same commit.
    expect(CRYSTAL_CENTRE_POSE.targetHeight).toBe(PORTAL_TARGET_SHARE_OF_ARTIFACT);
  });

  it('holds the eye at the requested distance, whatever the bearing', () => {
    for (const { name, frame } of FRAMES) {
      for (const region of WORLD_REGIONS) {
        const pose = crystalPoseForRegion(region);
        const view = portalCameraView(frame, pose);
        const eye = Math.hypot(
          view.position[0] - view.target[0],
          view.position[1] - view.target[1],
          view.position[2] - view.target[2],
        );
        expect(eye, `${name}/${region}`).toBeCloseTo(frame.distance * pose.distance, 6);
      }
    }
  });

  it('never puts the eye under the ground it stands on', () => {
    // OrbitControls refuses to dive below the floor (`maxPolarAngle`); a pose
    // that starts there would fight it every frame. The floor is
    // PORTAL_GROUND_Y, not zero — the scene's origin sits at the artifact's
    // waist, and measuring from the world origin instead of the body's own
    // ground is the error this project keeps making.
    for (const { name, frame } of FRAMES) {
      for (const region of WORLD_REGIONS) {
        const view = portalCameraView(frame, crystalPoseForRegion(region));
        expect(view.position[1], `${name}/${region}`).toBeGreaterThan(PORTAL_GROUND_Y);
        expect(view.target[1], `${name}/${region}`).toBeGreaterThan(PORTAL_GROUND_Y);
      }
    }
  });

  it('turns the camera without moving the artifact', () => {
    // The atlas is allowed to change the *view*; the artifact stands where the
    // engine published it. The aim point may only rise and fall along the
    // body's own axis.
    const { frame } = FRAMES[2]!;
    for (const region of WORLD_REGIONS) {
      const view = portalCameraView(frame, crystalPoseForRegion(region));
      expect(view.target[0], region).toBeCloseTo(frame.target[0], 9);
      expect(view.target[2], region).toBeCloseTo(frame.target[2], 9);
    }
  });
});
