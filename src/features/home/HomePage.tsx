// ============================================================
// HomePage — головна: Hero над артефактом, який їй більше не належить.
// ------------------------------------------------------------
// Сцену звідси знято (ADR-0020). Вона монтується оболонкою й переживає
// зміну маршруту, а головна лишається тим, чим і має бути: нейтральним
// станом світу — місцем, куди пара повертається до центру.
//
// Тут лишились привітання, перемикач артефакта й заголовок. Перемикач
// тепер керує світом, а не володіє ним: вибір живе в
// `ArtifactWorldProvider`, інакше пара, яка обрала дерево, поверталася б
// із покупок до кристала.
//
// Порожнього місця під артефакт тут теж немає: світ фіксований на всю
// видиму область і лежить під сторінкою, тож привітання й перемикач
// лягають на нього згори — рівно так, як було до переносу.
// ============================================================
import { Hero } from './Hero';
import { HomeArtifactSwitcher } from './HomeArtifactSwitcher';
import { HOME_ARTIFACT_LABELS } from './homeArtifact';
import { useArtifactWorld } from '../world/artifactWorldContext';
import { useWorldVisibleRoute } from '../world/useWorldVisibleRoute';

export function HomePage() {
  const { artifact, selectArtifact } = useArtifactWorld();
  // Home is the one route the world shows through today, so it is the one
  // route whose chrome follows it. Phase 2 adds the rest.
  // Головна віддає дотики артефакту: кристал тут і є сторінка.
  useWorldVisibleRoute({ artifactInput: true });

  return (
    <section className="home home--world" data-home-artifact={artifact}>
      <Hero />
      <HomeArtifactSwitcher value={artifact} onChange={selectArtifact} />
      <h1 className="home-title">{HOME_ARTIFACT_LABELS[artifact]} Amore</h1>
    </section>
  );
}
