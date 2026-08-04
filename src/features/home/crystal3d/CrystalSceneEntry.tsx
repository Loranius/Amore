import { lazy, Suspense, useState } from 'react';
import type { HomeArtifact } from '../homeArtifact';
import { CrystalPlaceholder } from '../CrystalPlaceholder';
import LegacyCrystalScene from './CrystalScene';
import EvolutionCrystalPreviewScene from './evolution/EvolutionCrystalPreviewScene';
import { isEvolutionRendererPreviewEnabled } from './evolution/featureFlag';
import { isTreeLabPreviewEnabled } from './treeLab/featureFlag';

const TreeLabPreviewScene = lazy(() => import('./treeLab/TreeLabPreviewScene'));
// Дерево в порталі — те, що бачить пара. Лабораторія лишається за прапорцем:
// у ній видно бюджети, приймальний статус і джерело даних, і викидати цей
// інструмент разом із рамкою було б втратою.
const EvolutionTreePreviewScene = lazy(() => import('./evolution/EvolutionTreePreviewScene'));

type RenderableHomeArtifact = Exclude<HomeArtifact, 'reef'>;

interface CrystalSceneEntryProps {
  artifact?: RenderableHomeArtifact;
}

// Тут стояв TreePortalPreviewScene — обгортка, яка дописувала в адресний
// рядок `treeSource=portal&treeLod=medium` і показувала ту саму лабораторію.
// Дерево більше не живе в рамці, тож підміняти параметри нема заради чого.

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
    return (
      <Suspense fallback={<CrystalPlaceholder />}>
        {isTreeLabPreviewEnabled(search)
          ? <TreeLabPreviewScene />
          : <EvolutionTreePreviewScene />}
      </Suspense>
    );
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
