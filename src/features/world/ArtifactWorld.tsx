// ============================================================
// ArtifactWorld — the world the couple navigates around.
// ------------------------------------------------------------
// Mounted by `Layout`, which is the parent route under `RequireAuth` and is
// therefore mounted once for the whole authenticated session. That is the whole
// point: the WebGL context, its warmed shaders and the published artifact all
// survive a route change, so walking from Home to the shopping list and back is
// movement inside one place rather than two page loads (ADR-0020).
//
// It sits *behind* the application's content and *outside* its scroll
// container. Both deliberate: the scene must not travel with a shopping list,
// and must not catch its scroll.
// ============================================================
import { lazy, Suspense, useCallback, useMemo, useState, type ReactNode } from 'react';
import { CrystalPlaceholder } from '../home/CrystalPlaceholder';
import { CrystalErrorBoundary } from '../home/crystal3d/CrystalErrorBoundary';
import { useWebglSupport } from '../home/crystal3d/useWebglSupport';
import { HomeArtifactWebglFallback } from '../home/HomeArtifactPreviewFallback';
import { PortalBackdrop } from '../home/PortalBackdrop';
import {
  HOME_ARTIFACT_STORAGE_KEY,
  resolveHomeArtifact,
  withHomeArtifactSearch,
  type HomeArtifact,
} from '../home/homeArtifact';
import {
  ArtifactWorldContext,
  useArtifactWorld,
  type ArtifactWorldValue,
} from './artifactWorldContext';
import './artifactWorld.css';

const CrystalScene = lazy(() => import('../home/crystal3d/CrystalSceneEntry'));
const ReefScene = lazy(() => import('../home/reef3d/ReefPreviewScene'));

function storedArtifact(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(HOME_ARTIFACT_STORAGE_KEY);
  } catch {
    return null;
  }
}

function persistArtifact(artifact: HomeArtifact): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(HOME_ARTIFACT_STORAGE_KEY, artifact);
  } catch {
    // Storage may be unavailable in private or hardened browser modes.
  }
}

/**
 * Holds which artifact is alive, for everything under the shell.
 *
 * Lifted out of `HomePage` unchanged — the URL parameter still wins over the
 * stored choice, the choice is still written back to both. What changed is only
 * how long it lives: with the world outliving the route, a selection that died
 * with the page would send a couple who chose the tree back to a crystal the
 * moment they visited the shopping list.
 */
export function ArtifactWorldProvider({ children }: { children: ReactNode }) {
  const webglSupported = useWebglSupport();
  const [artifact, setArtifact] = useState<HomeArtifact>(() => resolveHomeArtifact(
    typeof window === 'undefined' ? '' : window.location.search,
    storedArtifact(),
  ));

  const selectArtifact = useCallback((next: HomeArtifact) => {
    persistArtifact(next);
    if (typeof window !== 'undefined') {
      const search = withHomeArtifactSearch(window.location.search, next);
      window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}${search}${window.location.hash}`,
      );
    }
    setArtifact(next);
  }, []);

  const value = useMemo<ArtifactWorldValue>(
    () => ({ artifact, selectArtifact, webglSupported }),
    [artifact, selectArtifact, webglSupported],
  );

  return (
    <ArtifactWorldContext.Provider value={value}>
      {children}
    </ArtifactWorldContext.Provider>
  );
}

/**
 * The scene layer.
 *
 * Split from the provider because the context has to wrap the whole shell —
 * the bottom navigation and the "More" sheet belong to the world even though
 * they are drawn over it — while the canvas stays exactly one element in
 * exactly one place.
 *
 * `aria-hidden`, and that is not an oversight. The world carries no
 * information a screen reader can use, and the brief requires the application
 * to remain fully usable without any understanding of the 3D at all (§48).
 * Everything a couple needs to read lives in the foreground.
 */
export function ArtifactWorld() {
  const { artifact, webglSupported } = useArtifactWorld();

  // Never substitute another artifact's silhouette for the selected one. If
  // WebGL is unavailable or the renderer throws, the world keeps its sky and
  // shows a neutral explanation rather than a stand-in object.
  const rendererFallback = <HomeArtifactWebglFallback artifact={artifact} />;

  return (
    <div className="artifact-world" data-artifact-world={artifact} aria-hidden="true">
      <PortalBackdrop />
      <div className="artifact-world__scene">
        {webglSupported ? (
          <CrystalErrorBoundary key={artifact} fallback={rendererFallback}>
            <Suspense fallback={<CrystalPlaceholder />}>
              {artifact === 'reef'
                ? <ReefScene />
                : <CrystalScene key={artifact} artifact={artifact} />}
            </Suspense>
          </CrystalErrorBoundary>
        ) : rendererFallback}
      </div>
    </div>
  );
}
