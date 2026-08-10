import { useEffect } from 'react';

/**
 * Marks the document while a route lets the world show through it.
 *
 * The marker exists because page chrome lives outside any page: the bottom
 * navigation is a sibling of `<Outlet/>`, so a token override on a section
 * cannot reach it, and it stayed a white pill over a night scene. A root-level
 * attribute is the smallest thing that lets the chrome follow the world without
 * every page growing a theme prop.
 *
 * **It belongs to the route, not to the backdrop.** It used to be set by
 * `PortalBackdrop`, which was fine while the backdrop was mounted only by Home.
 * Once the world outlives the route (ADR-0020) the backdrop is always mounted,
 * so the marker would have been on everywhere — and a dark dock under a white
 * shopping list is precisely the discontinuity this work exists to remove, not
 * to spread. Phase 2 opts the modules in deliberately, as their surfaces turn.
 */
export function useWorldVisibleRoute(): void {
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-portal-scene', 'true');
    return () => root.removeAttribute('data-portal-scene');
  }, []);
}
