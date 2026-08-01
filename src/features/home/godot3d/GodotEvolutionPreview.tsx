import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { GODOT_EVOLUTION_ENABLED } from './godotFeatureFlag';
import {
  createGodotPayloadMessage,
  isGodotBridgeInboundMessage,
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
  | 'error';

interface GodotEvolutionPreviewProps {
  payload: GodotEvolutionPayload;
  enabled?: boolean;
  className?: string;
  fallback?: ReactNode;
  onMessage?: (message: GodotBridgeInboundMessage) => void;
}

export function GodotEvolutionPreview({
  payload,
  enabled = GODOT_EVOLUTION_ENABLED,
  className = '',
  fallback = null,
  onMessage,
}: GodotEvolutionPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [status, setStatus] = useState<GodotEvolutionStatus>(
    enabled ? 'booting' : 'disabled',
  );
  const [progress, setProgress] = useState(0);
  const [stateSignature, setStateSignature] = useState('');
  const [motion, setMotion] = useState<'unknown' | 'full' | 'reduced'>('unknown');
  const source = useMemo(() => resolveGodotWebUrl(import.meta.env.BASE_URL), []);

  const sendPayload = useCallback(() => {
    const target = iframeRef.current?.contentWindow;
    if (!target) return;
    target.postMessage(createGodotPayloadMessage(payload), window.location.origin);
  }, [payload]);

  useEffect(() => {
    if (!enabled) {
      setStatus('disabled');
      return undefined;
    }

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
          setProgress(Number.isFinite(message.ratio) ? message.ratio : 0);
          break;
        case 'amore:godot:engine-started':
          setStatus('started');
          break;
        case 'amore:godot:ready':
          setStatus('ready');
          sendPayload();
          break;
        case 'amore:godot:state':
          setStateSignature(message.signature);
          setMotion(message.motion ?? 'unknown');
          setStatus('accepted');
          break;
        case 'amore:godot:error':
          setStatus('error');
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [enabled, onMessage, sendPayload]);

  useEffect(() => {
    if (enabled && (status === 'ready' || status === 'accepted')) {
      sendPayload();
    }
  }, [enabled, sendPayload, status]);

  if (!enabled) return fallback;

  return (
    <div
      className={`godot-evolution-preview ${className}`.trim()}
      data-godot-evolution="isolated"
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
      />
      <span className="godot-evolution-preview__status" aria-live="polite">
        {status === 'accepted'
          ? 'Godot runtime accepted'
          : status === 'error'
            ? 'Godot runtime error'
            : `Godot runtime · ${Math.round(progress * 100)}%`}
      </span>
    </div>
  );
}

export default GodotEvolutionPreview;
