import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { crystalRenderScale } from '@/engine/renderer';
import { hash32 } from '@/engine/species/crystalV2/hash';
import { useTheme } from '@/providers/ThemeProvider';
import { useWorldPose } from '@/features/world/useWorldPose';
import { useWorldMotionMode } from '@/features/world/useWorldMotionMode';
import { useWorldFrameloop } from '@/features/world/useImmersiveRoute';
import { MODULE_SPIN_RATE } from '@/features/world/sceneDirector';
import { useEvolutionSandbox } from '@/features/home/evolutionSandbox';
import { useGrowthSinceLastVisit } from '@/features/home/useGrowthSinceLastVisit';
import { useWorldGrowthReporter } from '@/features/world/growthChannel';
import { CrystalPlaceholder } from '../../CrystalPlaceholder';
import { PortalStage } from '../../crystal3d/scene/PortalStage';
import { EvolutionRuntimeProbe, type EvolutionRuntimeMetrics } from '../../crystal3d/evolution/EvolutionRuntimeProbe';
import { readQuality } from '../../crystal3d/evolution/useEvolutionCrystalPipeline';
import { crystalV2GrowthEvents } from '../../crystal3d/v2/crystalV2Frame';
import { ReefV2World } from './ReefV2World';
import { reefV2Frame } from './reefV2Frame';
import { useReefV2 } from './useReefV2';
import '../../crystal3d/evolution/evolutionPreview.css';

// Шлях відкату (ADR-0219): старий риф лишився в коді цілим і вантажиться
// лише тоді, коли v2 не зміг зібратись.
const ReefWorldScene = lazy(() => import('../world/ReefWorldScene'));

/**
 * Риф v2: глибина — мілка лагуна вдень, нічний риф зі світінням уночі — на
 * тій самій камері й тих самих жестах порталу, що й кристал і дерево.
 */
export default function ReefV2Scene() {
  const { theme } = useTheme();
  const { freeCameraActive } = useEvolutionSandbox();
  const [reduceMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [quality] = useState(readQuality);
  const { state, isPending, error } = useReefV2();
  const { pose, region } = useWorldPose();
  const motionMode = useWorldMotionMode();
  // Гаки — до ранніх виходів (див. той самий коментар у сцені кристала).
  const frameloop = useWorldFrameloop();
  const [runtime, setRuntime] = useState<EvolutionRuntimeMetrics | null>(null);
  const onRuntimeMetrics = useCallback((next: EvolutionRuntimeMetrics) => setRuntime(next), []);

  const snapshot = state?.snapshot;
  const growthEvents = useMemo(() => (snapshot ? crystalV2GrowthEvents(snapshot) : null), [snapshot]);
  const growth = useGrowthSinceLastVisit(growthEvents, 'reef');
  const reportGrowth = useWorldGrowthReporter();
  useEffect(() => {
    reportGrowth(growth === null ? null : { species: 'reef', summary: growth });
    return () => reportGrowth(null);
  }, [growth, reportGrowth]);

  const geometry = state?.geometry;
  const frame = useMemo(() => (geometry ? reefV2Frame(geometry) : null), [geometry]);
  const noBearings = useMemo<readonly number[]>(() => [], []);
  // Острівець діорами ширший за риф (на ньому ще морські зірки біля
  // підніжжя), тож камера кадрує за ним, а не лише за коралами (ADR-0220).
  const island = frame && state ? Math.max(frame.reach * 1.25, state.model.radius * frame.scale * 1.55) : 0;

  if (error) {
    console.error('[Reef v2] rollback to the previous reef:', error);
    return (
      <Suspense fallback={<CrystalPlaceholder />}>
        <ReefWorldScene />
      </Suspense>
    );
  }
  if (isPending || !state || !frame) return <CrystalPlaceholder />;

  const { model } = state;
  return (
    <div
      className="crystal-wrap evolution-preview-wrap"
      data-home-artifact-preview="reef"
      data-reef-preview="ready"
      data-evolution-preview="ready"
      data-evolution-renderer="reef-v2"
      data-evolution-species="reef"
      data-evolution-quality={quality}
      data-evolution-bodies={state.model.colonies.reduce((sum, c) => sum + c.bodies, 0)}
      data-evolution-runtime={runtime ? 'ready' : 'warming'}
      data-evolution-draw-calls={runtime?.drawCalls ?? ''}
      data-evolution-rendered-triangles={runtime?.triangles ?? ''}
      data-reef-version={model.version}
      data-reef-years={model.years}
      data-reef-colonies={model.colonies.length}
      data-reef-forms={model.colonies.map((c) => c.form).join(',')}
    >
      <Canvas
        frameloop={frameloop}
        dpr={[1, crystalRenderScale(quality, typeof window === 'undefined' ? 2 : window.devicePixelRatio)]}
        camera={{ position: [0, 0.685, 7.1], fov: 42, far: 400 }}
        gl={{ alpha: false, antialias: quality !== 'fallback' }}
      >
        <PortalStage
          seed={hash32(model.startDate)}
          theme={theme}
          quality={quality}
          reduceMotion={reduceMotion}
          artifactSceneRadius={Math.max(frame.reach, island * 0.92)}
          crystalsSceneRadius={Math.max(frame.reach, island * 0.92)}
          artifactSceneHeight={frame.height}
          veinBearings={noBearings}
          veinReach={0}
          pose={pose}
          spin={region === 'centre' ? 0 : MODULE_SPIN_RATE}
          allowOrbit={region === 'centre'}
          freeCamera={freeCameraActive}
          motionMode={motionMode}
          world="none"
        >
          <ReefV2World
            seed={model.startDate}
            geometry={state.geometry}
            scale={frame.scale}
            theme={theme}
            reduceMotion={reduceMotion}
            island={island}
            rockRadius={model.radius * frame.scale}
          />
        </PortalStage>
        <EvolutionRuntimeProbe onMetrics={onRuntimeMetrics} />
      </Canvas>
    </div>
  );
}
