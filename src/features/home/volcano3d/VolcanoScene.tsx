import { buildVolcanoGeometry } from '@/engine/species/volcano/geometry';
import { buildVolcanoModel } from '@/engine/species/volcano/model';
import { useChronicleScene, type ChroniclePlacement } from '@/features/chronicle/useChronicleScene';
import { PORTAL_GROUND_Y } from '../crystal3d/scene/portalScene';
import { seasonOf } from '@/engine/species/grammar/season';
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { crystalRenderScale } from '@/engine/renderer';
import { hash32 } from '@/engine/species/crystalV2/hash';
import { useTheme } from '@/providers/ThemeProvider';
import { useWorldPose } from '@/features/world/useWorldPose';
import { useWorldMotionMode } from '@/features/world/useWorldMotionMode';
import { useWorldFrameloop } from '@/features/world/useImmersiveRoute';
import { useCanvasRecovery } from '@/features/world/canvasRecovery';
import { MODULE_SPIN_RATE } from '@/features/world/sceneDirector';
import { useEvolutionSandbox } from '@/features/home/evolutionSandbox';
import { useGrowthSinceLastVisit } from '@/features/home/useGrowthSinceLastVisit';
import { useWorldGrowthReporter } from '@/features/world/growthChannel';
import { CrystalPlaceholder } from '../CrystalPlaceholder';
import { PortalStage } from '../crystal3d/scene/PortalStage';
import { EvolutionRuntimeProbe, type EvolutionRuntimeMetrics } from '../crystal3d/evolution/EvolutionRuntimeProbe';
import { readQuality } from '../crystal3d/evolution/useEvolutionCrystalPipeline';
import { crystalV2GrowthEvents } from '../crystal3d/v2/crystalV2Frame';
import { dioramaFrameHeight } from '@/features/home/diorama/dioramaStyle';
import { VolcanoWorld } from './VolcanoWorld';
import { volcanoFrame, volcanoIsland } from './volcanoFrame';
import { useVolcano } from './useVolcano';
import '../crystal3d/evolution/evolutionPreview.css';

// Шлях відкату (ADR-0235): риф v2 лишився в коді цілим і вантажиться лише
// тоді, коли вулкан не зміг зібратись.
const ReefV2Scene = lazy(() => import('../reef3d/v2/ReefV2Scene'));

/**
 * Підводний вулкан у глибині рифу — на тій самій камері й тих самих жестах
 * порталу, що й кристал і дерево.
 */
export default function VolcanoScene() {
  const { theme } = useTheme();
  const { freeCameraActive } = useEvolutionSandbox();
  const [reduceMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [quality] = useState(readQuality);
  const { state, isPending, error } = useVolcano();
  const { pose, region } = useWorldPose();
  const motionMode = useWorldMotionMode();
  // Гаки — до ранніх виходів (див. той самий коментар у сцені кристала).
  const frameloop = useWorldFrameloop();
  const recovery = useCanvasRecovery();
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
  const frame = useMemo(() => (geometry ? volcanoFrame(geometry) : null), [geometry]);
  const noBearings = useMemo<readonly number[]>(() => [], []);
  // Острівець ширший за підніжжя: на ньому ще трава, мушлі й зірки.
  const island = frame ? volcanoIsland(frame) : 0;

  // Хроніка росту (ADR-0238): дотик по вулкану, камера огляду й вулкан на
  // дату з повзунка при сьогоднішньому кадрі.
  const placement = useMemo<ChroniclePlacement | null>(() => (frame ? {
    object: ([x, y, z]) => [x * frame.scale, PORTAL_GROUND_Y + y * frame.scale, z * frame.scale],
    island: ([x, y, z]) => [x * island, PORTAL_GROUND_Y + y * island, z * island],
  } : null), [frame, island]);
  const chronicle = useChronicleScene('reef', snapshot, region === 'centre', placement);
  const shown = useMemo(() => {
    if (!state || !chronicle.asOf) return state ? { model: state.model, geometry: state.geometry } : null;
    const model = buildVolcanoModel({ ...state.snapshot, asOf: chronicle.asOf });
    return { model, geometry: buildVolcanoGeometry(model) };
  }, [state, chronicle.asOf]);

  if (error) {
    console.error('[Volcano] rollback to reef v2:', error);
    return (
      <Suspense fallback={<CrystalPlaceholder />}>
        <ReefV2Scene />
      </Suspense>
    );
  }
  if (isPending || !state || !frame || !shown) return <CrystalPlaceholder />;

  const { model } = shown;
  return (
    <div
      className="crystal-wrap evolution-preview-wrap"
      data-home-artifact-preview="reef"
      data-reef-preview="ready"
      data-evolution-preview="ready"
      data-evolution-renderer="volcano"
      data-evolution-species="reef"
      data-evolution-quality={quality}
      data-evolution-bodies={state.model.life.colonies.reduce((sum, c) => sum + c.bodies, 0)}
      data-evolution-runtime={runtime ? 'ready' : 'warming'}
      data-evolution-draw-calls={runtime?.drawCalls ?? ''}
      data-evolution-rendered-triangles={runtime?.triangles ?? ''}
      data-volcano-version={model.version}
      data-volcano-years={model.years}
      data-volcano-layers={model.layers.length}
      data-volcano-height={model.height}
      data-volcano-glow={model.glow}
    >
      <Canvas
        key={recovery.key}
        onCreated={recovery.onCreated}
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
          artifactSceneRadius={Math.max(frame.reach, island * 0.95)}
          crystalsSceneRadius={Math.max(frame.reach, island * 0.95)}
          artifactSceneHeight={dioramaFrameHeight(frame.height)}
          veinBearings={noBearings}
          veinReach={0}
          pose={pose}
          spin={region === 'centre' ? 0 : MODULE_SPIN_RATE}
          allowOrbit={region === 'centre'}
          freeCamera={freeCameraActive}
          motionMode={motionMode}
          inspect={chronicle.inspect}
          world="none"
        >
          <VolcanoWorld
            seed={model.startDate}
            creatures={model.creatures}
            geometry={shown.geometry}
            scale={frame.scale}
            theme={theme}
            reduceMotion={reduceMotion}
            island={island}
            rockRadius={model.baseRadius * frame.scale}
            glow={model.glow}
            fishKinds={model.fishKinds}
            season={seasonOf(model.asOf)}
            onTap={chronicle.onTap}
          />
        </PortalStage>
        <EvolutionRuntimeProbe onMetrics={onRuntimeMetrics} />
      </Canvas>
    </div>
  );
}
