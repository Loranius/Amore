import type { HomeArtifact } from './homeArtifact';
import { HOME_ARTIFACT_LABELS } from './homeArtifact';
import './homeArtifactSwitcher.css';

const ARTIFACTS: readonly HomeArtifact[] = ['crystal', 'tree', 'reef'];

function ArtifactIcon({ artifact }: { artifact: HomeArtifact }) {
  if (artifact === 'tree') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3 7.2 9h2.6L6.8 14h3.5v5h3.4v-5h3.5l-3-5h2.6L12 3Z" />
      </svg>
    );
  }

  if (artifact === 'reef') {
    // Підводний вулкан (ADR-0235): конус, кратер і струмінь жару.
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3.5 20h17l-5.2-9.2h-1.7L12 12.6l-1.6-1.8H8.7L3.5 20Z" />
        <path d="M12 8.6c-.9-1.2-.6-2.4.3-3.3.8-.8.9-1.7.5-2.5M9.4 7.4c-.6-.6-.8-1.3-.5-2M14.8 7.2c.5-.5.7-1.2.5-1.9" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m12 3 6.5 5-2.4 9.2L12 21l-4.1-3.8L5.5 8 12 3Z" />
      <path d="m5.8 8.2 4.1 1.5L12 3m6.2 5.2-4.1 1.5L12 3m-2.1 6.7L12 21l2.1-11.3" />
    </svg>
  );
}

interface HomeArtifactSwitcherProps {
  value: HomeArtifact;
  onChange: (artifact: HomeArtifact) => void;
}

export function HomeArtifactSwitcher({ value, onChange }: HomeArtifactSwitcherProps) {
  return (
    <div
      className="home-artifact-switcher"
      role="tablist"
      aria-label="Об’єкт на головній сторінці"
      data-home-artifact-switcher="ready"
    >
      {ARTIFACTS.map((artifact) => {
        const selected = artifact === value;
        const label = HOME_ARTIFACT_LABELS[artifact];
        return (
          <button
            key={artifact}
            type="button"
            role="tab"
            aria-label={artifact === 'reef' ? `${label} — ще в розробці` : label}
            aria-selected={selected}
            aria-controls="home-artifact-preview"
            className={`home-artifact-option${selected ? ' home-artifact-option--active' : ''}`}
            data-home-artifact-option={artifact}
            data-home-artifact-pending={artifact === 'reef' ? 'true' : 'false'}
            onClick={() => onChange(artifact)}
          >
            <span className="home-artifact-option-icon">
              <ArtifactIcon artifact={artifact} />
            </span>
            <span>{label}</span>
            {artifact === 'reef' && <span className="home-artifact-option-dot" aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}
