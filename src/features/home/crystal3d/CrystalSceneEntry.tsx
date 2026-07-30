import { lazy, Suspense, useLayoutEffect, useState } from 'react';
import type { HomeArtifact } from '../homeArtifact';
import { CrystalPlaceholder } from '../CrystalPlaceholder';
import LegacyCrystalScene from './CrystalScene';
import EvolutionCrystalPreviewScene from './evolution/EvolutionCrystalPreviewScene';
import { isEvolutionRendererPreviewEnabled } from './evolution/featureFlag';
import { isTreeLabPreviewEnabled } from './treeLab/featureFlag';

const TreeLabPreviewScene = lazy(() => import('./treeLab/TreeLabPreviewScene'));

type RenderableHomeArtifact = Exclude<HomeArtifact, 'reef'>;

interface CrystalSceneEntryProps {
  artifact?: RenderableHomeArtifact;
}

function TreePortalPreviewScene() {
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      params.set('treeSource', 'portal');
      params.set('treeLod', 'medium');
      const search = params.toString();
      window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`,
      );
    }
    setReady(true);
  }, []);

  if (!ready) return <CrystalPlaceholder />;
  return (
    <Suspense fallback={<CrystalPlaceholder />}>
      <TreeLabPreviewScene />
    </Suspense>
  );
}

/**
 * With an explicit Home selection this entry shows the newest accepted Crystal
 * or Tree pipeline. Without one, old query-preview links and the legacy default
 * keep their previous behaviour.
 */
export default function CrystalSceneEntry({ artifact }: CrystalSceneEntryProps) {
  const [search] = useState(
    () => typeof window === 'undefined' ? '' : window.location.search,
  );

  if (artifact === 'tree') {
    return isTreeLabPreviewEnabled(search)
      ? (
          <Suspense fallback={<CrystalPlaceholder />}>
            <TreeLabPreviewScene />
          </Suspense>
        )
      : <TreePortalPreviewScene />;
  }

  if (artifact === 'crystal') return <EvolutionCrystalPreviewScene />;

  if (isTreeLabPreviewEnabled(search)) {
    return (
      <Suspense fallback={<CrystalPlaceholder />}>
        <TreeLabPreviewScene />
      </Suspense>
    );
  }

  return isEvolutionRendererPreviewEnabled(search)
    ? <EvolutionCrystalPreviewScene />
    : <LegacyCrystalScene />;
}
