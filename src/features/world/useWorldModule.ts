import { useArtifactWorld } from './artifactWorldContext';
import { useDimmedWorld } from './worldDim';
import { useWorldVisibleRoute } from './useWorldVisibleRoute';

/**
 * Модуль, крізь який видно світ (ADR-0215).
 *
 * Власник: «загальний стан порталу треба адаптувати на один лад, всі модулі
 * мають просвітлятись, як це адаптовано у вішлисті й планах, окрім гри».
 *
 * Вішліст, плани й покупки робили це трьома рядками кожен — видимість світу,
 * приглушена сцена й ознака WebGL, — і кожен новий модуль мусив би
 * повторити всі три. Один хук робить трійку однією: модуль, який забуде
 * приглушити сцену, лишився б із яскравим кристалом під списком.
 *
 * Повертає, чи сцена справді є: без WebGL модуль бере ті самі токени, але
 * без скла — прозорість над порожнечею читається як недомальована сторінка.
 */
export function useWorldModule(): boolean {
  const { webglSupported } = useArtifactWorld();
  useWorldVisibleRoute();
  useDimmedWorld(webglSupported);
  return webglSupported;
}
