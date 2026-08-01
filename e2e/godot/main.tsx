import { StrictMode, useCallback, useState } from 'react';
import { createRoot } from 'react-dom/client';
import GodotEvolutionPreview from '@/features/home/godot3d/GodotEvolutionPreview';
import type {
  GodotBridgeInboundMessage,
  GodotEvolutionPayload,
} from '@/features/home/godot3d/godotBridgeProtocol';

const payload: GodotEvolutionPayload = {
  dna: {
    seed: 582013,
    species: 'crystal',
    engine_version: 'godot-0.1.0',
    traits: {
      identity: 'playwright-react-bridge',
      source: 'e2e',
    },
  },
  events: [
    {
      id: 'event:b',
      occurred_at: '2025-02-01',
      source: 'plans@1',
      evidence: 'verified',
      channels: { achievement: 0.82, stability: 0.4 },
      portal_activity: 0.33,
    },
    {
      id: 'event:a',
      occurred_at: '2024-01-01',
      source: 'memories@1',
      evidence: 'verified',
      channels: { remembrance: 0.91, significance: 0.72 },
      portal_activity: 0.27,
    },
    {
      id: 'event:c',
      occurred_at: '2026-03-03',
      source: 'map@1',
      evidence: 'verified',
      channels: { exploration: 0.88, culture: 0.2 },
      portal_activity: 0.38,
    },
  ],
};

function queryFlag(name: string): boolean {
  return ['1', 'true', 'on'].includes(
    (new URLSearchParams(window.location.search).get(name) ?? '').toLowerCase(),
  );
}

function GodotBridgeHarness() {
  const [activationCount, setActivationCount] = useState(0);
  const [interactionCount, setInteractionCount] = useState(0);
  const [fatalFailure, setFatalFailure] = useState('');
  const rollbackDrill = queryFlag('godotRollbackDrill');
  const onMessage = useCallback((message: GodotBridgeInboundMessage) => {
    if (message.type === 'amore:godot:activate') {
      setActivationCount(count => count + 1);
    }
    if (message.type === 'amore:godot:interaction') {
      setInteractionCount(count => count + 1);
    }
  }, []);

  return (
    <main
      data-godot-harness="react"
      data-godot-activation-count={activationCount}
      data-godot-interaction-count={interactionCount}
      data-godot-fatal-failure={fatalFailure}
      data-godot-rollback-drill={String(rollbackDrill)}
      style={{
        width: '100%',
        maxWidth: 520,
        margin: '0 auto',
        padding: 12,
        boxSizing: 'border-box',
      }}
    >
      <GodotEvolutionPreview
        payload={payload}
        enabled={!rollbackDrill}
        fallback={<div data-godot-three-fallback="rollback-drill">Three.js rollback drill</div>}
        healthFallbackEnabled={queryFlag('healthFallback')}
        releasePreflightEnabled={queryFlag('releasePreflight')}
        releaseOperationsEnabled={queryFlag('godotReleaseOps')}
        rollbackDrill={rollbackDrill}
        onMessage={onMessage}
        onFatalError={setFatalFailure}
      />
    </main>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Godot bridge harness root is missing.');

createRoot(root).render(
  <StrictMode>
    <GodotBridgeHarness />
  </StrictMode>,
);
