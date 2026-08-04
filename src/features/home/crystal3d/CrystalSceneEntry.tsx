import { lazy, Suspense, useState } from 'react';
import type { HomeArtifact } from '../homeArtifact';
import { CrystalPlaceholder } from '../CrystalPlaceholder';
import EvolutionCrystalPreviewScene from './evolution/EvolutionCrystalPreviewScene';
import { isTreeLabPreviewEnabled } from './treeLab/featureFlag';

const TreeLabPreviewScene = lazy(() => import('./treeLab/TreeLabPreviewScene'));
// Дерево в порталі — те, що бачить пара. Лабораторія лишається за прапорцем:
// у ній видно бюджети, приймальний статус і джерело даних, і викидати цей
// інструмент разом із рамкою було б втратою.
const EvolutionTreePreviewScene = lazy(() => import('./evolution/EvolutionTreePreviewScene'));

type RenderableHomeArtifact = Exclude<HomeArtifact, 'reef'>;

interface CrystalSceneEntryProps {
  artifact: RenderableHomeArtifact;
}

// Тут стояв TreePortalPreviewScene — обгортка, яка дописувала в адресний
// рядок `treeSource=portal&treeLod=medium` і показувала ту саму лабораторію.
// Дерево більше не живе в рамці, тож підміняти параметри нема заради чого.

/**
 * Показує прийнятий конвеєр для вибраного артефакта.
 *
 * `artifact` став обов'язковим, і разом із ним пішли дві гілки: «старий
 * рендерер за замовчуванням» і прапорець `engine=evolution`. Обидві були
 * недосяжні — єдиний, хто монтує цей вхід, це HomePage, а `resolveHomeArtifact`
 * завжди повертає конкретний артефакт, ніколи undefined. Недосяжність коштувала
 * не нуль: статичний імпорт старої сцени тягнув у чанк головної весь її окремий
 * конвеєр — кластери, батчинг, публікацію, bloom. Аварійний фолбек на неї
 * лишився, але лінивий, у EvolutionCrystalPreviewScene.
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

  return <EvolutionCrystalPreviewScene />;
}
