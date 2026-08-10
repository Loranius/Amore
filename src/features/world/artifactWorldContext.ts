import { createContext, useContext } from 'react';
import type { HomeArtifact } from '../home/homeArtifact';

// Тут жив канал «модуль каже світу, що показувати»: вішліст віддавав свої
// бажання, а сцена малювала їх тілами навколо монарха. Канал прибрано разом
// із тими тілами — вішліст отримав власний presentation layer (сфери), і
// тепер сцена монарха є для нього фоном, а не виконавцем. Коли якийсь модуль
// справді попросить світ щось намалювати, канал з'явиться під ту вимогу, а не
// під спогад про цю.

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
