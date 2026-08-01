import type { GodotReleasePreflightSnapshot } from './godotReleaseCandidate';

interface GodotReleaseCandidatePanelProps {
  preflight: GodotReleasePreflightSnapshot;
  rollbackDrill: boolean;
}

function formatBytes(value: number): string {
  return `${(value / (1024 * 1024)).toFixed(1)} MiB`;
}

export function GodotReleaseCandidatePanel({
  preflight,
  rollbackDrill,
}: GodotReleaseCandidatePanelProps) {
  const manifest = preflight.manifest;

  return (
    <aside
      className="godot-release-candidate"
      data-godot-release-control="phase-15"
      data-godot-release-preflight={preflight.status}
      data-godot-release-preflight-reason={preflight.reason}
      data-godot-release-build-sha={manifest?.buildSha ?? ''}
      data-godot-release-assets={manifest?.assets.length ?? 0}
      data-godot-rollback-drill={String(rollbackDrill)}
      aria-label="Godot Phase 15 release candidate operations"
    >
      <div className="godot-release-candidate__heading">
        <span>Crystal Phase 15</span>
        <strong>{preflight.status.toUpperCase()}</strong>
      </div>
      <dl>
        <div><dt>Reason</dt><dd>{preflight.reason}</dd></div>
        <div><dt>Release</dt><dd>{manifest?.releaseId ?? 'pending'}</dd></div>
        <div><dt>Build</dt><dd>{manifest?.buildSha.slice(0, 12) ?? 'pending'}</dd></div>
        <div><dt>Runtime</dt><dd>{manifest?.runtimeVersion ?? '4.7.1'}</dd></div>
        <div><dt>Assets</dt><dd>{manifest ? `${manifest.assets.length} · ${formatBytes(manifest.totalBytes)}` : 'pending'}</dd></div>
        <div><dt>Rollback drill</dt><dd>{rollbackDrill ? 'active' : 'off'}</dd></div>
      </dl>
      {manifest && (
        <details>
          <summary>Artifact integrity</summary>
          {manifest.assets.map(asset => (
            <code key={asset.file}>
              {asset.file} · {asset.bytes} B · {asset.sha256.slice(0, 16)}…
            </code>
          ))}
        </details>
      )}
      <small>
        The panel contains release metadata only. Artifact DNA, Evolution Events and relationship content are excluded.
      </small>
    </aside>
  );
}

export default GodotReleaseCandidatePanel;
