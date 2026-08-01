import { useMemo, useState } from 'react';
import type { GodotDeviceAcceptanceReport } from './godotDeviceAcceptance';

interface GodotDeviceAcceptancePanelProps {
  report: GodotDeviceAcceptanceReport;
}

const CRITERIA_LABELS: Record<keyof GodotDeviceAcceptanceReport['criteria'], string> = {
  runtimeAccepted: 'Portal runtime accepted',
  stableThirtySecondWindow: '30 telemetry samples',
  healthyRuntime: 'Runtime health stable',
  orbitCompleted: 'Orbit gesture completed',
  backgroundRestoreCompleted: 'Background restore completed',
  deterministicSignaturePresent: 'Deterministic signature present',
  motionProfileCaptured: 'Motion profile captured',
};

export function GodotDeviceAcceptancePanel({ report }: GodotDeviceAcceptancePanelProps) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const reportJson = useMemo(() => JSON.stringify(report, null, 2), [report]);

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(reportJson);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('failed');
    }
  };

  const saveReport = () => {
    const blob = new Blob([reportJson], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `amore-godot-device-${report.generatedAt.replaceAll(':', '-')}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <aside
      className="godot-device-acceptance"
      data-godot-device-acceptance="phase-13"
      data-godot-acceptance-passed={String(report.passed)}
      data-godot-health-status={report.health.status}
      data-godot-health-reason={report.health.reason}
      data-godot-health-samples={report.health.sampleCount}
      data-godot-health-average-fps={report.health.averageFps.toFixed(2)}
      data-godot-health-minimum-fps={report.health.minimumFps.toFixed(2)}
      data-godot-health-p95-frame-ms={report.health.p95FrameMs.toFixed(2)}
      data-godot-health-max-memory-mb={report.health.maxStaticMemoryMb.toFixed(2)}
      data-godot-acceptance-orbits={report.interactions.orbit}
      data-godot-acceptance-restores={report.health.restores}
      aria-label="Godot physical device acceptance console"
    >
      <div className="godot-device-acceptance__heading">
        <div>
          <span className="godot-device-acceptance__eyebrow">Crystal Phase 13</span>
          <strong>Physical device acceptance</strong>
        </div>
        <span
          className="godot-device-acceptance__verdict"
          data-status={report.passed ? 'passed' : report.health.status}
        >
          {report.passed ? 'PASS' : report.health.status.toUpperCase()}
        </span>
      </div>

      <div className="godot-device-acceptance__metrics">
        <span><b>{report.health.sampleCount}</b> samples</span>
        <span><b>{report.health.averageFps.toFixed(1)}</b> avg FPS</span>
        <span><b>{report.health.minimumFps.toFixed(1)}</b> min FPS</span>
        <span><b>{report.health.p95FrameMs.toFixed(1)}</b> p95 ms</span>
        <span><b>{report.health.maxStaticMemoryMb.toFixed(1)}</b> MiB</span>
        <span><b>{report.interactions.orbit}</b> orbit</span>
        <span><b>{report.health.restores}</b> restore</span>
        <span><b>{report.runtime.quality}</b> quality</span>
      </div>

      <div className="godot-device-acceptance__criteria">
        {Object.entries(report.criteria).map(([key, passed]) => (
          <span key={key} data-passed={String(passed)}>
            <i aria-hidden="true">{passed ? '✓' : '·'}</i>
            {CRITERIA_LABELS[key as keyof typeof CRITERIA_LABELS]}
          </span>
        ))}
      </div>

      <div className="godot-device-acceptance__actions">
        <button type="button" onClick={copyReport}>
          {copyStatus === 'copied'
            ? 'Звіт скопійовано'
            : copyStatus === 'failed'
              ? 'Копіювання недоступне'
              : 'Копіювати JSON'}
        </button>
        <button type="button" onClick={saveReport}>Зберегти JSON</button>
      </div>

      <small>{report.privacy}</small>
      <output hidden data-godot-acceptance-report>{reportJson}</output>
    </aside>
  );
}

export default GodotDeviceAcceptancePanel;
