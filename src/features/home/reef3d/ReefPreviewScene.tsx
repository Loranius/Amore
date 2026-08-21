import { useCallback, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { evaluateReefProductionRuntimeAcceptance } from '@/engine/productionAcceptance';
import { useWorldFrameloop } from '@/features/world/useImmersiveRoute';
import { CrystalPlaceholder } from '../CrystalPlaceholder';
import {
  EvolutionRuntimeProbe,
  type EvolutionRuntimeMetrics,
} from '../crystal3d/evolution/EvolutionRuntimeProbe';
import { ReefStage } from './ReefStage';
import type { ReefFishSchoolMetrics } from './ReefFishSchool';
import {
  REEF_FISH_SCHOOL_MODEL,
  REEF_FISH_SCHOOL_ROUTE_PROFILE,
} from './reefFishSchoolPresentation';
import {
  REEF_FOUNDATION_PASS,
  REEF_FOUNDATION_PRESENTATION_VERSION,
} from './reefFoundationPresentation';
import {
  reefCameraFrameForAspect,
  REEF_CAMERA_PASS,
  REEF_LIGHTING_PASS,
  REEF_PALETTE_PASS,
  REEF_SCENE_PROFILE_VERSION,
} from './reefSceneProfile';
import {
  REEF_MATERIAL_PASS,
  REEF_MATERIAL_PRESENTATION_VERSION,
} from './reefMaterialPresentation';
import {
  REEF_COLONY_SHAPE_PASS,
  REEF_PRESENTATION_VERSION,
} from './reefPresentation';
import { useReefPortalPreview } from './useReefPortalPreview';
import './reefWorld.css';

const DEFAULT_REEF_CAMERA_FRAME = reefCameraFrameForAspect(1);

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
  const frameloop = useWorldFrameloop();
  const [fishRuntime, setFishRuntime] = useState<ReefFishSchoolMetrics | null>(null);
  const [worldRuntime, setWorldRuntime] = useState<EvolutionRuntimeMetrics | null>(null);
  const onRuntimeMetrics = useCallback((next: EvolutionRuntimeMetrics) => setWorldRuntime(next), []);
  const onFishReady = useCallback((next: ReefFishSchoolMetrics) => setFishRuntime(next), []);

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
  const reportedDrawCalls = build.diagnostics.expectedDrawCalls;
  const reportedTriangles = build.diagnostics.triangleCount;
  const visibleColonyRanges = build.diagnostics.colonyCount;
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
      data-reef-scene-profile={REEF_SCENE_PROFILE_VERSION}
      data-reef-camera-pass={REEF_CAMERA_PASS}
      data-reef-lighting-pass={REEF_LIGHTING_PASS}
      data-reef-palette-pass={REEF_PALETTE_PASS}
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
      data-reef-evolution={build.species.moduleEvolution.version}
      data-reef-days-together={build.species.moduleEvolution.facts.daysTogether}
      data-reef-completed-years={build.species.moduleEvolution.facts.completedYears}
      data-reef-foundation-radius={build.species.moduleEvolution.foundation.substrateRadius}
      data-reef-outer-growth-radius={build.species.moduleEvolution.foundation.outerGrowthRadius}
      data-reef-year-arches={build.structures.arches.length}
      data-reef-map-outcrops={build.structures.outcrops.length}
      data-reef-schedule-terraces={build.structures.terraces.length}
      data-reef-structure-collision-free={String(build.structures.diagnostics.collisionFree)}
      data-reef-plan-fish-logical={build.species.moduleEvolution.life.planFish.logicalCount}
      data-reef-plan-fish-visible={build.species.moduleEvolution.life.planFish.visibleCount}
      data-reef-wish-corals={build.species.moduleEvolution.colonies.primaryWishCorals.logicalCount}
      data-reef-photo-corals={build.species.moduleEvolution.colonies.microPhotoCorals.logicalCount}
      data-reef-media-corals={build.species.moduleEvolution.colonies.mediaCorals.logicalCount}
      data-reef-calendar-landmarks={build.species.moduleEvolution.colonies.calendarLandmarks.logicalCount}
      data-reef-normalized-events={portal.preview.normalizedEventCount}
      data-reef-adapter-diagnostics={diagnostics.length}
      data-reef-colonies={build.diagnostics.colonyCount}
      data-reef-batches={build.diagnostics.batchCount}
      data-reef-foundation-vertices={build.foundation.vertices.length}
      data-reef-vertices={build.diagnostics.vertexCount}
      data-reef-triangles={build.diagnostics.triangleCount}
      data-reef-materials={build.diagnostics.materialCount}
      data-reef-motion-bindings={build.diagnostics.motionBindingCount}
      data-reef-visible-colonies={visibleColonyRanges}
      data-reef-fish-model={fishRuntime ? REEF_FISH_SCHOOL_MODEL : 'loading'}
      data-reef-fish-meshes={fishRuntime?.meshes ?? ''}
      data-reef-fish-width={fishRuntime?.width ?? ''}
      data-reef-fish-height={fishRuntime?.height ?? ''}
      data-reef-fish-depth={fishRuntime?.depth ?? ''}
      data-reef-fish-routes={fishRuntime?.routes ?? ''}
      data-reef-fish-animated-routes={fishRuntime?.animatedRoutes ?? ''}
      data-reef-fish-tracks={fishRuntime?.tracks ?? ''}
      data-reef-fish-scale={fishRuntime?.scale ?? ''}
      data-reef-fish-route-profile={fishRuntime ? REEF_FISH_SCHOOL_ROUTE_PROFILE : 'loading'}
      data-reef-expected-draw-calls={build.diagnostics.expectedDrawCalls}
      data-reef-runtime-draw-calls={reportedDrawCalls}
      data-reef-runtime-triangles={reportedTriangles}
      data-reef-world-draw-calls={worldRuntime?.drawCalls ?? ''}
      data-reef-world-triangles={worldRuntime?.triangles ?? ''}
      data-reef-build-ms={build.buildMs}
      data-reef-current-cycle={build.life.current.cycleSeconds}
    >
      <Canvas
        dpr={[1, 1.5]}
        // Занурений маршрут забирає екран собі; риф лишається живим, але
        // кадрів для невидимої сцени не малює.
        frameloop={frameloop}
        camera={{
          position: [...DEFAULT_REEF_CAMERA_FRAME.position],
          fov: DEFAULT_REEF_CAMERA_FRAME.fov,
          near: DEFAULT_REEF_CAMERA_FRAME.near,
          far: DEFAULT_REEF_CAMERA_FRAME.far,
        }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      >
        <ReefStage
          build={build}
          onFishReady={onFishReady}
          reducedMotion={reducedMotion}
        >
          {null}
        </ReefStage>
        <EvolutionRuntimeProbe onMetrics={onRuntimeMetrics} warmupFrames={18} />
      </Canvas>
    </div>
  );
}
