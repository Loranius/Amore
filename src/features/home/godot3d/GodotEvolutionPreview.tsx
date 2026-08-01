import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { GodotCutoverFailure } from './godotCutoverPolicy';
import { GODOT_EVOLUTION_ENABLED } from './godotFeatureFlag';
import {
  createGodotPayloadMessage,
  isGodotBridgeInboundMessage,
  isGodotRuntimeStateAccepted,
  resolveGodotWebUrl,
  type GodotBridgeInboundMessage,
  type GodotEvolutionPayload,
  type GodotLifecycleMessage,
  type GodotStateMessage,
  type GodotTelemetryMessage,
} from './godotBridgeProtocol';
import {
  INITIAL_GODOT_INTERACTIONS,
  createGodotDeviceAcceptanceReport,
  incrementGodotInteraction,
  isGodotDiagnosticsEnabled,
  readGodotDeviceEnvironment,
} from './godotDeviceAcceptance';
import GodotDeviceAcceptancePanel from './GodotDeviceAcceptancePanel';
import {
  INITIAL_GODOT_RUNTIME_HEALTH,
  reduceGodotRuntimeHealth,
  type GodotRuntimeHealthSnapshot,
} from './godotRuntimeHealthPolicy';
import './godotEvolutionPreview.css';

export type GodotEvolutionStatus =
  | 'disabled'
  | 'booting'
  | 'started'
  | 'ready'
  | 'accepted'
  | 'timeout'
  | 'error';

interface GodotEvolutionPreviewProps {
  payload: GodotEvolutionPayload;
  enabled?: boolean;
  className?: string;
  fallback?: ReactNode;
  startupTimeoutMs?: number;
  healthFallbackEnabled?: boolean;
  diagnosticsEnabled?: boolean;
  onMessage?: (message: GodotBridgeInboundMessage) => void;
  onStatusChange?: (status: GodotEvolutionStatus) => void;
  onHealthChange?: (health: GodotRuntimeHealthSnapshot) => void;
  onFatalError?: (failure: GodotCutoverFailure) => void;
}

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const DEFAULT_STARTUP_TIMEOUT_MS = 60_000;

function initialReducedMotionPreference(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function initialDiagnosticsPreference(): boolean {
  return typeof window !== 'undefined'
    && isGodotDiagnosticsEnabled(window.location.search);
}

export function GodotEvolutionPreview({
  payload,
  enabled = GODOT_EVOLUTION_ENABLED,
  className = '',
  fallback = null,
  startupTimeoutMs = DEFAULT_STARTUP_TIMEOUT_MS,
  healthFallbackEnabled = false,
  diagnosticsEnabled = initialDiagnosticsPreference(),
  onMessage,
  onStatusChange,
  onHealthChange,
  onFatalError,
}: GodotEvolutionPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const acceptedRef = useRef(false);
  const fatalReportedRef = useRef(false);
  const [status, setStatus] = useState<GodotEvolutionStatus>(
    enabled ? 'booting' : 'disabled',
  );
  const [progress, setProgress] = useState(0);
  const [state, setState] = useState<GodotStateMessage | null>(null);
  const [telemetry, setTelemetry] = useState<GodotTelemetryMessage | null>(null);
  const [lifecycle, setLifecycle] = useState<GodotLifecycleMessage | null>(null);
  const [health, setHealth] = useState(INITIAL_GODOT_RUNTIME_HEALTH);
  const [interactions, setInteractions] = useState(INITIAL_GODOT_INTERACTIONS);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    initialReducedMotionPreference,
  );
  const source = useMemo(() => resolveGodotWebUrl(import.meta.env.BASE_URL), []);
  const environment = useMemo(readGodotDeviceEnvironment, []);
  const runtimePayload = useMemo<GodotEvolutionPayload>(() => ({
    ...payload,
    dna: {
      ...payload.dna,
      traits: {
        ...(payload.dna.traits ?? {}),
        reduced_motion: prefersReducedMotion,
      },
    },
  }), [payload, prefersReducedMotion]);
  const acceptanceReport = useMemo(() => createGodotDeviceAcceptanceReport({
    environment,
    state,
    health: health.snapshot,
    telemetry,
    lifecycle,
    interactions,
  }), [environment, health.snapshot, interactions, lifecycle, state, telemetry]);

  const sendPayload = useCallback(() => {
    const target = iframeRef.current?.contentWindow;
    if (!target || fatalReportedRef.current) return;
    target.postMessage(createGodotPayloadMessage(runtimePayload), window.location.origin);
  }, [runtimePayload]);

  const reportFatal = useCallback((failure: GodotCutoverFailure) => {
    if (fatalReportedRef.current) return;
    fatalReportedRef.current = true;
    acceptedRef.current = false;
    setStatus(failure === 'startup-timeout' ? 'timeout' : 'error');
    onFatalError?.(failure);
  }, [onFatalError]);

  useEffect(() => {
    onStatusChange?.(status);
  }, [onStatusChange, status]);

  useEffect(() => {
    onHealthChange?.(health.snapshot);
    if (healthFallbackEnabled && health.snapshot.shouldFallback) {
      reportFatal('performance-health');
    }
  }, [health.snapshot, healthFallbackEnabled, onHealthChange, reportFatal]);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);
    updatePreference();
    mediaQuery.addEventListener('change', updatePreference);
    return () => mediaQuery.removeEventListener('change', updatePreference);
  }, []);

  useEffect(() => {
    if (!enabled) {
      acceptedRef.current = false;
      fatalReportedRef.current = false;
      setStatus('disabled');
      return undefined;
    }

    acceptedRef.current = false;
    fatalReportedRef.current = false;
    setStatus('booting');
    setProgress(0);
    setState(null);
    setTelemetry(null);
    setLifecycle(null);
    setHealth(INITIAL_GODOT_RUNTIME_HEALTH);
    setInteractions(INITIAL_GODOT_INTERACTIONS);

    const timeoutId = window.setTimeout(() => {
      if (!acceptedRef.current && !fatalReportedRef.current) {
        reportFatal('startup-timeout');
      }
    }, Math.max(1_000, startupTimeoutMs));

    return () => window.clearTimeout(timeoutId);
  }, [enabled, reportFatal, startupTimeoutMs]);

  useEffect(() => {
    if (!enabled) return undefined;

    const handleMessage = (event: MessageEvent<unknown>) => {
      const frameWindow = iframeRef.current?.contentWindow;
      if (
        !frameWindow
        || event.source !== frameWindow
        || event.origin !== window.location.origin
        || !isGodotBridgeInboundMessage(event.data)
      ) {
        return;
      }

      const message = event.data;
      if (message.type === 'amore:godot:state' && message.source !== 'portal') {
        return;
      }
      onMessage?.(message);

      switch (message.type) {
        case 'amore:godot:booting':
          if (!acceptedRef.current && !fatalReportedRef.current) setStatus('booting');
          break;
        case 'amore:godot:progress':
          if (!fatalReportedRef.current) setProgress(message.ratio);
          break;
        case 'amore:godot:engine-started':
          if (!acceptedRef.current && !fatalReportedRef.current) setStatus('started');
          break;
        case 'amore:godot:ready':
          if (!acceptedRef.current && !fatalReportedRef.current) {
            setStatus('ready');
            sendPayload();
          }
          break;
        case 'amore:godot:state':
          if (fatalReportedRef.current) break;
          if (!isGodotRuntimeStateAccepted(message, runtimePayload)) {
            reportFatal('state-mismatch');
            break;
          }
          acceptedRef.current = true;
          setState(message);
          setStatus('accepted');
          break;
        case 'amore:godot:telemetry':
          setTelemetry(message);
          setHealth(current => reduceGodotRuntimeHealth(current, message));
          break;
        case 'amore:godot:lifecycle':
          setLifecycle(message);
          break;
        case 'amore:godot:interaction':
          setInteractions(current => incrementGodotInteraction(current, message.kind));
          break;
        case 'amore:godot:activate':
          break;
        case 'amore:godot:error':
          reportFatal('runtime-error');
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [enabled, onMessage, reportFatal, runtimePayload, sendPayload]);

  useEffect(() => {
    if (enabled && (status === 'ready' || status === 'accepted')) {
      sendPayload();
    }
  }, [enabled, sendPayload, status]);

  if (!enabled) return fallback;

  const quality = telemetry?.quality ?? state?.quality ?? 'unknown';
  const renderScale = telemetry?.render_scale ?? state?.render_scale;
  const lifeHz = telemetry?.life_hz ?? state?.life_hz;
  const suspended = telemetry?.suspended ?? lifecycle?.suspended ?? false;
  const restores = telemetry?.restores ?? lifecycle?.restores ?? 0;

  return (
    <div
      className={`godot-evolution-preview ${className}`.trim()}
      data-godot-evolution="device-acceptance"
      data-godot-status={status}
      data-godot-progress={progress.toFixed(3)}
      data-godot-state-signature={state?.signature ?? ''}
      data-godot-motion={state?.motion ?? 'unknown'}
      data-godot-quality={quality}
      data-godot-fps={telemetry?.fps.toFixed(2) ?? ''}
      data-godot-frame-ms={telemetry?.frame_ms.toFixed(2) ?? ''}
      data-godot-draw-calls={telemetry?.draw_calls ?? ''}
      data-godot-primitives={telemetry?.primitives ?? ''}
      data-godot-static-memory-mb={telemetry?.static_memory_mb.toFixed(2) ?? ''}
      data-godot-render-scale={renderScale?.toFixed(2) ?? ''}
      data-godot-life-hz={lifeHz?.toFixed(0) ?? ''}
      data-godot-suspended={String(suspended)}
      data-godot-restores={String(restores)}
      data-godot-lifecycle={lifecycle?.state ?? ''}
      data-godot-health={health.snapshot.status}
      data-godot-health-reason={health.snapshot.reason}
      data-godot-health-samples={health.snapshot.sampleCount}
      data-godot-health-fallback={String(health.snapshot.shouldFallback)}
      data-godot-orbit-count={interactions.orbit}
      data-godot-zoom-count={interactions.zoom}
      data-godot-acceptance-passed={String(acceptanceReport.passed)}
    >
      <iframe
        ref={iframeRef}
        className="godot-evolution-preview__frame"
        src={source}
        title="Amore Evolution Engine — Godot 4.7.1"
        loading="eager"
        allow="fullscreen"
        sandbox="allow-scripts allow-same-origin"
        referrerPolicy="same-origin"
        onError={() => reportFatal('frame-load')}
      />
      <span className="godot-evolution-preview__status" aria-live="polite">
        {status === 'accepted'
          ? `Godot ${quality} · ${health.snapshot.status}${telemetry ? ` · ${Math.round(telemetry.fps)} FPS` : ''}`
          : status === 'timeout'
            ? 'Godot runtime timeout'
            : status === 'error'
              ? 'Godot runtime error'
              : `Godot runtime · ${Math.round(progress * 100)}%`}
      </span>
      {diagnosticsEnabled && <GodotDeviceAcceptancePanel report={acceptanceReport} />}
    </div>
  );
}

export default GodotEvolutionPreview;
