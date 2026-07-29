import { useState } from 'react';
import LegacyCrystalScene from './CrystalScene';
import EvolutionCrystalPreviewScene from './evolution/EvolutionCrystalPreviewScene';
import { isEvolutionRendererPreviewEnabled } from './evolution/featureFlag';

/**
 * The production path stays legacy by default. New queries and the Phase 1-6
 * pipeline are mounted only for the explicit `?engine=evolution` preview.
 */
export default function CrystalSceneEntry() {
  const [evolutionPreview] = useState(() =>
    isEvolutionRendererPreviewEnabled(
      typeof window === 'undefined' ? '' : window.location.search,
    ),
  );

  return evolutionPreview ? <EvolutionCrystalPreviewScene /> : <LegacyCrystalScene />;
}
