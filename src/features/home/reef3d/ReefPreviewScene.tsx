import { useCallback, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { evaluateReefProductionRuntimeAcceptance } from '@/engine/productionAcceptance';
import { CrystalPlaceholder } from '../CrystalPlaceholder';
import {
  EvolutionRuntimeProbe,
  type EvolutionRuntimeMetrics,
} from '../crystal3d/evolution/EvolutionRuntimeProbe';
import { ReefObject } from './ReefObject';
import { ReefStage } from './ReefStage';
import type { ReefFishSchoolMetrics } from './ReefFishSchool';
import type { ReefBackdropMetrics } from './ReefBackdropCorals';
import {
  REEF_BACKDROP_MODEL,
  REEF_BACKDROP_PRESENTATION,
} from './reefAssetManifest';
import {
  REEF_FISH_SCHOOL_MODEL,
  REEF_FISH_SCHOOL_ROUTE_PROFILE,
} from './reefFishSchoolPresentation';
import {
  REEF_FOUNDATION_PASS,
  REEF_FOUNDATION_PRESENTATION_VERSION,
} from './reefFoundationPresentation';
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
import './reefWorld.css';

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

/**
 * Portal-facing reef scene.
 *
 * Production diagnostics stay available as data attributes for acceptance and
 * automated checks, but they are no longer part of the visual experience.
 * The user sees the generated reef in its own underwater world, not a lab card.
 */
export default function ReefPreviewScene() {
  const portal = useReefPortalPreview();
  const reducedMotion = useReducedMotion();
  const [backdropRuntime, setBackdropRuntime] = useState<ReefBackdropMetrics | null>(null);
  const [fishRuntime, setFishRuntime] = useState<ReefFishSchoolMetrics | null>(null);
  const [worldRuntime, setWorldRuntime] = useState<EvolutionRuntimeMetrics | null>(null);
  const [sceneState, setSceneState] = useState<ReefThreeSceneState | null>(null);
  const onRuntimeMetrics = useCallback((next: EvolutionRuntimeMetrics) => setWorldRuntime(next), []);
  const onBackdropReady = useCallback(
    (next: ReefBackdropMetrics) => setBackdropRuntime(next),
    [],
  );
  const onFishReady = useCallback((next: ReefFishSchoolMetrics) => setFishRuntime(next), []);
  const onSceneReady = useCallback((next: ReefThreeSceneState) => setSceneState(next), []);

  if (portal.isPending) return <CrystalPlaceholder />;
  if (portal.error || !portal.preview) {
    return (
      <div
        className="home-artifact-preview-fallback reef-world-error"
        data-home-artifact-preview="reef"
        data-reef-preview="error"
        role="status"
      >
        <div>
          <h2>Риф не вдалося побудувати</h2>
          <p>{portal.error?.message ?? 'Portal history is unavailable.'}</p>
        </div>
      </div>
    );
  }

  const { build, diagnostics } = portal.preview;
  // Reef acceptance must describe the generated reef, not the decorative
  // underwater world around it. ReefObject exposes exact production geometry
  // diagnostics when its accepted Three scene is created; the global probe is
  // kept separately so world-level performance can still be inspected.
  const reportedDrawCalls = sceneState?.diagnostics.drawCalls ?? null;
  const reportedTriangles = sceneState?.diagnostics.triangles ?? null;
  const runtimeAcceptance = evaluateReefProductionRuntimeAcceptance({
    contract: build.acceptance,
    buildMs: build.buildMs,
    drawCalls: reportedDrawCalls,
    triangles: reportedTriangles,
  });

  return (
    <div
      className="crystal-wrap evolution-preview-wrap reef-world-wrap"
      data-home-artifact-preview="reef"
      data-reef-preview="ready"
      data-reef-source="portal"
      data-reef-scene="underwater-world"
      data-reef-presentation={REEF_PRESENTATION_VERSION}
      data-reef-shape-pass={REEF_COLONY_SHAPE_PASS}
      data-reef-material-presentation={REEF_MATERIAL_PRESENTATION_VERSION}
      data-reef-material-pass={REEF_MATERIAL_PASS}
      data-reef-foundation-presentation={REEF_FOUNDATION_PRESENTATION_VERSION}
      data-reef-foundation-pass={REEF_FOUNDATION_PASS}
      data-reef-acceptance={runtimeAcceptance.status}
      data-reef-static-acceptance={build.acceptance.staticStatus}
      data-reef-violations={runtimeAcceptance.violations.join(',')}
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
      data-reef-backdrop-model={backdropRuntime ? REEF_BACKDROP_MODEL : 'loading'}
      data-reef-backdrop-presentation={REEF_BACKDROP_PRESENTATION}
      data-reef-backdrop-source-meshes={backdropRuntime?.sourceMeshes ?? ''}
      data-reef-backdrop-triangles={backdropRuntime?.triangles ?? ''}
      data-reef-backdrop-draw-calls={backdropRuntime?.drawCalls ?? ''}
      data-reef-fish-model={fishRuntime ? REEF_FISH_SCHOOL_MODEL : 'loading'}
      data-reef-fish-meshes={fishRuntime?.meshes ?? ''}
      data-reef-fish-width={fishRuntime?.width ?? ''}
      data-reef-fish-height={fishRuntime?.height ?? ''}
      data-reef-fish-depth={fishRuntime?.depth ?? ''}
      data-reef-fish-routes={fishRuntime?.routes ?? ''}
      data-reef-fish-scale={fishRuntime?.scale ?? ''}
      data-reef-fish-route-profile={fishRuntime ? REEF_FISH_SCHOOL_ROUTE_PROFILE : 'loading'}
      data-reef-expected-draw-calls={build.diagnostics.expectedDrawCalls}
      data-reef-runtime-draw-calls={reportedDrawCalls ?? ''}
      data-reef-runtime-triangles={reportedTriangles ?? ''}
      data-reef-world-draw-calls={worldRuntime?.drawCalls ?? ''}
      data-reef-world-triangles={worldRuntime?.triangles ?? ''}
      data-reef-build-ms={build.buildMs}
      data-reef-current-cycle={build.life.current.cycleSeconds}
    >
      <Canvas
        dpr={[1, 1.5]}
        frameloop={reducedMotion ? 'demand' : 'always'}
        camera={{ position: [0, 2.65, 8.15], fov: 42, near: 0.1, far: 42 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      >
        <ReefStage
          onBackdropReady={onBackdropReady}
          onFishReady={onFishReady}
          reducedMotion={reducedMotion}
        >
          <ReefObject
            build={build}
            reducedMotion={reducedMotion}
            onSceneReady={onSceneReady}
          />
        </ReefStage>
        <EvolutionRuntimeProbe onMetrics={onRuntimeMetrics} warmupFrames={18} />
      </Canvas>
    </div>
  );
}
