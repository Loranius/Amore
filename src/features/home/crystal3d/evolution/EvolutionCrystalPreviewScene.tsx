import { useCallback, useMemo, useState, type KeyboardEvent } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { CrystalPlaceholder } from '../../CrystalPlaceholder';
import { CrystalStats } from '../../CrystalStats';
import { MemoryModal } from '../../MemoryModal';
import { useCrystalDNA } from '../../useCrystal';
import LegacyCrystalScene from '../CrystalScene';
import GodotEvolutionPreview from '../../godot3d/GodotEvolutionPreview';
import {
  resolveEvolutionRenderer,
  type GodotCutoverFailure,
} from '../../godot3d/godotCutoverPolicy';
import {
  GODOT_EVOLUTION_ENABLED,
  GODOT_EVOLUTION_MODE,
  GODOT_EVOLUTION_RELEASE_CONTROL,
  GODOT_EVOLUTION_ROLLOUT_ELIGIBLE,
  GODOT_EVOLUTION_ROLLOUT_PERCENT,
} from '../../godot3d/godotFeatureFlag';
import { godotPayloadFromArtifact } from '../../godot3d/godotPayloadFromArtifact';
import type {
  GodotBridgeInboundMessage,
  GodotStateMessage,
} from '../../godot3d/godotBridgeProtocol';
import { EvolutionCrystalObject } from './EvolutionCrystalObject';
import {
  EvolutionRuntimeProbe,
  type EvolutionRuntimeMetrics,
} from './EvolutionRuntimeProbe';
import { useEvolutionCrystalPipeline } from './useEvolutionCrystalPipeline';
import './evolutionPreview.css';

function formatTopology(value: number): string {
  if (value < 1_000) return String(value);
  return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}k`;
}

export default function EvolutionCrystalPreviewScene() {
  const [reduceMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const { pipeline, isPending, error } = useEvolutionCrystalPipeline(reduceMotion);
  const { dna, deltas, isPending: statsPending } = useCrystalDNA();
  const [open, setOpen] = useState(false);
  const [runtime, setRuntime] = useState<EvolutionRuntimeMetrics | null>(null);
  const [godotState, setGodotState] = useState<GodotStateMessage | null>(null);
  const [godotFailure, setGodotFailure] = useState<GodotCutoverFailure | null>(null);
  const godotPayload = useMemo(
    () => pipeline ? godotPayloadFromArtifact(pipeline.artifact) : null,
    [pipeline],
  );
  const renderer = resolveEvolutionRenderer({
    enabled: GODOT_EVOLUTION_ENABLED,
    payloadReady: Boolean(godotPayload),
    failure: godotFailure,
  });
  const useGodot = renderer === 'godot';

  const openModal = useCallback(() => setOpen(true), []);
  const onRuntimeMetrics = useCallback((next: EvolutionRuntimeMetrics) => {
    setRuntime(next);
  }, []);
  const onGodotMessage = useCallback((message: GodotBridgeInboundMessage) => {
    if (message.type === 'amore:godot:state') setGodotState(message);
    if (message.type === 'amore:godot:activate') openModal();
  }, [openModal]);
  const onGodotFatalError = useCallback((failure: GodotCutoverFailure) => {
    console.error(`[Godot production cutover] ${failure}; falling back to Three.js.`);
    setGodotState(null);
    setGodotFailure(failure);
  }, []);

  if (error) {
    console.error('[Evolution crystal preview] fallback to legacy renderer:', error);
    return (
      <div className="evolution-preview-fallback">
        <LegacyCrystalScene />
        <span className="evolution-preview-badge evolution-preview-badge--error">
          Evolution fallback
        </span>
      </div>
    );
  }

  if (isPending || !pipeline) return <CrystalPlaceholder />;

  const onKeyDownOpen = (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openModal();
    }
  };
  const metrics = pipeline.metrics;
  const badge = renderer === 'godot'
    ? [
        GODOT_EVOLUTION_MODE === 'production' ? 'Godot production' : 'Godot preview',
        GODOT_EVOLUTION_RELEASE_CONTROL.stage,
        `rollout ${GODOT_EVOLUTION_ROLLOUT_PERCENT}%`,
        godotState ? `${godotState.instructions} канон.` : 'runtime…',
        godotState?.rendered_instructions !== undefined
          ? `${godotState.rendered_instructions} тіл`
          : 'bridge…',
        godotState?.signature ?? 'signature…',
      ].join(' · ')
    : renderer === 'three-fallback'
      ? [
          'Three fallback',
          godotFailure,
          `${metrics.meshCount} тіл`,
          `${formatTopology(metrics.usedTriangles)} △`,
        ].join(' · ')
      : [
          GODOT_EVOLUTION_MODE === 'production' && !GODOT_EVOLUTION_RELEASE_CONTROL.gateOpen
            ? `Three release gate · ${GODOT_EVOLUTION_RELEASE_CONTROL.reason}`
            : GODOT_EVOLUTION_MODE === 'production' && !GODOT_EVOLUTION_ROLLOUT_ELIGIBLE
              ? 'Three rollout cohort'
              : 'Evolution',
          metrics.quality,
          `${metrics.meshCount} тіл`,
          `${formatTopology(metrics.usedTriangles)} △`,
          runtime ? `${runtime.drawCalls} DC` : 'метрики…',
          `${metrics.buildMs.toFixed(1)} ms`,
        ].join(' · ');

  return (
    <>
      <div
        className="crystal-wrap evolution-preview-wrap"
        role="button"
        tabIndex={0}
        aria-label="Кристал Amore Evolution — показати випадковий спогад"
        onKeyDown={onKeyDownOpen}
        data-evolution-preview="ready"
        data-evolution-renderer={renderer === 'godot' ? 'godot-4.7.1' : renderer}
        data-evolution-quality={metrics.quality}
        data-evolution-bodies={renderer === 'godot'
          ? godotState?.instructions ?? ''
          : metrics.bodyCount}
        data-evolution-meshes={renderer === 'godot' ? '' : metrics.meshCount}
        data-evolution-materials={renderer === 'godot' ? '' : metrics.materialCount}
        data-evolution-vertices={renderer === 'godot' ? '' : metrics.usedVertices}
        data-evolution-triangles={renderer === 'godot' ? '' : metrics.usedTriangles}
        data-evolution-build-ms={metrics.buildMs}
        data-evolution-runtime={renderer === 'godot'
          ? godotState ? 'ready' : 'warming'
          : runtime ? 'ready' : 'warming'}
        data-evolution-draw-calls={renderer === 'godot' ? '' : runtime?.drawCalls ?? ''}
        data-evolution-rendered-triangles={renderer === 'godot' ? '' : runtime?.triangles ?? ''}
        data-evolution-state-signature={godotState?.signature ?? ''}
        data-evolution-godot-failure={godotFailure ?? ''}
        data-evolution-godot-rollout={GODOT_EVOLUTION_ROLLOUT_PERCENT}
        data-evolution-godot-cohort={String(GODOT_EVOLUTION_ROLLOUT_ELIGIBLE)}
        data-evolution-godot-release-stage={GODOT_EVOLUTION_RELEASE_CONTROL.stage}
        data-evolution-godot-release-gate={String(GODOT_EVOLUTION_RELEASE_CONTROL.gateOpen)}
        data-evolution-godot-release-reason={GODOT_EVOLUTION_RELEASE_CONTROL.reason}
        data-evolution-godot-release-id={GODOT_EVOLUTION_RELEASE_CONTROL.releaseId}
        data-evolution-godot-kill-switch={String(GODOT_EVOLUTION_RELEASE_CONTROL.killSwitch)}
      >
        {useGodot && godotPayload ? (
          <GodotEvolutionPreview
            payload={godotPayload}
            enabled
            startupTimeoutMs={60_000}
            healthFallbackEnabled={GODOT_EVOLUTION_MODE === 'production'}
            onMessage={onGodotMessage}
            onFatalError={onGodotFatalError}
          />
        ) : (
          <Canvas
            dpr={metrics.quality === 'high' ? [1, 2] : metrics.quality === 'balanced' ? [1, 1.75] : [1, 1.35]}
            camera={{ position: [0, 0.2, 5.4], fov: 42 }}
            gl={{ alpha: true, antialias: metrics.quality !== 'fallback' }}
          >
            <ambientLight intensity={0.3} />
            <directionalLight position={[3, 4, 2]} intensity={1.08} />
            <directionalLight position={[-2.5, 3.5, -3.5]} intensity={0.82} color="#fff1f6" />
            <pointLight position={[-3, -2, -2]} intensity={0.34} color="#e6a0bd" />
            <EvolutionCrystalObject
              geometry={pipeline.geometry}
              material={pipeline.material}
              life={pipeline.life}
              onOpen={openModal}
            />
            <EvolutionRuntimeProbe onMetrics={onRuntimeMetrics} />
            <OrbitControls
              enablePan={false}
              enableZoom={false}
              enableDamping={!reduceMotion}
              dampingFactor={0.08}
              target={[0, 0.2, 0]}
            />
          </Canvas>
        )}
        <span className="evolution-preview-badge" aria-label="Метрики Evolution preview">
          {badge}
        </span>
        {pipeline.diagnostics.length > 0 && (
          <span
            className="evolution-preview-diagnostics"
            title={pipeline.diagnostics.map((item) => item.message).join('\n')}
          >
            {pipeline.diagnostics.length} діагн.
          </span>
        )}
      </div>

      <CrystalStats dna={dna} deltas={deltas} isPending={statsPending} />
      {open && <MemoryModal onClose={() => setOpen(false)} />}
    </>
  );
}

export default EvolutionCrystalPreviewScene;
