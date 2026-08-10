import { createContext, useContext } from 'react';
import type { HomeArtifact } from '../home/homeArtifact';
import type { WishSubject } from '../home/crystal3d/scene/wishCrystals';

/**
 * Що модуль показує у світі, і що робити, коли по ньому клацнули.
 *
 * Перший випадок каналу «модуль каже світу, що він показує»: вішліст віддає
 * свої бажання, світ малює їх тілами (§28), і дотик повертається назад тим
 * самим шляхом. Канал названий за вішлістом, а не узагальнений наперед — коли
 * другий модуль попросить того самого, узагальнення матиме дві точки замість
 * однієї здогадки.
 */
export interface WorldWishBoard {
  wishes: readonly WishSubject[];
  onSelect: (wishId: number) => void;
  /**
   * Бажання, аркуш якого зараз відкрито, — або `null`.
   *
   * §30 просить, щоб вибране тіло вийшло вперед, а решта відступила. Хто
   * вибраний, знає сторінка: це стан її аркуша деталей, і дублювати його в
   * сцені означало б два джерела правди про одне вікно.
   */
  focused: number | null;
}

/**
 * Which living artifact the couple is looking at, and who may change it.
 *
 * **State of the world, not of a page.** This lived in `HomePage`'s own
 * `useState`, which meant it died with the page: a couple who chose the tree
 * and walked to the shopping list came back to a crystal. Once the world
 * outlives the route (ADR-0020), the selection has to outlive it too.
 *
 * Named for the artifact rather than for the crystal on purpose. The crystal is
 * the first implementation, not the only one the shell will carry — see
 * ADR-0020 §3.
 */
export interface ArtifactWorldValue {
  artifact: HomeArtifact;
  selectArtifact: (next: HomeArtifact) => void;
  /**
   * False when the browser cannot give us a WebGL context at all.
   *
   * Published here rather than probed per page because the answer is a
   * property of the device, and probing it twice would mean two contexts
   * created just to ask the same question.
   */
  webglSupported: boolean;
  /** Дошка бажань, поки її показує маршрут. `null` — артефакт стоїть сам. */
  wishBoard: WorldWishBoard | null;
  showWishBoard: (board: WorldWishBoard | null) => void;
}

export const ArtifactWorldContext = createContext<ArtifactWorldValue | null>(null);

/**
 * Reads the world's state.
 *
 * Throws rather than returning a default. A component that asks for the world
 * outside the provider is mounted somewhere the world does not exist, and a
 * silent fallback would render a second, detached artifact — which is exactly
 * the "one canvas per module" the brief forbids outright (§55).
 */
export function useArtifactWorld(): ArtifactWorldValue {
  const value = useContext(ArtifactWorldContext);
  if (value === null) {
    throw new Error('useArtifactWorld must be used inside <ArtifactWorldProvider>.');
  }
  return value;
}
