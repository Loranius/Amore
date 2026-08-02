import { useCallback, useState, type KeyboardEvent } from 'react';
import { Canvas } from '@react-three/fiber';
import { useTheme } from '@/providers/ThemeProvider';
import { CrystalPlaceholder } from '../../CrystalPlaceholder';
import { MemoryModal } from '../../MemoryModal';
import LegacyCrystalScene from '../CrystalScene';
import { PortalStage } from '../scene/PortalStage';
import {
  PORTAL_ENVIRONMENT_DRAW_CALLS,
  PORTAL_ENVIRONMENT_TRIANGLES,
} from '../scene/portalScene';
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
  const { theme } = useTheme();
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
        data-portal-environment-draw-calls={PORTAL_ENVIRONMENT_DRAW_CALLS}
        data-portal-environment-triangles={PORTAL_ENVIRONMENT_TRIANGLES}
      >
        <Canvas
          dpr={metrics.quality === 'high' ? [1, 2] : metrics.quality === 'balanced' ? [1, 1.75] : [1, 1.35]}
          // Стартова позиція — приблизно кадр для вертикального телефона.
          // Точну дає PortalCameraRig із фактичного аспекту вже на першому
          // кадрі; тут вона потрібна лише щоб цей кадр не почався здалеку.
          camera={{ position: [0, 0.685, 7.1], fov: 42 }}
          gl={{ alpha: true, antialias: metrics.quality !== 'fallback' }}
        >
          <PortalStage
            seed={pipeline.geometry.artifactSeed}
            theme={theme}
            quality={metrics.quality}
            reduceMotion={reduceMotion}
          >
            <EvolutionCrystalObject
              geometry={pipeline.geometry}
              material={pipeline.material}
              life={pipeline.life}
              onOpen={openModal}
            />
          </PortalStage>
          <EvolutionRuntimeProbe onMetrics={onRuntimeMetrics} />
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
