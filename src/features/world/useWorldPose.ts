import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { crystalPoseForRegion, type WorldCameraPose } from './crystalAtlas';
import { worldRegionForRoute, type WorldRegion } from './worldRegions';

/**
 * Where the world should stand for the route the couple is on.
 *
 * Derived from the path and nothing else. That is what makes a deep link work
 * (§25): opening `/calendar` cold has to produce the Calendar state, and it
 * does, because there is no accumulated history for it to depend on.
 *
 * Two halves, resolved in order: the route says what it *means*, the artifact
 * says what that means for a body of its own shape (§53).
 */
export function useWorldPose(): { region: WorldRegion; pose: WorldCameraPose } {
  const { pathname } = useLocation();
  return useMemo(() => {
    const region = worldRegionForRoute(pathname);
    return { region, pose: crystalPoseForRegion(region) };
  }, [pathname]);
}
