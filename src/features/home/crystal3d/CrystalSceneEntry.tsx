import { lazy, Suspense, useState } from 'react';
import { CrystalPlaceholder } from '../CrystalPlaceholder';
import LegacyCrystalScene from './CrystalScene';
import EvolutionCrystalPreviewScene from './evolution/EvolutionCrystalPreviewScene';
import { isEvolutionRendererPreviewEnabled } from './evolution/featureFlag';
import { isTreeLabPreviewEnabled } from './treeLab/featureFlag';

const TreeLabPreviewScene = lazy(() => import('./treeLab/TreeLabPreviewScene'));

/**
 * Production stays on the legacy renderer. Evolution and Tree Lab are isolated,
 * explicit previews and never replace Home without a query flag.
 */
export default function CrystalSceneEntry() {
  const [search] = useState(
    () => typeof window === 'undefined' ? '' : window.location.search,
  );

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
