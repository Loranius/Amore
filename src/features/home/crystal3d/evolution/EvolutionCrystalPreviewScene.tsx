import { useCallback, useState, type KeyboardEvent } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { CrystalPlaceholder } from '../../CrystalPlaceholder';
import { MemoryModal } from '../../MemoryModal';
import LegacyCrystalScene from '../CrystalScene';
import { EvolutionCrystalObject } from './EvolutionCrystalObject';
import {
  EvolutionRuntimeProbe,
  type EvolutionRuntimeMetrics,
} from './EvolutionRuntimeProbe';
import { isEvolutionDiagnosticsEnabled } from './featureFlag';
import { useEvolutionCrystalPipeline } from './useEvolutionCrystalPipeline';
import './evolutionPreview.css';

function formatTopology(value: number): string {
  if (value < 1_000) return String(value);
  return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}k`;
}

export default function EvolutionCrystalPreviewScene() {
  // Build metrics are a development instrument. They were rendering over the
  // artifact in production, which is both noise on the portal's one hero
  // surface and an internal detail (body counts, draw calls, build time) that
  // means nothing to a couple looking at their crystal.
  const [diagnosticsVisible] = useState(isEvolutionDiagnosticsEnabled);
  const [reduceMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const { pipeline, isPending, error } = useEvolutionCrystalPipeline(reduceMotion);
  const [open, setOpen] = useState(false);
  const [runtime, setRuntime] = useState<EvolutionRuntimeMetrics | null>(null);

  const openModal = useCallback(() => setOpen(true), []);
  const onRuntimeMetrics = useCallback((next: EvolutionRuntimeMetrics) => {
    setRuntime(next);
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
  const badge = [
    'Evolution',
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
        data-evolution-renderer="three"
        data-evolution-quality={metrics.quality}
        data-evolution-bodies={metrics.bodyCount}
        data-evolution-meshes={metrics.meshCount}
        data-evolution-materials={metrics.materialCount}
        data-evolution-vertices={metrics.usedVertices}
        data-evolution-triangles={metrics.usedTriangles}
        data-evolution-build-ms={metrics.buildMs}
        data-evolution-runtime={runtime ? 'ready' : 'warming'}
        data-evolution-draw-calls={runtime?.drawCalls ?? ''}
        data-evolution-rendered-triangles={runtime?.triangles ?? ''}
      >
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
        {diagnosticsVisible && (
          <span className="evolution-preview-badge" aria-label="Метрики Evolution preview">
            {badge}
          </span>
        )}
        {diagnosticsVisible && pipeline.diagnostics.length > 0 && (
          <span
            className="evolution-preview-diagnostics"
            title={pipeline.diagnostics.map((item) => item.message).join('\n')}
          >
            {pipeline.diagnostics.length} діагн.
          </span>
        )}
      </div>

      {open && <MemoryModal onClose={() => setOpen(false)} />}
    </>
  );
}
