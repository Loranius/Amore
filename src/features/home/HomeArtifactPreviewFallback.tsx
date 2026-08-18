import type { HomeArtifact } from './homeArtifact';
import './homeArtifactSwitcher.css';

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
