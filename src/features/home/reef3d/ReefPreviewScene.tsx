import { useCallback, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { evaluateReefProductionRuntimeAcceptance } from '@/engine/productionAcceptance';
import { CrystalPlaceholder } from '../CrystalPlaceholder';
import {
  EvolutionRuntimeProbe,
  type EvolutionRuntimeMetrics,
} from '../crystal3d/evolution/EvolutionRuntimeProbe';
import { ReefObject } from './ReefObject';
import {
  REEF_MATERIAL_PASS,
  REEF_MATERIAL_PRESENTATION_VERSION,
} from './reefMaterialPresentation';
import {
  REEF_COLONY_SHAPE_PASS,
  REEF_PRESENTATION_VERSION,
} from './reefPresentation';
import type { ReefThreeSceneState } from './reefThreeAdapter';
import { useReefPortalPreview } from './useReefPortalPreview';
import './reefPreview.css';

function formatCount(value: number): string {
  if (value < 1_000) return String(value);
  return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}k`;
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return reduced;
}

export default function ReefPreviewScene() {
  const portal = useReefPortalPreview();
  const reducedMotion = useReducedMotion();
  const [runtime, setRuntime] = useState<EvolutionRuntimeMetrics | null>(null);
  const [sceneState, setSceneState] = useState<ReefThreeSceneState | null>(null);
  const onRuntimeMetrics = useCallback((next: EvolutionRuntimeMetrics) => setRuntime(next), []);
  const onSceneReady = useCallback((next: ReefThreeSceneState) => setSceneState(next), []);

  if (portal.isPending) return <CrystalPlaceholder />;
  if (portal.error || !portal.preview) {
    return (
      <div
        className="reef-production-error"
        data-home-artifact-preview="reef"
        data-reef-preview="error"
        role="status"
      >
        <span>Reef Production</span>
        <h2>Риф не вдалося побудувати</h2>
        <p>{portal.error?.message ?? 'Portal history is unavailable.'}</p>
      </div>
    );
  }

  const { build, diagnostics } = portal.preview;
  const reportedDrawCalls = runtime?.drawCalls
    ?? (reducedMotion ? sceneState?.diagnostics.drawCalls ?? null : null);
  const reportedTriangles = runtime?.triangles
    ?? (reducedMotion ? sceneState?.diagnostics.triangles ?? null : null);
  const runtimeAcceptance = evaluateReefProductionRuntimeAcceptance({
    contract: build.acceptance,
    buildMs: build.buildMs,
    drawCalls: reportedDrawCalls,
    triangles: reportedTriangles,
  });
  const status = runtimeAcceptance.status;
  const runtimeViolations = runtimeAcceptance.violations;
  const badge = [
    build.species.state.stage,
    `${build.diagnostics.colonyCount} colonies`,
    `${build.diagnostics.batchCount} batches`,
    `${build.diagnostics.materialCount} mat`,
    `${build.diagnostics.motionBindingCount} live`,
    `${formatCount(build.diagnostics.triangleCount)} △`,
    reportedDrawCalls === null ? 'DC…' : `${reportedDrawCalls} DC`,
    `${build.buildMs.toFixed(1)} ms`,
  ].join(' · ');

  return (
    <div
      className="reef-production-wrap"
      data-home-artifact-preview="reef"
      data-reef-preview="ready"
      data-reef-source="portal"
      data-reef-presentation={REEF_PRESENTATION_VERSION}
      data-reef-shape-pass={REEF_COLONY_SHAPE_PASS}
      data-reef-material-presentation={REEF_MATERIAL_PRESENTATION_VERSION}
      data-reef-material-pass={REEF_MATERIAL_PASS}
      data-reef-acceptance={status}
      data-reef-static-acceptance={build.acceptance.staticStatus}
      data-reef-violations={runtimeViolations.join(',')}
      data-reef-production-signature={build.acceptance.signature}
      data-reef-identity-signature={build.acceptance.identitySignature}
      data-reef-phase-count={build.acceptance.phaseCheckpoints.length}
      data-reef-phase-order={String(build.acceptance.diagnostics.phaseOrderPreserved)}
      data-reef-phase-provenance={String(build.acceptance.diagnostics.phaseProvenancePreserved)}
      data-reef-colony-identity={String(build.acceptance.diagnostics.colonyIdentityChainPreserved)}
      data-reef-range-binding-chain={String(build.acceptance.diagnostics.rangeBindingChainPreserved)}
      data-reef-reduced-motion={String(reducedMotion)}
      data-reef-couple-id={build.artifact.coupleId}
      data-reef-as-of={build.life.asOf}
      data-reef-stage={build.species.state.stage}
      data-reef-normalized-events={portal.preview.normalizedEventCount}
      data-reef-adapter-diagnostics={diagnostics.length}
      data-reef-colonies={build.diagnostics.colonyCount}
      data-reef-batches={build.diagnostics.batchCount}
      data-reef-foundation-vertices={build.foundation.vertices.length}
      data-reef-vertices={build.diagnostics.vertexCount}
      data-reef-triangles={build.diagnostics.triangleCount}
      data-reef-materials={build.diagnostics.materialCount}
      data-reef-motion-bindings={build.diagnostics.motionBindingCount}
      data-reef-expected-draw-calls={build.diagnostics.expectedDrawCalls}
      data-reef-runtime-draw-calls={reportedDrawCalls ?? ''}
      data-reef-runtime-triangles={reportedTriangles ?? ''}
      data-reef-build-ms={build.buildMs}
      data-reef-current-cycle={build.life.current.cycleSeconds}
    >
      <Canvas
        dpr={[1, 1.5]}
        frameloop={reducedMotion ? 'demand' : 'always'}
        camera={{ position: [0, 2.75, 7.8], fov: 40, near: 0.1, far: 40 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      >
        <ambientLight intensity={0.46} />
        <hemisphereLight args={['#d8f8ff', '#244654', 1.05]} />
        <directionalLight position={[4, 7, 5]} intensity={2.2} color="#fff1da" />
        <directionalLight position={[-4, 2, -3]} intensity={0.72} color="#6bbbd3" />
        <ReefObject
          build={build}
          reducedMotion={reducedMotion}
          onSceneReady={onSceneReady}
        />
        <OrbitControls
          makeDefault
          enablePan={false}
          enableDamping={!reducedMotion}
          dampingFactor={0.06}
          minDistance={6}
          maxDistance={10.5}
          minPolarAngle={0.62}
          maxPolarAngle={1.45}
          target={[0, 0.82, 0]}
        />
        <EvolutionRuntimeProbe onMetrics={onRuntimeMetrics} warmupFrames={18} />
      </Canvas>
      <span className={`reef-production-status reef-production-status--${status}`}>
        {status === 'pass' ? 'production accepted' : status === 'fail' ? 'acceptance fail' : 'runtime warming…'}
      </span>
      <span className="reef-production-species">
        Reef Species · Phase 11 · {reducedMotion ? 'material language · static' : 'material language · ambient current'}
      </span>
      <span className="reef-production-badge" title={badge}>{badge}</span>
    </div>
  );
}
