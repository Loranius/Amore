import type { HomeArtifact } from './homeArtifact';
import './homeArtifactSwitcher.css';

export function ReefPreviewPlaceholder() {
  return (
    <div
      className="reef-preview-placeholder"
      data-home-artifact-preview="reef"
      data-reef-preview="pending"
      aria-label="Риф Amore завантажується"
    >
      <span className="reef-preview-wave reef-preview-wave--one" aria-hidden="true" />
      <span className="reef-preview-wave reef-preview-wave--two" aria-hidden="true" />
      <span className="reef-preview-bubble reef-preview-bubble--one" aria-hidden="true" />
      <span className="reef-preview-bubble reef-preview-bubble--two" aria-hidden="true" />
      <span className="reef-preview-bubble reef-preview-bubble--three" aria-hidden="true" />
      <div className="home-artifact-preview-message">
        <span className="home-artifact-preview-kicker">Reef Production · завантаження</span>
        <h2>Будуємо ваш риф</h2>
        <p>Portal history проходить accepted Reef Species, Geometry, Material і Life pipeline.</p>
      </div>
    </div>
  );
}

export function HomeArtifactWebglFallback({ artifact }: { artifact: HomeArtifact }) {
  const title = artifact === 'tree'
    ? 'Дерево не вдалося відкрити'
    : artifact === 'reef'
      ? 'Риф не вдалося відкрити'
      : '3D-кристал не вдалося відкрити';
  return (
    <div
      className="home-artifact-preview-fallback"
      data-home-artifact-preview={artifact}
      data-home-artifact-webgl="unavailable"
    >
      <div className="home-artifact-preview-message">
        <span className="home-artifact-preview-kicker">WebGL недоступний</span>
        <h2>{title}</h2>
        <p>На цьому пристрої браузер не надав 3D-контекст для актуального renderer.</p>
      </div>
    </div>
  );
}
