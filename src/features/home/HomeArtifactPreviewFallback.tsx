import type { HomeArtifact } from './homeArtifact';
import './homeArtifactSwitcher.css';

export function ReefPreviewPlaceholder() {
  return (
    <div
      className="reef-preview-placeholder"
      data-home-artifact-preview="reef"
      data-reef-preview="pending"
      aria-label="Риф Amore ще в розробці"
    >
      <span className="reef-preview-wave reef-preview-wave--one" aria-hidden="true" />
      <span className="reef-preview-wave reef-preview-wave--two" aria-hidden="true" />
      <span className="reef-preview-bubble reef-preview-bubble--one" aria-hidden="true" />
      <span className="reef-preview-bubble reef-preview-bubble--two" aria-hidden="true" />
      <span className="reef-preview-bubble reef-preview-bubble--three" aria-hidden="true" />
      <div className="home-artifact-preview-message">
        <span className="home-artifact-preview-kicker">Reef Species · зарезервовано</span>
        <h2>Риф ще не підключено</h2>
        <p>
          Слот уже є на головній, але тут не показується вигадана модель. Реальний риф
          з’явиться після окремих Reef Species, Geometry, Material і Life етапів.
        </p>
      </div>
    </div>
  );
}

export function HomeArtifactWebglFallback({ artifact }: { artifact: Exclude<HomeArtifact, 'reef'> }) {
  return (
    <div
      className="home-artifact-preview-fallback"
      data-home-artifact-preview={artifact}
      data-home-artifact-webgl="unavailable"
    >
      <div className="home-artifact-preview-message">
        <span className="home-artifact-preview-kicker">WebGL недоступний</span>
        <h2>{artifact === 'tree' ? 'Дерево не вдалося відкрити' : '3D-кристал не вдалося відкрити'}</h2>
        <p>На цьому пристрої браузер не надав 3D-контекст для актуального renderer.</p>
      </div>
    </div>
  );
}
