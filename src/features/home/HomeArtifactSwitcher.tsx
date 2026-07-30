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
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 19c1.8-1.2 2.6-3 2.6-5.4V8.8M7.6 12c-1.7 0-3-.7-3.8-2M7.6 10c1.8 0 3.1-.8 4-2.3M12 19c0-3.5.8-6 2.5-7.6M14.2 12.2c1.9.1 3.4-.6 4.5-2.1M14.2 14.2c-1.7.1-3 .9-3.8 2.4M19 19c-.7-2.4-.5-4.5.6-6.3" />
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
