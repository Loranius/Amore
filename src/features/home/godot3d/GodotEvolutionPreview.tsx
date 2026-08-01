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
} from './godotBridgeProtocol';
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
  onMessage?: (message: GodotBridgeInboundMessage) => void;
  onStatusChange?: (status: GodotEvolutionStatus) => void;
  onFatalError?: (failure: GodotCutoverFailure) => void;
}

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const DEFAULT_STARTUP_TIMEOUT_MS = 60_000;

function initialReducedMotionPreference(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

export function GodotEvolutionPreview({
  payload,
  enabled = GODOT_EVOLUTION_ENABLED,
  className = '',
  fallback = null,
  startupTimeoutMs = DEFAULT_STARTUP_TIMEOUT_MS,
  onMessage,
  onStatusChange,
  onFatalError,
}: GodotEvolutionPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const acceptedRef = useRef(false);
  const fatalReportedRef = useRef(false);
  const [status, setStatus] = useState<GodotEvolutionStatus>(
    enabled ? 'booting' : 'disabled',
  );
  const [progress, setProgress] = useState(0);
  const [stateSignature, setStateSignature] = useState('');
  const [motion, setMotion] = useState<'unknown' | 'full' | 'reduced'>('unknown');
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    initialReducedMotionPreference,
  );
  const source = useMemo(() => resolveGodotWebUrl(import.meta.env.BASE_URL), []);
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

  const sendPayload = useCallback(() => {
    const target = iframeRef.current?.contentWindow;
    if (!target) return;
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
    setStateSignature('');
    setMotion('unknown');

    const timeoutId = window.setTimeout(() => {
      if (!acceptedRef.current) reportFatal('startup-timeout');
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
      onMessage?.(message);

      switch (message.type) {
        case 'amore:godot:booting':
          setStatus('booting');
          break;
        case 'amore:godot:progress':
          setProgress(message.ratio);
          break;
        case 'amore:godot:engine-started':
          setStatus('started');
          break;
        case 'amore:godot:ready':
          setStatus('ready');
          sendPayload();
          break;
        case 'amore:godot:state':
          if (!isGodotRuntimeStateAccepted(message, runtimePayload)) {
            reportFatal('state-mismatch');
            break;
          }
          acceptedRef.current = true;
          setStateSignature(message.signature);
          setMotion(message.motion ?? 'unknown');
          setStatus('accepted');
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

  return (
    <div
      className={`godot-evolution-preview ${className}`.trim()}
      data-godot-evolution="production-cutover"
      data-godot-status={status}
      data-godot-progress={progress.toFixed(3)}
      data-godot-state-signature={stateSignature}
      data-godot-motion={motion}
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
          ? 'Godot runtime accepted'
          : status === 'timeout'
            ? 'Godot runtime timeout'
            : status === 'error'
              ? 'Godot runtime error'
              : `Godot runtime · ${Math.round(progress * 100)}%`}
      </span>
    </div>
  );
}

export default GodotEvolutionPreview;
