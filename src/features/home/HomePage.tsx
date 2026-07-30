// ============================================================
// HomePage — головна: Hero + вибраний Evolution-об’єкт
// ------------------------------------------------------------
// Кристал і Дерево показують нові accepted renderer pipelines. Риф має
// чесний зарезервований preview-slot до появи Reef Species/Geometry.
// Вибір живе в URL + localStorage, тому його можна порівнювати без переходів
// між технічними query-preview сторінками.
// ============================================================
import { lazy, Suspense, useCallback, useState } from 'react';
import { Hero } from './Hero';
import { Crystal } from './Crystal';
import { CrystalPlaceholder } from './CrystalPlaceholder';
import { HomePlansCard } from './HomePlansCard';
import { HomeArtifactSwitcher } from './HomeArtifactSwitcher';
import {
  HomeArtifactWebglFallback,
  ReefPreviewPlaceholder,
} from './HomeArtifactPreviewFallback';
import {
  HOME_ARTIFACT_LABELS,
  HOME_ARTIFACT_STORAGE_KEY,
  resolveHomeArtifact,
  withHomeArtifactSearch,
  type HomeArtifact,
} from './homeArtifact';
import { CrystalErrorBoundary } from './crystal3d/CrystalErrorBoundary';
import { useWebglSupport } from './crystal3d/useWebglSupport';
import { PortalDecor } from '@/features/auth/PortalDecor';

const CrystalScene = lazy(() => import('./crystal3d/CrystalSceneEntry'));

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

export function HomePage() {
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

  const rendererFallback = artifact === 'crystal'
    ? <Crystal />
    : <HomeArtifactWebglFallback artifact="tree" />;

  return (
    <section className="home" data-home-artifact={artifact}>
      <PortalDecor density="light" parallax={false} />
      <Hero />
      <HomeArtifactSwitcher value={artifact} onChange={selectArtifact} />
      <h1 className="home-title">{HOME_ARTIFACT_LABELS[artifact]} Amore</h1>
      <div id="home-artifact-preview" style={{ width: '100%' }}>
        {artifact === 'reef' ? (
          <ReefPreviewPlaceholder />
        ) : webglSupported ? (
          <CrystalErrorBoundary key={artifact} fallback={rendererFallback}>
            <Suspense fallback={<CrystalPlaceholder />}>
              <CrystalScene key={artifact} artifact={artifact} />
            </Suspense>
          </CrystalErrorBoundary>
        ) : rendererFallback}
      </div>
      <HomePlansCard />
    </section>
  );
}
